# Changelog

Toutes les modifications notables de TrajetPro sont consignées ici.
Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [Unreleased]

### À venir (Phase 7-9 — soumission stores)
- Build signé Android `.aab` (Android Studio + keystore)
- Build iOS `.ipa` (Mac requis, Xcode Archive → TestFlight)
- Screenshots pour App Store + Google Play
- Descriptions + mots-clés ASO
- Beta testing TestFlight + Internal Testing

---

## [0.6.0] — 2026-04-27

### Ajouté

#### Plateformes natives
- **`npx cap add android`** : projet Android scaffolded dans `android/`
  (Gradle + Java) avec bundle `com.trajetpro.app`.
- **`npx cap add ios`** : projet Xcode scaffolded dans `ios/`
  (Swift + Storyboards). Le `pod install` est skipped sur Windows,
  à exécuter sur un Mac avant le premier build (voir `TODO_HUMAN.md`).
- **`@capacitor/network`** activé : Wi-Fi / cellulaire / hors-ligne.
- **`@capacitor/preferences`** activé : stockage natif chiffré (iOS Keychain
  variant disponible) et `SharedPreferences` Android.

#### Permissions natives
- **Android (`AndroidManifest.xml`)** :
  `INTERNET`, `ACCESS_NETWORK_STATE`, `RECORD_AUDIO`,
  `MODIFY_AUDIO_SETTINGS`, `ACCESS_COARSE/FINE_LOCATION`,
  `CAMERA`, `POST_NOTIFICATIONS`, `READ_MEDIA_IMAGES`.
- **iOS (`Info.plist`)** : `NSMicrophoneUsageDescription`,
  `NSSpeechRecognitionUsageDescription`,
  `NSLocationWhenInUseUsageDescription`,
  `NSCameraUsageDescription`, `NSPhotoLibraryAddUsageDescription`.
  Schéma URL `trajetpro://` ajouté pour les deep links futurs.

#### Assets visuels (placeholders)
- `scripts/generate-assets.mjs` : génère `assets/icon.png` (1024×1024)
  et `assets/splash.png` / `splash-dark.png` (2732×2732) à partir d'un
  SVG inline aux couleurs de la marque (fond `#0B0B0D`, doré `#F4B942`,
  voiture stylisée + wordmark Fraunces).
- **`@capacitor/assets`** : génère 113 déclinaisons
  (100 Android mipmap/drawable toutes densités + 13 iOS appiconset).
- ⚠️ Ce sont des placeholders ; remplacer `assets/icon.png` et
  `assets/splash.png` par les vrais visuels avant le build de production
  puis `npm run assets`.

#### Code React adaptations
- **`src/lib/platform.js`** : helpers cross-platform
  - `isNativePlatform()`, `platformName()` (web/ios/android)
  - `watchNetwork(cb)` : `@capacitor/network` en natif, `navigator.onLine`
    en web. `unsubscribe()` retourné.
  - `preferencesGet/Set/Remove` : `@capacitor/preferences` en natif,
    `localStorage` en web. Imports dynamiques pour éviter de bundler
    les SDK Capacitor en build web.
- **`App.jsx`** : badge rouge "Hors-ligne" en haut de l'app quand la
  connexion tombe (visible sur l'auth + l'app principale).

#### Scripts npm
```json
"assets": "node scripts/generate-assets.mjs && capacitor-assets generate --ios --android"
"cap:sync": "npm run build && cap sync"
"cap:android": "npm run cap:sync && cap open android"
"cap:ios": "npm run cap:sync && cap open ios"
"cap:run:android": "npm run cap:sync && cap run android"
"cap:run:ios": "npm run cap:sync && cap run ios"
```

### Modifié
- `package.json` deps : ajout `typescript@6` (capacitor.config.ts),
  `sharp@0.34` et `@capacitor/assets@3` (devDeps).

### Notes
- Le bundle JS passe de 576 KB à 587 KB gzip 158 KB. Vite a auto-splité
  un chunk `web-*.js` (1.2 KB) pour les imports natifs Capacitor —
  ils ne sont chargés qu'en runtime mobile.
- Le projet `ios/` est utilisable mais nécessite **un Mac avec Xcode 15+
  et CocoaPods** pour : `cd ios/App && pod install` puis ouvrir
  `App.xcworkspace`.
