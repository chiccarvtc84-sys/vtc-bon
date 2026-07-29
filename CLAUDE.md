# 🤖 CLAUDE.md — Mission TrajetPro

Ce fichier est lu **automatiquement** par Claude Code à chaque session. Il contient la mission, l'état du projet, et les règles de travail. Lis-le avant toute action.

> **Source détaillée** : `docs/CHANGELOG.md` pour l'historique des livraisons, `docs/ARCHITECTURE.md` pour le schéma technique, `docs/SECURITY_AUDIT.md` pour l'audit, `TODO_HUMAN.md` pour les actions hors-code.

---

## 🎯 Mission

**TrajetPro est livré.** Application VTC React + Supabase + Capacitor pour chauffeurs indépendants français : bons de course conformes décret 2017-483, facturation conforme CGI, paiements Stripe Checkout, builds iOS + Android scaffoldés.

L'utilisateur (`@moi`) est chauffeur VTC à Sorgues (84) **sans compétences techniques**. Le code est terminé ; il ne reste que les actions humaines de publication (Apple Developer, Mac/Xcode, Google Play, screenshots, soumission stores) listées dans `TODO_HUMAN.md`.

Le rôle de Claude est désormais la **maintenance** : correctifs ponctuels, ajustements demandés, accompagnement de la phase de soumission.

## 📊 État actuel

| Phase | Description | Statut |
|---|---|---|
| 1 | Conception (App.jsx + UI complète) | ✅ Livré |
| 2 | Backend Supabase (7 tables + RLS + RPC) | ✅ Livré (6 migrations appliquées) |
| 3 | Anti-fraude (email + SIRET INSEE + risk score) | ✅ Livré (Edge Function `verify-siret` déployée) |
| 4 | Frontend connecté Supabase (auth, bookings, invoices, tokens, parrainage) | ✅ Livré (v0.4.0) |
| 5 | Stripe Checkout end-to-end (4 produits + webhook + facture auto) | ✅ Livré (v0.5.0) |
| 6 | Capacitor mobile (iOS + Android scaffold + assets + permissions) | ✅ Livré (v0.6.0) |
| **Post-v0.6** | Audit sécurité, dictée vocale refondue, notifications de rappel, anti-double-bonus | ✅ Livré (5 commits) |
| 7-9 | Tests stores + soumission App Store / Play Store + lancement | ⏳ **Humain** (cf. `TODO_HUMAN.md`) |

## ✅ Ce qui a été livré

### Frontend (React 19 + Vite 6)
- `src/App.jsx` (~4 400 lignes) : ~25 composants/écrans cohérents
  - Écrans : Welcome, Login, Signup, DeviceBlocked, Home, Bookings, BookingDetail, BookingForm, Invoices, InvoiceDetail, Tokens, Profile, Referral, Settings, Terms, Help
  - Modals : Voice, Purchase, PurchaseDetail, Insufficient, MonthlyBonus
  - Mode invité avec bannière et data en mémoire
- 5 helpers `src/lib/` :
  - `supabase.js` — auth, bookings, invoices, tokens, parrainage, Stripe Checkout, fingerprint
  - `voiceParser.js` — parser NLP tolérant (multi-passes, fuzzy match villes, normalisation ASR Chrome FR)
  - `notifications.js` — rappels T-3h / T-1h / T-15m, cross-platform (Capacitor natif + Web)
  - `passwordSecurity.js` — protection mot de passe leaked via HaveIBeenPwned k-anonymity
  - `platform.js` — wrappers `isNativePlatform`, `watchNetwork`, `preferences*` (web ↔ Capacitor)

### Backend Supabase (`olmhckwethdcxhvsrfie`, région West EU - Paris)
- **7 tables** avec RLS activée : `users`, `bookings`, `invoices`, `token_transactions`, `device_fingerprints`, `verification_codes`, `blocked_email_domains`
- **6 migrations** appliquées :
  1. `handle_new_auth_user_trigger` — création auto profil + welcome bonus
  2. `fix_handle_new_auth_user_referred_by_uuid` — fix UUID/text
  3. `security_hardening_rpc_and_rls` — durcissement RPC
  4. `security_revoke_trigger_functions_from_anon` (×2)
  5. `anti_double_welcome_bonus_per_device` — un device = un bonus
