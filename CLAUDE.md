# 🤖 CLAUDE.md — Mission TrajetPro

Ce fichier est lu **automatiquement** par Claude Code à chaque session. Il contient la mission, l'état du projet, et les règles de travail. Lis-le avant toute action.

> **Source détaillée** : `PROMPT_CLAUDE_CODE.md` à la racine. Les guides de phase sont dans `guides/phase2…phase9_detaillee_debutant.md`.

---

## 🎯 Mission

Finaliser **TrajetPro**, une application VTC React + Supabase + Capacitor pour chauffeurs indépendants français. Bons de course conformes décret 2017-483, facturation conforme CGI, paiements Stripe, builds iOS + Android.

L'utilisateur (`@moi`) est chauffeur VTC à Sorgues (84) **sans compétences techniques**. Il faut tout livrer clé en main : code propre, repo Git versionné, builds prêts à uploader.

## 📊 État actuel

| Phase | Description | Statut |
|---|---|---|
| 1 | Conception (App.jsx 3700 lignes) | ✅ 100% |
| 2 | Backend Supabase (6 tables + RLS + 4 RPC) | ✅ 100% |
| 3 | Anti-fraude (email + SIRET INSEE + risk score) | ✅ 100% |
| 4 | Frontend connecté Supabase | 🟡 50% |
| 5 | Stripe (paiements crédits) | ⏳ 0% |
| 6 | Build mobile Capacitor (iOS + Android) | ⏳ 0% |
| 7-9 | Tests + soumission stores + lancement | ⏳ 0% (humain) |

## 🔴 Phase 4 — Reste à finir

1. **Étape 8.6** : `onDeleteBooking` + `onInvoiceBooking` → branchement Supabase (cf. `guides/phase4_detaillee_debutant.md` étape 8.6)
2. **Étape 8.7** : `onLogout` → `supabase.auth.signOut()` + reset état
3. **Achat crédits** : `PurchaseModal` → enregistrer dans `token_transactions` (dev) puis Stripe (prod, Phase 5)
4. **Parrainage** : `onReferralValidate` → `supabase.rpc('credit_referral_bonus', …)`
5. **Nettoyage data factice** : supprimer `INITIAL_BOOKINGS`, `INITIAL_INVOICES`, `INITIAL_TOKEN_HISTORY`, `DEMO_USER`, refs à `u_demo001`
6. **Trigger profil** : auto-créer `public.users` au signup + crédit 5 tokens via transaction `welcome` (source unique de vérité = `token_transactions`)
7. **Test du flow complet** : signup → email → login → 5 crédits → bon → décrément → facture → décrément → pack → ajout crédits → logout → relogin → données persistées

## 🟠 Phase 5 — Stripe

Suivre `guides/phase5_detaillee_debutant.md` :
- 4 produits Stripe (pack20, pack40, pack50, pack80) — un MCP Stripe est disponible (`mcp__…__create_product`, etc.)
- Edge Functions : `create-payment-intent` + `stripe-webhook`
- Secrets : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` côté serveur uniquement
- Branchement `PurchaseModal` avec `@stripe/stripe-js`
- Carte test : `4242 4242 4242 4242`
- ⚠️ **Facture côté backend** dans le webhook : numéro `TRP-2026-XXXX`, empreinte fiscale, TVA intracommunautaire

## 🟡 Phase 6 — Capacitor mobile

Suivre `guides/phase6_detaillee_debutant.md` :
- `npx cap init` → bundle `com.trajetpro.app`
- `npx cap add ios` + `npx cap add android`
- Permissions `Info.plist` + `AndroidManifest.xml` (micro, locale, caméra)
- Icônes 1024×1024 + splash 2732×2732 → `npx capacitor-assets generate`
- Builds `.ipa` (Xcode, Mac requis) + `.aab` signé (Android Studio)
- ⚠️ **CRITIQUE** : keystore Android sauvegardé en 3 endroits (sinon plus jamais d'update)

## ⚙️ Stack technique

- **Frontend** : React 19 + Vite 6 + Capacitor 7
- **Backend** : Supabase (PostgreSQL + Auth + Edge Functions Deno)
- **Paiements** : Stripe (Test mode dev, Live prod)
- **Région Supabase** : West EU (Paris) — projet `olmhckwethdcxhvsrfie` (`trajetpro-prod`)
- **Bundle ID** : `com.trajetpro.app`

## 🎨 Charte graphique (NE PAS DÉVIER)

- Fond : `#0B0B0D` (noir profond)
- Doré principal : `#F4B942`
- Polices : **Fraunces** (titres) + **Plus Jakarta Sans** (corps)
- Style : minimaliste, premium, sombre
- Variables CSS dans `src/index.css` (`--tp-bg`, `--tp-gold`, `--tp-text`, etc.)

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

