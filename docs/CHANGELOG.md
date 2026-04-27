# Changelog

Toutes les modifications notables de TrajetPro sont consignées ici.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [Unreleased]

### À venir (Phase 5 — Stripe)
- Edge Functions `create-payment-intent` et `stripe-webhook`
- 4 produits Stripe (pack20 / pack40 / pack50 / pack80)
- Branchement `PurchaseModal` sur Stripe Checkout (hosted)
- Génération de la facture côté serveur (numéro `TRP-2026-XXXX`, empreinte fiscale)

---

## [0.4.0] — 2026-04-27

### Ajouté
- **CLAUDE.md** : mission auto-chargée par Claude Code à chaque session.
- **Scaffolding Vite manquant** : `index.html`, `src/main.jsx`, `src/index.css`,
  `vite.config.js`, `capacitor.config.ts`.
- **Helpers Supabase étendus** (`src/lib/supabase.js`) :
  - `purchaseTokensDev(userId, {packageId, tokens, priceTTC})` — achat sans Stripe (mode dev).
  - `findUserByReferralCode(code)` — lookup avant signup.
  - `creditReferralBonus(referrerId, refereeId)` — wrapper RPC.
- **Mappers DB → React** dans `App.jsx` :
  `bookingFromDb`, `invoiceFromDb`, `tokenTxFromDb`, `profileFromDb`.
- **useEffect d'auth** : `supabase.auth.getSession()` au mount + `onAuthStateChange`
  pour réagir aux SIGNED_IN / SIGNED_OUT.
- **`loadUserData(userId)`** : charge profil + bookings + invoices + token_transactions
  en parallèle, retry court sur le profil pour absorber la race avec le trigger SQL.

### Modifié
- **`LoginScreen.submit`** : appelle `supabase.auth.signInWithPassword` au lieu
  d'une comparaison locale avec `DEMO_USER`.
- **`SignupScreen.handleInitialSubmit`** :
  - Vérification email jetable côté serveur (`is_disposable_email` RPC).
  - Vérification SIRET via Edge Function `verify-siret`.
  - Lookup du code de parrainage (validation avant signup).
  - Création du compte via `supabase.auth.signUp` (le trigger SQL crée le profil).
- **`SignupScreen.handleValidateEmail`** : redirige vers le login (le bouton
  "[Mode démo] J'ai cliqué sur le lien" est remplacé par "Aller à la connexion").
- **`App.onLogin`** : ne fait plus que basculer l'UI ; le chargement des données
  passe par `onAuthStateChange`.
- **`App.onLogout`** : appelle `supabase.auth.signOut()`.
- **`App.onSaveBooking`** : `createBooking` (insert + RPC `consume_tokens`) ou
  `updateBooking` selon que c'est un nouveau bon ou une mise à jour.
- **`App.onDeleteBooking`** : `deleteBooking` (soft delete via `deleted_at`).
- **`App.onInvoiceBooking`** : `createInvoice` (insert + RPC `consume_tokens`).
- **`App.onPurchaseConfirm`** : `purchaseTokensDev` (RPC `credit_token_purchase`).
- **Bonus parrainage** automatique à la 1re connexion d'un filleul, depuis
  `loadUserData`, si `referred_by` rempli et aucune transaction
  `referral_bonus` reçue.
- **Bonus mensuel** appelé via `signIn()` côté helper et au session restore.

### Supprimé
- `INITIAL_BOOKINGS`, `INITIAL_INVOICES`, `INITIAL_TOKEN_HISTORY` — vidés (data
  désormais chargée depuis Supabase).
- `DEMO_USER` (compte de démonstration en dur) — disparu.
- Carte "Compte de démonstration" affichée sur l'écran de login.
- Section "[Mode démo]" sur la vue email_sent.

### Côté Supabase
- **Migration appliquée** : `handle_new_auth_user_trigger` (fonction
  `handle_new_auth_user` + trigger `on_auth_user_created` sur `auth.users`).
  À l'inscription, le profil est créé automatiquement dans `public.users` avec
  un code de parrainage unique, et la transaction `welcome` (+5 crédits) est
  insérée. Le trigger `trg_sync_token_balance` propage le solde.

### Notes
- Le linter ESLint n'a pas été lancé sur ce commit (le projet ne dispose pas
  encore de config). À planifier si le besoin apparaît.
- La table `device_fingerprints` existe en DB mais n'est pas encore alimentée
  côté React — c'est `KNOWN_DEVICES` (Map en mémoire) qui joue ce rôle. Voir
  `TODO_HUMAN.md` pour la migration future.

## [0.0.1] — 2026-04-27

### Ajouté
- Initialisation du repo Git.
- Code Phase 1-3 importé depuis le ZIP utilisateur :
  - `App.jsx` 3649 lignes (UI + logique mock complète).
  - `src/lib/supabase.js` 322 lignes (helpers Auth, bookings, invoices,
    token_transactions, verify-siret, fingerprint).
  - `supabase/SUPABASE_SCHEMA.sql` 645 lignes (7 tables, 7 fonctions,
    3 triggers, RLS, 15 domaines bloqués initiaux).
  - `guides/phase{2..9}_detaillee_debutant.md` (8 guides).
  - `docs/` business + légal.
