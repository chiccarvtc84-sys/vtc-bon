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

### Mode prod (Stripe Checkout — implémenté en Phase 5)
```
React: PurchaseModal.handleConfirm
  └── App.onPurchaseConfirm
      └── createCheckoutSession(packageId)  ← src/lib/supabase.js
          └── Edge Function create-checkout-session (JWT requis)
              ├── Auth: extract user.id du JWT Supabase
              ├── Lookup price_id depuis catalogue figé serveur
              ├── stripe.checkout.sessions.create({
              │     mode: "payment", line_items: [{ price, quantity:1 }],
              │     success_url, cancel_url, locale: "fr",
              │     metadata: { user_id, package_id, tokens, pack_label }
              │   })
              └── Retour: { sessionId, url }
      └── window.location.assign(url)
React: User paie sur checkout.stripe.com (page hosted FR)
  └── Stripe redirige vers SITE_URL/?purchase=success&session_id=…
React: handleCheckoutReturn (au mount)
  ├── Detect ?purchase=success
  ├── Poll findPurchaseBySessionId (max 10s, le webhook a 1-3s)
  ├── Refresh balance + token_transactions + invoices
  └── Toast "✅ Paiement confirmé. N crédits ajoutés"

(En parallèle) Stripe → POST /functions/v1/stripe-webhook
  └── stripe.webhooks.constructEventAsync(body, sig, STRIPE_WEBHOOK_SECRET)
  └── Si checkout.session.completed:
      ├── RPC credit_token_purchase (idempotent via stripe_payment_intent_id)
      │   └── INSERT token_transactions (purchase, +N tokens)
      │       └── trg_sync_token_balance → users.token_balance += N
      └── INSERT invoices (
            invoice_number = TRP-YYYY-XXXX (chronologique sans rupture),
            amount_ht/vat/ttc, vat_rate=20, status='paid',
            fingerprint=SHA-256(num|user|pack|amount|intent|issued_at),
            qr_code_data=INV:…|TTC:…|VAT:…|FP:…16
          )
      └── UPDATE token_transactions SET invoice_number = TRP-…
            WHERE stripe_payment_intent_id = intent_id
```

### Edge Functions déployées
- `verify-siret` (Phase 3) — no JWT, lookup INSEE
- `create-checkout-session` (Phase 5) — JWT requis, crée session Stripe
- `stripe-webhook` (Phase 5) — no JWT, signature vérifiée

### Secrets Supabase Edge Functions (déposés via `supabase secrets set`)
- `STRIPE_SECRET_KEY` — clé secrète Stripe (sk_test_… ou sk_live_…)
- `STRIPE_WEBHOOK_SECRET` — signing secret du webhook
- `SITE_URL` — URL de retour après paiement (http://localhost:5173 en dev)
- + les 5 built-in : `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWKS`, `SUPABASE_DB_URL`

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
