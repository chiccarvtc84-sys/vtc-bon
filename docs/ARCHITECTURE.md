# 🏛️ Architecture technique TrajetPro

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────┐
│                    📱 Mobile (Capacitor)                │
│              iOS .ipa  +  Android .aab signé            │
│                          │                              │
│                          ▼                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │            React 19 + Vite (web bundle)          │   │
│  │  • App.jsx (3700 lignes — logique UI)            │   │
│  │  • src/lib/supabase.js (helpers)                 │   │
│  │  • src/lib/stripe.js (Phase 5)                   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    🌍 Supabase (Paris)                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Auth (email + mot de passe)         │   │
│  │  → trigger handle_new_auth_user                  │   │
│  │     INSERT public.users + transaction welcome    │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │          PostgreSQL (RLS activée partout)        │   │
│  │  users · bookings · invoices · token_transactions│   │
│  │  device_fingerprints · verification_codes        │   │
│  │  blocked_email_domains (609 domaines)            │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │                Edge Functions (Deno)             │   │
│  │  • verify-siret (déployée — Phase 3)             │   │
│  │  • create-payment-intent (Phase 5)               │   │
│  │  • stripe-webhook (Phase 5)                      │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │ webhook signé
                            ▼
                ┌─────────────────────┐
                │  💳 Stripe (test)    │
                │  4 produits :        │
                │  pack20/40/50/80     │
                └─────────────────────┘
```

## Modèle de données

### Table `users` (profil chauffeur, lié 1-1 à `auth.users`)
- `id` UUID PK ← `auth.users.id`
- `email`, `name`, `phone`, `siret`, `vtc_number`, `pro_card_number`,
  `vehicle_plate`, `vehicle_model`, `base_city`
- `token_balance` INTEGER (toujours synchronisé via trigger avec
  `SUM(token_transactions.tokens_delta)` pour ce user)
- `referral_code` UNIQUE, `referred_by`, `referrals_count`
- Anti-fraude : `email_verified`, `siret_verified`, `device_fingerprint`,
  `last_known_ip`, `risk_score`, `flagged`, `flagged_reason`

### Table `bookings` (bons de course)
- `id` UUID PK
- `user_id` → `users.id`
- `customer_name`, `customer_phone`, `customer_email`
- `pickup_address`, `dropoff_address`, `pickup_datetime`
- `passengers`, `has_luggage`, `child_seat`, `vehicle_category`
- `distance_km`, `duration_min`
- `price_ht`, `price_vat`, `price_ttc`
- `notes`, `type` (manual/voice/platform/recurring), `status`
- `platform_source`, `platform_booking_id`
- `deleted_at` (soft delete)

### Table `invoices` (factures conformes CGI)
- `id` UUID PK
- `user_id`, `booking_id`
- `invoice_number` (unique par user, format `FAC-YYYY-XXXX`)
- `customer_*` (nom, adresse, email, TVA intracommunautaire)
- `amount_ht`, `amount_vat`, `amount_ttc`, `vat_rate`, `vat_reverse_charge`
- `status` (pending/paid/cancelled/refunded), `payment_method`
- **`fingerprint`** SHA-256 (immutabilité fiscale)
- `pdf_url`, `qr_code_data`
- `issued_at`, `paid_at`, `cancelled_at`
- ⚠️ Aucune policy UPDATE/DELETE (immutabilité légale)

### Table `token_transactions` (source unique de vérité du solde)
- `id` UUID PK
- `user_id`
- `kind` : `welcome`, `purchase`, `monthly_bonus`, `referral_bonus`,
  `admin_credit`, `consume_booking`, `consume_invoice`, `refund`, `expiration`
- `tokens_delta` (positif ou négatif)
- Pour les achats : `package_id`, `amount_ht/vat/ttc`, `vat_applied`,
  `vat_intra`, `payment_method`, `invoice_number`, `stripe_payment_intent_id`
- Liens : `related_booking_id`, `related_invoice_id`, `related_user_id`
- `notes`, `created_at`

**Trigger `trg_sync_token_balance`** : à chaque INSERT, met à jour
`users.token_balance += tokens_delta`. C'est le seul endroit où le solde est
modifié. INSERT direct sur `token_transactions` interdit côté client (les RPC
`consume_tokens`, `credit_token_purchase`, `credit_monthly_bonus`,
`credit_referral_bonus` sont en `SECURITY DEFINER` et seules à pouvoir y
toucher en pratique).

## Flow d'authentification

```
1. Inscription
   ├── React: SignupScreen.handleInitialSubmit
   │   ├── isDisposableEmail (RPC) → bloque les jetables
   │   ├── verify-siret (Edge Function) → bloque non-VTC
   │   ├── findUserByReferralCode (si parrainage) → bloque codes invalides
   │   └── supabase.auth.signUp({ email, password, metadata })
   │       └── 🪝 trigger on_auth_user_created
   │           └── handle_new_auth_user()
   │               ├── INSERT public.users (token_balance=0)
   │               └── INSERT token_transactions (welcome, +5)
   │                   └── 🪝 trg_sync_token_balance → token_balance=5
   ├── Supabase envoie email confirmation
   └── React: redirige vers LoginScreen