## 🛡️ Règles de sécurité non négociables

- **Jamais** de `STRIPE_SECRET_KEY` ni de `SUPABASE_SERVICE_ROLE_KEY` côté client
- **RLS activée** sur toutes les tables (déjà fait phase 2)
- **Validation backend** sur achat tokens et facturation
- JWT vérifié sur les Edge Functions (sauf `verify-siret` et `stripe-webhook`)

## 📜 Conformité française

- **Décret 2017-483** : bons avec SIRET, n° VTC, carte pro, immatriculation, modèle véhicule
- **CGI** : factures numérotation chronologique sans rupture, empreinte fiscale, QR code
- **TVA** : 10% transport personnes, auto-liquidation UE hors-FR
- **RGPD** : politique de confidentialité, droit à l'effacement, hébergement EU

## 📐 Règles de travail

1. **Lis App.jsx en entier avant de modifier** quoi que ce soit (3649 lignes mais cohérent).
2. **Phase par phase** : ne pas attaquer la N+1 avant d'avoir testé la N.
3. **Commits Git réguliers** avec format : `feat: Phase X.Y - description` / `fix: …` / `refactor: …`.
4. **Tag les versions** : `v0.4.0` après Phase 4, `v0.5.0` après Phase 5, etc.
5. **Changelog** : maintenir `docs/CHANGELOG.md` au fur et à mesure.
6. **Décisions non triviales** : proposer 2-3 options avec pros/cons avant de choisir.
7. **Cohérence données** à vérifier systématiquement :
   - `users.token_balance` = `SUM(token_transactions.tokens_delta)` pour ce user
   - Numérotation factures continue (pas de saut)
   - Pas de bons orphelins (`user_id` invalide)
8. **Ce que tu ne peux pas faire** (Apple Developer, Google Play, builds Mac/Xcode) → `TODO_HUMAN.md`.
9. **Si bloqué** → `BLOCKERS.md` + continue sur autre tâche.

## 🛠️ Outils MCP disponibles

- **gitnexus** (`mcp__gitnexus__*`) : navigation knowledge graph du code (utiliser pour `query`, `context`, `impact` avant de modifier des symboles).
- **Supabase** (`mcp__…__execute_sql`, `apply_migration`, `deploy_edge_function`, `get_advisors`, etc.) : interaction directe avec le projet `olmhckwethdcxhvsrfie`.
- **Stripe** (`mcp__…__create_product`, `create_price`, `list_products`, etc.) : création des packs et configuration paiements.

## 💬 Style

- Français uniquement.
- Vulgariser le jargon technique pour l'utilisateur.
- Expliquer le **pourquoi** des choix.
- Honnête : si une partie du design est mauvaise, le dire avec une alternative.
- Ne pas se plaindre des bugs existants — les corriger sereinement.

## 🗂️ Fichiers de tracking à maintenir

- `docs/CHANGELOG.md` — historique des changements
- `TODO_HUMAN.md` — actions humaines requises
- `BLOCKERS.md` — blocages en cours
- `docs/ARCHITECTURE.md` — schéma technique
- `docs/DEPLOYMENT.md` — procédure de mise en prod
- `docs/TROUBLESHOOTING.md` — bugs connus + solutions

---

**Allez, on s'y met.** 🚀