- Le projet `android/` est buildable directement depuis Windows via
  Android Studio.

---

## [0.5.0] — 2026-04-27

### Ajouté

#### Côté Stripe (test mode)
- 4 produits + 4 prix Stripe créés (compte `acct_1TPbCvGYVtGQnVrZ`) :
  - `pack20` (Pack Découverte, 20 crédits, 2.00€) — `price_1TQuQWGYVtGQnVrZcnvDfEMJ`
  - `pack40` (Pack Essentiel, 40 crédits, 3.50€) — `price_1TQuQZGYVtGQnVrZO9EFBOg3`
  - `pack50` (Pack Confort, 50 crédits, 4.00€) — `price_1TQuQcGYVtGQnVrZbp1H0jyi`
  - `pack80` (Pack Pro, 80 crédits, 5.00€) — `price_1TQuQfGYVtGQnVrZzc62g6OX`
- Webhook Stripe créé : `we_1TQuUgGYVtGQnVrZ0vtAsKgn` → écoute
  `checkout.session.completed` + `payment_intent.payment_failed`,
  pointe sur `https://olmhckwethdcxhvsrfie.supabase.co/functions/v1/stripe-webhook`.

#### Côté Supabase Edge Functions
- **`create-checkout-session`** (JWT requis) : crée une session Stripe Checkout
  avec le `price_id` figé serveur (catalogue dans la fonction). Retourne
  `{ sessionId, url }` ; le client redirige vers `url`. Métadonnées
  `user_id`, `package_id`, `tokens`, `pack_label` injectées pour le webhook.
- **`stripe-webhook`** (no JWT, signature vérifiée) : sur
  `checkout.session.completed`, appelle la RPC `credit_token_purchase`
  (idempotente — anti double crédit grâce au `stripe_payment_intent_id`),
  génère une facture conforme CGI (numéro chronologique `TRP-YYYY-XXXX`,
  TVA 20%, empreinte fiscale SHA-256, QR code, `status='paid'`), et
  backfill `invoice_number` dans `token_transactions`.
- **3 secrets déposés** via `supabase secrets set` :
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL`.

#### Côté React (`src/lib/supabase.js`)
- `createCheckoutSession(packageId)` — wrapper `functions.invoke`.
- `findPurchaseBySessionId(userId, sessionId)` — recherche la transaction
  d'achat la plus récente (utilisé sur la page de retour).
- `purchaseTokensDev` conservé pour le mode invité.

#### Côté React (`src/App.jsx`)
- `onPurchaseConfirm` (mode connecté) : crée la session Checkout puis
  `window.location.assign(url)` → redirection vers la page Stripe hosted
  en français (`locale: "fr"`).
- `onPurchaseConfirm` (mode invité) : reste local en mémoire.
- `handleCheckoutReturn(authUserId)` : détecte `?purchase=success` ou
  `?purchase=cancel` au mount + sur `SIGNED_IN`, poll jusqu'à 10s la
  transaction d'achat (le webhook met 1-3s), refresh
  solde/historique/factures, affiche un toast.
- `PurchaseModal.handleConfirm` rendu async, gère le rejet propre du
  `onConfirm` qui ne retourne jamais (cas redirection).

### Modifié
- `package.json` : `@stripe/stripe-js` déjà dans les deps depuis Phase 1
  (utile uniquement si on remet Stripe Elements plus tard ; Checkout hosted
  ne le nécessite pas).
- `.env` : `VITE_STRIPE_PUBLIC_KEY` rempli avec la clé fournie (⚠️ suite
  de `z` à la fin — à vérifier côté user, voir `TODO_HUMAN.md`).

### Notes
- La TVA est fixée à 20% côté webhook (prestation de service numérique B2C).
  Pour un client UE B2B avec n° TVA intracommunautaire valide, il faudra
  passer par `vat_reverse_charge=true` et HT — à implémenter en Phase 5.1.
- L'empreinte fiscale (`fingerprint`) est SHA-256 sur
  `invoice_number|user_id|package_id|amount_ttc|payment_intent_id|issued_at`.
  Le `qr_code_data` contient `INV:…|TTC:…|VAT:…|FP:…16` pour scan rapide.

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