- **6 Edge Functions** ACTIVE :
  - `verify-siret` (no JWT) — validation SIRET via API INSEE
  - `voice-extract` (JWT requis) — nettoyage IA de la dictée vocale (Gemini)
  - `create-checkout-session` (JWT requis) — session Stripe Checkout (web/Android)
  - `create-payment-intent` (JWT requis) — PaymentIntent (flux Apple Pay natif, dormant)
  - `stripe-webhook` (no JWT, signature vérifiée) — crédit tokens + facture + remboursements
  - `revenuecat-webhook` (no JWT, bearer partagé) — achats In-App Purchase iOS + remboursements
- Trigger `trg_sync_token_balance` : `users.token_balance` toujours = SUM(`token_transactions.tokens_delta`)

### Paiements — DEUX canaux selon la plateforme
- **iOS = Apple In-App Purchase via RevenueCat** (obligatoire, règle App Store 3.1.1 :
  du contenu numérique consommé dans l'app ne peut PAS passer par Stripe). Plugin
  `@revenuecat/purchases-capacitor@11.3.2` (la branche 13.x exige Capacitor 8, on est en 7).
  4 produits consommables `com.trajetpro.app.pack20/40/50/80` déclarés dans App Store
  Connect + RevenueCat. `src/lib/inAppPurchase.js` → webhook `revenuecat-webhook`.
- **Web / Android = Stripe Checkout** (inchangé).
- **Stripe est en mode LIVE** (bascule effectuée). ⚠️ Vérifier qu'un webhook existe bien
  côté Live : les webhooks Test et Live sont deux configurations SÉPARÉES — un paiement
  réel avait été encaissé sans créditer les jetons pour cette raison.
- Mode invité conservé : `purchaseTokensDev` sans Stripe pour démo.
- ⚠️ Les prix réels iOS suivent les **paliers Apple** (ex. 3,59 € au lieu de 3,50 €) :
  le montant facturé vient toujours du webhook, jamais du catalogue codé en dur.

### Mobile (Capacitor 7)
- `npx cap add android` ✅ projet Gradle dans `android/`, buildable depuis Windows
- `npx cap add ios` ✅ projet Xcode dans `ios/`, **`pod install` à faire sur Mac avant 1er build**
- Permissions configurées : Android `AndroidManifest.xml` (INTERNET, RECORD_AUDIO, LOCATION, CAMERA, POST_NOTIFICATIONS…) + iOS `Info.plist` (`NSMicrophone`, `NSSpeechRecognition`, `NSLocationWhenInUse`, `NSCamera`)
- Assets générés (`scripts/generate-assets.mjs` + `@capacitor/assets`) : 113 déclinaisons Android + iOS
- ⚠️ Icône et splash sont des **placeholders** ; remplacer `assets/icon.png` (1024×1024) et `assets/splash.png` (2732×2732) avant build store, puis `npm run assets`

### Sécurité (audit complet — `docs/SECURITY_AUDIT.md`)
- 🔴 4 critiques corrigées (auto-crédit illimité tokens, sabotage tokens d'un autre user, etc.)
- 🟠 11 hautes corrigées
- 🟡 13 moyennes corrigées
- RLS sur toutes les tables, RPC `SECURITY DEFINER` avec `auth.uid()` check, idempotence webhook Stripe (index UNIQUE sur `stripe_payment_intent_id`)
- Aucun secret hardcodé ; `.env` git-ignoré

### Différenciants métier
- **Dictée vocale** (5 s) → bon de course pré-rempli, parser NLP tolérant aux fautes ASR
- **Notifications de rappel** automatiques avant chaque course (T-3h, T-1h, T-15m)
- **Parrainage** : parrain +10, filleul +5
- **Bonus mensuel** : +1 crédit/mois automatique
- **Mode invité** : tester l'app sans créer de compte
- **Anti-fraude device** : un même appareil ne reçoit le bonus welcome qu'une fois

## ⏳ Reste à faire — actions humaines uniquement

Tout le code est livré. Les actions ci-dessous **ne peuvent pas être faites par Claude** (matériel, comptes payants, design créatif). Détails dans `TODO_HUMAN.md` :

1. **Compte Apple Developer** — 99 €/an
2. **Mac avec Xcode 15+** — pour build `.ipa` et soumission App Store (alternatives : MacInCloud, GitHub Actions runner)
3. **Compte Google Play Console** — 25 € unique
4. **Keystore Android** — à générer ET sauvegarder en 3 endroits (perte = plus jamais d'update)
5. **Icône + splash définitifs** (1024×1024 et 2732×2732) — Figma / Fiverr / IA
6. **Screenshots stores** (3 par taille iPhone + 2 Android + feature graphic)
7. **Politique de confidentialité** hébergée à URL publique
8. **Bêta TestFlight + Internal Testing Google Play** (1-2 semaines)
9. **Passage Stripe Live mode** (validation business par Stripe)
10. **Choix politique de remboursement** (CGU)

## ⚙️ Stack technique

- **Frontend** : React 19 + Vite 6 + Capacitor 7
- **Backend** : Supabase (PostgreSQL + Auth + Edge Functions Deno)
- **Paiements** : Apple In-App Purchase via RevenueCat (iOS) + Stripe Checkout (web/Android), mode LIVE
- **Région Supabase** : West EU (Paris) — projet `olmhckwethdcxhvsrfie` (`trajetpro-prod`)
- **Bundle ID** : `com.trajetpro.app`
- **Plugins Capacitor** : `app`, `network`, `preferences`, `local-notifications`

## 🎨 Charte graphique — « TrajetPro Clair » (refonte juillet 2026)

Refonte validée : passage d'un thème **sombre** à un thème **clair premium** inspiré de Planity / apps de transfert d'argent / apps map (fond papier, cartes blanches, grandes typographies, map + bottom-sheet). Le thème sombre reste disponible en option (Réglages).

- **Défaut = CLAIR** (`data-theme="light"` posé dans `main.jsx` + `DEFAULT_PREFERENCES.theme="light"`). Le sombre ne s'applique que si l'utilisateur le choisit dans les Réglages.
- Fond papier : `#F6F5F2` · surfaces cartes : `#FFFFFF` · encre (texte/boutons) : `#16171B`
- **Accent = bleu cobalt** (remplace l'or, 2026-07-04, choix « app moderne »), décliné en 3 tons :
  - `--accent` = `#2563EB` clair / `#3B82F6` sombre → **fonds, boutons, ligne d'itinéraire**
  - `--accent-ink` = `#1D4ED8` clair / `#60A5FA` sombre → **texte bleu lisible** (⚠️ ne jamais utiliser `--accent` pour du texte : contraste insuffisant)
  - `--accent-on` = `#FFFFFF` → **texte/icône posé SUR un fond `--accent`** (blanc sur bleu)
- Validé / encaissé : vert `#12B76A` · Avertissement : ambre `#B7791F` (sémantique, pas la marque)
- L'accent est entièrement **basculable** via 3 tokens : changer les 3 (`--accent`/`--accent-ink`/`--accent-on`) dans les 2 thèmes suffit à reskinner toute l'app.
- Polices : **Fraunces** (titres, gros chiffres) + **Plus Jakarta Sans** (corps) — inchangées
- **Source de vérité des tokens** : bloc `GlobalStyles` dans `src/App.jsx` (`:root` = sombre, `:root[data-theme="light"]` = clair). Le vieux `src/index.css` (`--tp-*`) est secondaire.
- Composants clés : `.tp-card` (ombre douce en clair via `--shadow-card`), `--shadow-hero`, `--map-bg/--map-road/--map-block` (fond map ambiant `AmbientMap`).

**Refonte terminée** sur tous les écrans. Tokens de TEXTE lisibles ajoutés après audit :
`--accent-ink`, `--success-ink`, `--warn-ink`, `--wa-ink`. Règle : le token « plein »
(`--success`, `--accent`…) sert aux FONDS et aux icônes, le token `*-ink` au TEXTE —
sinon le contraste tombe sous le seuil lisible en thème clair.

## 👤 Identité chauffeur (constante DRIVER_PROFILE)

```js
firstName: "Moi", lastName: "Conducteur",
siret: "832 456 789 00012",
vtcNumber: "EVTC084220001",
proCardNumber: "VTC-84-2024-0428",
vehiclePlate: "GT-482-AV",
vehicleModel: "Mercedes Classe E",
baseCity: "Sorgues (84)",
vatRate: 10
```

## 💰 Constantes métier

```js
INITIAL_TOKEN_BALANCE = 5
COST_BOOKING = 1
COST_INVOICE = 1
PACKAGES = { pack20: {20, 2.00€}, pack40: {40, 3.50€}, pack50: {50, 4.00€}, pack80: {80, 5.00€} }
REFERRAL_BONUS_REFERRER = 10
REFERRAL_BONUS_REFEREE = 5
MONTHLY_BONUS_TOKENS = 1
```

## 🔒 Décisions issues de l'audit du 2026-07-29 — NE PAS RÉGRESSER

Audit multi-agents complet (8 dimensions + vérification adversariale) : 24 bugs
corrigés. Les points ci-dessous sont des invariants — les casser réintroduit des
bugs déjà payés cher.

1. **Deux familles de factures dans la MÊME table `invoices`** :
   `FAC-` = ventes du chauffeur (liées à un `booking_id`, TVA 10 %) ;
   `TRP-` = achats de crédits où le chauffeur est CLIENT (compteur GLOBAL, TVA 20 %).
   → Helper `isSalesInvoice()` : **toujours filtrer** avant d'alimenter l'écran
   Factures, le chiffre d'affaires ou l'export CSV. Ne jamais coder le taux de TVA
   en dur : `invoiceFromDb` expose le `vatRate` réel de la ligne.

2. **Toute numérotation de facture se fait côté SQL, sous advisory lock** — jamais
   en « lire le max puis insérer » depuis le client ou une edge function (deux
   paiements simultanés obtenaient le même numéro) :
   - `create_purchase_invoice(...)` → TRP-, appelée par les 2 webhooks
   - `create_invoice_for_booking(user, booking)` → FAC-, appelée par `createInvoice`,
     fait TOUT dans une transaction (numéro + solde + facture + débit du crédit).
     ⚠️ `invoices` n'a **volontairement aucune policy DELETE** (art. 242 nonies A CGI) :
     un « rollback » côté client y est un no-op silencieux. D'où la RPC atomique.

3. **Remboursements** : `refund_token_purchase()` branchée sur `charge.refunded`
   (Stripe) et `CANCELLATION`/`REFUND` (RevenueCat). Les index UNIQUE anti-double-crédit
   sont **restreints à `kind='purchase'`** — sinon ils bloquent la ligne de
   remboursement qui doit référencer la même transaction.

4. **Session** : stockée dans les Preferences natives (pas localStorage — iOS purge
   localStorage). `signOut()` appelle `supabase.auth.signOut()` **AVANT** de purger
   (sinon le refresh token n'est jamais révoqué côté serveur), puis purge **toujours**.

5. **`onAuthStateChange`** : `SIGNED_IN` est ré-émis à chaque retour au premier plan
   → garde sur `loadedUserIdRef` obligatoire, sinon rechargement complet + retour
   forcé à l'Accueil à chaque appel téléphonique reçu.

6. **Dates** : `toLocalInput(d)` pour tout `<input type="datetime-local">`.
   **Jamais** `toISOString().slice(0,16)` (décale de 1-2 h en France).

7. **Actions consommant un crédit** : verrou `busyActionRef` + bouton `disabled` +
   id stable — le double-tap créait 2 bons et débitait 2 crédits.

8. **Bon de course = document réglementaire** : pour un compte réel, un champ de
   profil vide affiche « À renseigner », **jamais** la valeur d'exemple de
   `DRIVER_PROFILE` (sinon on imprime le n° VTC de quelqu'un d'autre).

9. **Le hero de l'Accueil a `isolation: isolate`** — sans ça, les panes Leaflet
   (z-index jusqu'à 600) passent au-dessus des modales de toute l'app.

⚠️ **La base de production est en AVANCE sur `supabase/SUPABASE_SCHEMA.sql`**
(colonnes et contraintes décrites dans le fichier mais absentes en base, et
inversement). **Toujours interroger la base via le MCP Supabase** plutôt que de se
fier à ce fichier.

## 🛡️ Règles de sécurité non négociables (déjà appliquées partout)

- **Jamais** de `STRIPE_SECRET_KEY` ni de `SUPABASE_SERVICE_ROLE_KEY` côté client
- **RLS activée** sur toutes les tables
- **Validation backend** sur achat tokens (webhook signature) et facturation (RPC `SECURITY DEFINER` + `auth.uid()` check)
- JWT vérifié sur les Edge Functions (sauf `verify-siret` et `stripe-webhook` qui ont leur propre vérification)
- Index UNIQUE sur `stripe_payment_intent_id` (anti-rejeu webhook)
- Mots de passe testés contre HaveIBeenPwned (k-anonymity, gratuit)

## 📜 Conformité française

- **Décret 2017-483** : bons avec SIRET, n° VTC, carte pro, immatriculation, modèle véhicule
- **CGI** : factures numérotation chronologique sans rupture, empreinte fiscale SHA-256, QR code
- **TVA** : 10% transport personnes (bons), 20% prestation numérique (achat tokens), auto-liquidation UE hors-FR
- **RGPD** : politique de confidentialité, droit à l'effacement, hébergement EU (Paris)

## 📐 Règles de travail (mode maintenance)

1. **Lis App.jsx en entier avant de modifier** quoi que ce soit (4 385 lignes mais cohérent).
2. **Commits Git réguliers** avec format : `feat: …` / `fix: …` / `refactor: …` / `security: …` / `docs: …`.
3. **Tag les versions** : `v0.6.0` était le scaffold mobile ; prochaine `v1.0.0` à la première soumission store.
4. **Changelog** : maintenir `docs/CHANGELOG.md` à jour (les commits post-v0.6.0 ne sont pas encore consignés).
5. **Décisions non triviales** : proposer 2-3 options avec pros/cons avant de choisir.
6. **Cohérence données** à vérifier systématiquement :
   - `users.token_balance` = `SUM(token_transactions.tokens_delta)` pour ce user
   - Numérotation factures continue (pas de saut)
   - Pas de bons orphelins (`user_id` invalide)
7. **Ce que tu ne peux pas faire** (Apple Developer, Google Play, builds Mac/Xcode, design créatif) → `TODO_HUMAN.md`.
8. **Si bloqué** → `BLOCKERS.md` + continue sur autre tâche.
9. **Avant tout changement de schéma SQL** : créer une migration nommée (`apply_migration` du MCP Supabase), jamais de `execute_sql` direct sur la prod.

## 🛠️ Outils MCP disponibles

- **Supabase** (`mcp__…__execute_sql`, `apply_migration`, `deploy_edge_function`, `get_advisors`, `list_tables`, `list_migrations`, `list_edge_functions`) — projet `olmhckwethdcxhvsrfie`
- **Stripe** (`mcp__…__list_products`, `create_product`, `list_payment_intents`, …) — si le connecteur est branché
- **Claude in Chrome** / **Claude Preview** : ouvrir l'app Vite en preview pour tester visuellement

## 💬 Style

- Français uniquement.
- Vulgariser le jargon technique pour l'utilisateur.
- Expliquer le **pourquoi** des choix.
- Honnête : si une partie du code est mauvaise, le dire avec une alternative.
- Ne pas se plaindre des bugs existants — les corriger sereinement.

## 🗂️ Fichiers de tracking à maintenir

- `docs/CHANGELOG.md` — historique des changements (à compléter avec les 5 commits post-v0.6.0)
- `TODO_HUMAN.md` — actions humaines requises (publication stores)
- `BLOCKERS.md` — blocages en cours (1 actif non bloquant : clé publique Stripe à vérifier)
- `docs/ARCHITECTURE.md` — schéma technique
- `docs/SECURITY_AUDIT.md` — audit complet (4C + 11H + 13M corrigées)
- `docs/TESTING_MOBILE.md` — guide pas-à-pas pour tester sur Android et iOS

---

**Le code est prêt. La balle est dans le camp humain pour la publication.** 🚀