2. Confirmation email (lien cliqué)
   └── Supabase: marque auth.users.email_confirmed_at

3. Connexion
   ├── React: LoginScreen.submit
   │   └── sbSignIn → supabase.auth.signInWithPassword
   │       └── credit_monthly_bonus (helper) — idempotent
   ├── 🪝 onAuthStateChange('SIGNED_IN')
   │   └── App.loadUserData(user.id)
   │       ├── Profil (avec retry 5x250ms)
   │       ├── Si referred_by + pas de bonus reçu :
   │       │   └── creditReferralBonus(referrer, user)
   │       ├── credit_monthly_bonus (idempotent)
   │       ├── Refresh profil (solde à jour)
   │       └── Charge bookings + invoices + token_transactions
   └── React: setCurrentUser, redirige vers /home

4. Déconnexion
   ├── React: onLogout → sbSignOut → supabase.auth.signOut()
   └── 🪝 onAuthStateChange('SIGNED_OUT')
       └── Reset état + redirige vers /welcome
```

## Flow d'achat de crédits

### Mode dev (actuel)
```
React: PurchaseModal → onConfirm
  └── App.onPurchaseConfirm
      └── purchaseTokensDev(userId, { packageId, tokens, priceTTC })
          └── RPC credit_token_purchase (avec stripe_payment_intent_id factice)
              └── INSERT token_transactions (purchase, +N)
                  └── 🪝 trg_sync_token_balance
```

### Mode prod (Phase 5 — Stripe Checkout)
```
React: PurchaseModal → onConfirm
  └── Edge Function create-payment-intent (Phase 5)
      ├── stripe.checkout.sessions.create({ price, success_url, cancel_url })
      └── Retour : URL hosted Stripe Checkout
React: window.location = checkoutUrl
  └── User paie sur stripe.com
  └── Stripe → success_url → /tokens?session_id=…

Stripe → POST /functions/v1/stripe-webhook (signé)
  └── stripe.webhooks.constructEvent(body, sig, secret)
  └── checkout.session.completed
      └── RPC credit_token_purchase
          └── INSERT token_transactions (purchase, +N, real intent_id)
      └── INSERT invoices (numéro TRP-2026-XXXX, fingerprint, QR code)
```

## Flow de création d'un bon de course

```
React: BookingForm.onSave
  └── App.onSaveBooking
      └── isNew ?
          ├── OUI: sbCreateBooking
          │   ├── INSERT bookings
          │   └── RPC consume_tokens (-1, kind=consume_booking)
          │       └── (rollback DELETE booking si échec)
          └── NON: sbUpdateBooking (UPDATE bookings, gratuit)
      └── refreshTokens() (resync solde + historique)
```

## Sécurité

- **RLS activée sur toutes les tables**. Chaque user ne voit/modifie que ses
  propres lignes (`auth.uid() = user_id` ou `auth.uid() = id` pour `users`).
- **`token_transactions`** : SELECT autorisé sur ses propres transactions,
  INSERT interdit côté client (passe par RPC SECURITY DEFINER).
- **`invoices`** : pas de policy UPDATE/DELETE (immutabilité fiscale).
- **Edge Functions** :
  - `verify-siret` : `--no-verify-jwt` (publique, lookup INSEE).
  - `stripe-webhook` (Phase 5) : `--no-verify-jwt` mais signature Stripe vérifiée.
  - `create-payment-intent` (Phase 5) : JWT requis (user authentifié).
- **Secrets** : `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` jamais côté
  client, déposés dans Supabase Edge Functions Secrets.

## Stack et versions

- React 19, react-dom 19
- Vite 6, @vitejs/plugin-react 4
- @supabase/supabase-js 2.45+
- @stripe/stripe-js 4 (chargé Phase 5)
- @capacitor/core 7, @capacitor/ios 7, @capacitor/android 7
- @capacitor/preferences 7 (stockage local cross-platform)
- @capacitor/network 7 (détection mode hors-ligne)
- @capacitor/app 7 (deep links, état app)
- lucide-react 0.468 (icônes)

Node 20+ requis pour Vite. Côté CI : Node 22 LTS recommandé.
