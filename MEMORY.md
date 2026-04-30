# 🧠 MEMORY.md — Mémoire vive du projet TrajetPro

> Ce fichier capture l'état réel du projet, les décisions prises, les bugs en cours et les pièges à éviter. À lire AVANT toute nouvelle session de travail. Complète `CLAUDE.md` (mission) sans le dupliquer.
>
> **Dernière mise à jour : 2026-04-30 (session debug auth + Stripe — résolus)**

---

## 🎯 État global en une phrase

**Le code est livré ET le flow Stripe est validé bout-en-bout en mode Test.** Le compte `test@test.fr` est passé de 10 à 60 crédits suite à un paiement réel via Stripe Checkout (Pack Confort 4€ → +50 crédits). Tout marche : auth, F5, login, paiement, webhook, crédit en base.

Reste : la bascule vers Stripe **Live mode** (création des produits Live + webhook Live + clé sk_live dans secrets) quand l'utilisateur sera prêt.

---

## 🌍 Environnement de travail (ce PC)

| Élément | Valeur | Note |
|---|---|---|
| OS | Windows 11 | |
| Node | v24.14.1 | OK |
| npm | 11.3.0 | OK |
| Git | 2.53 | OK |
| Chemin projet | `C:\Users\aslan\OneDrive\Bureau\Appli CLAUDE\trajet pro\trajetpro\` | ⚠️ Dans **OneDrive** — voir piège ci-dessous |
| Vite dev port | `http://localhost:5173/` | |

### ⚠️ Piège n°1 : projet dans OneDrive

OneDrive synchronise les ~50 000 fichiers de `node_modules` et **verrouille les fichiers natifs** (.node binaires) pendant la sync. Conséquences :
- Erreurs **EPERM** lors des `npm install` impliquant des modules natifs (sharp, tree-sitter, esbuild)
- HMR Vite peut se comporter étrangement
- `gitnexus analyze` plante (segfault tree-sitter)

**Recommandation persistante** : déplacer le projet vers `C:\Dev\trajetpro\` (hors OneDrive). Pas urgent mais à faire.

### ⚠️ Piège n°2 : gitnexus ne s'installe pas

`npx gitnexus analyze` plante systématiquement (npm cache erreurs + segfault tree-sitter). Documenté dans `BLOCKERS.md` § B-0. **Non bloquant** pour TrajetPro — on s'en passe via Grep/Read directement.

### ⚠️ Piège n°3 : MCP Stripe ≠ compte Stripe utilisateur

Le MCP Stripe disponible dans cette session est branché à un **compte sandbox Anthropic** (`acct_1TPbCvGYVtGQnVrZ`, display name "Environnement de test Mans Project") — **PAS au compte Stripe de l'utilisateur**.

**Conséquence** : tout ce qui doit être créé chez Stripe pour TrajetPro (produits, prix, webhook) doit être fait par l'utilisateur **manuellement via son Dashboard Stripe**. Le MCP ne sert qu'à de la lecture / inspection.

Le compte de l'utilisateur a pour préfixe `acct_1TPbCh...` (vu via la clé `sk_live_51TPbCh…` qu'il avait initialement collée — clé qu'il a normalement régénérée pour des raisons de sécurité).

---

## 🔧 Bugs résolus dans cette session

### Bug 1 — F5 déconnecte / login spinner infini (LE PIRE)

**Symptôme** : ouvrir `localhost:5173` connecte automatiquement, mais F5 envoie sur l'écran welcome. Tentative de reconnexion → spinner infini sans erreur dans la console.

**Cause racine — deadlock supabase-js** :
- Le callback `onAuthStateChange` était `async` et `await`-ait `loadUserData(...)`
- `loadUserData` fait des requêtes `supabase.from('users').select()` qui ont besoin du verrou auth interne du SDK
- `getSession()` (qui tourne en parallèle au démarrage) tient ce même verrou
- Comme le SDK attend la fin du callback `onAuthStateChange` AVANT de relâcher le verrou, et que le callback attend la fin des requêtes (qui attendent le verrou) → deadlock complet
- Référence : https://github.com/supabase/supabase-js/issues/580

**Fix** : ne JAMAIS `await` directement dans `onAuthStateChange`. Déférer le travail async via `setTimeout(..., 0)` :
```js
onAuthStateChange((event, session) => {  // ← PAS async
  if (event === 'SIGNED_IN' && session?.user) {
    setIsGuest(false);
    const userId = session.user.id;
    setTimeout(async () => {  // ← le travail async sort du callback
      const ok = await loadUserData(userId);
      if (mounted && ok) setAuthScreen(null);
    }, 0);
  }
});
```

### Bug 2 — `signOut()` laissait le localStorage piégé

**Symptôme** : déconnexion + fermeture rapide de l'onglet → à la réouverture, l'utilisateur était toujours "logged in" sur l'ancienne session (token JWT pas effacé synchroniquement par le SDK).

**Fix** : purge synchrone des clés `sb-*` et `supabase*` du localStorage AVANT l'appel async à `supabase.auth.signOut({ scope: 'local' })`. Garantit qu'au prochain reload, `getSession()` retourne null même si on a fermé la tab pendant l'appel async.

### Bug 3 — `createCheckoutSession` masquait l'erreur Stripe (`"Paiement impossible : {}"`)

**Cause** : `error.context.body` retourné par supabase-js v2.45 est un `ReadableStream`, pas un objet. `JSON.stringify(stream)` donne `"{}"`. Le frontend affichait donc `{}` au lieu du vrai message Stripe.

**Fix** : lire le body via `error.context.text()` puis parser le JSON. Surfacer aussi les champs verbose (`detail`, `stripe_code`, `stripe_type`, `stripe_status`).

### Bug 4 — HomeScreen affichait "Moi" même connecté

**Cause** : `HomeScreen` ne recevait pas `currentUser` en props et utilisait `DRIVER_PROFILE.firstName` (valeur en dur).

**Fix** : passer `currentUser` en prop, utiliser `currentUser?.name?.split(' ')[0] || DRIVER_PROFILE.firstName`.

### Bug 5 — `signIn` bloquait sur `credit_monthly_bonus`

**Symptôme** : login restait sur le spinner sans erreur. Logs Supabase montraient le 200 OK du POST `/token`, puis... rien.

**Cause** : après `signInWithPassword`, `signIn()` appelait `supabase.rpc('credit_monthly_bonus', ...)` et `await`-ait le résultat. Cet appel se mettait en attente du verrou auth (cas spécifique du multi-instance HMR Vite).

**Fix** : retirer cet appel de `signIn`. Le bonus mensuel est de toute façon appelé dans `loadUserData`, donc rien n'est perdu.

### Bug 6 — HMR Vite créait plusieurs instances du client supabase

**Cause** : à chaque édition de `src/lib/supabase.js`, Vite HMR rechargeait le module et créait un nouveau `createClient()`. Plusieurs `GoTrueClient` instances dans la page → contention sur le verrou auth.

**Fix** : singleton global stocké sur `globalThis['__trajetpro_supabase_client__']`. Si l'instance existe, on la réutilise au lieu d'en créer une nouvelle.

### Bug 7 — Race condition `loadUserData` / `setAuthScreen(null)`

**Cause** : `setAuthScreen(null)` était appelé AVANT `loadUserData` ne termine. L'utilisateur voyait l'app principale avec `currentUser=null` pendant la seconde de chargement, donc des valeurs `DRIVER_PROFILE` bidons.

**Fix** : `loadUserData` retourne maintenant `true`/`false` selon le succès. `setAuthScreen(null)` n'est appelé QUE si `ok === true`. Pendant le chargement, on affiche un **spinner doré "TrajetPro / Chargement…"** (utilisant `authChecked`).

### Bug 8 — Stripe `priceId` du mauvais compte ("No such price")

**Cause** : les `priceId` codés en dur (`price_1TQuQ...`) étaient dans le compte sandbox Anthropic, pas dans le compte Stripe de l'utilisateur. Quand Stripe vérifiait avec la clé de l'utilisateur, il ne trouvait pas les prix → erreur `resource_missing`.

**Fix** :
1. L'utilisateur a recréé les 4 produits dans son compte Stripe (en mode Test)
2. Nouveaux `priceId` mis à jour dans `create-checkout-session/index.ts` :
   - `price_1TRqnaGbkiwQlw6ADATVkH6n` (Pack Découverte 2€)
   - `price_1TRqo3GbkiwQlw6A3tgTqL0X` (Pack Essentiel 3,50€)
   - `price_1TRqoIGbkiwQlw6AmCOFcZH8` (Pack Confort 4€)
   - `price_1TRqoTGbkiwQlw6AhPoifOH8` (Pack Pro 5€)
3. Edge Function redéployée (version 6, ACTIVE)

### Bug 9 — `STRIPE_SECRET_KEY` était une clé Supabase, pas Stripe

**Cause** : l'utilisateur avait collé `sb_secret_0iI9S19FC3ZvOhGMmq31ww_VgZ8vIdV` (clé service_role Supabase) dans le secret `STRIPE_SECRET_KEY`. Format complètement différent (`sb_secret_…` vs `sk_test_…`). Confusion lors du copier-coller.

**Fix** : l'utilisateur a remis la vraie clé Stripe Test (`sk_test_…`) dans Supabase secrets. La fonction Edge a aussi un guard qui valide le préfixe et renvoie une erreur claire en cas de mauvaise clé.

### Bug 10 — Webhook absent dans le compte Stripe utilisateur

**Symptôme** : paiement Stripe Checkout réussi, retour sur l'app, mais pas de crédits ajoutés.

**Cause** : aucun webhook configuré dans le compte Stripe de l'utilisateur pour pointer vers notre Edge Function `stripe-webhook`. Stripe ne notifiait personne après les paiements.

**Fix** : l'utilisateur a créé un webhook Test dans son Dashboard Stripe :
- URL : `https://olmhckwethdcxhvsrfie.supabase.co/functions/v1/stripe-webhook`
- Events : `checkout.session.completed` + `payment_intent.payment_failed`
- Signing secret `whsec_...` mis dans Supabase secrets (`STRIPE_WEBHOOK_SECRET`)

**Validation** : le 2e paiement a déclenché le webhook, et `token_transactions` a une ligne `kind='purchase'`, `tokens_delta=50`, `invoice_number='TRP-2026-0001'`, `stripe_payment_intent_id='pi_3TRt5wGbkiwQlw6A1u189IPK'`. Solde passé de 10 à 60.

### Bugs cosmétiques résolus

- Warnings Vite `Duplicate key "price"` et `"distance"` dans `setFormInitial` → nettoyés (les valeurs par défaut redondantes ont été retirées)

---

## 🐛 Bugs connus restants (non bloquants)

### Schema drift sur la table `invoices`

La fonction `stripe-webhook` essaie probablement d'insérer dans des colonnes (`qr_code_data`, `payment_method`) qui **n'existent pas** dans la DB de prod (vérifié via `information_schema.columns`). L'insert échoue silencieusement, mais le crédit (`credit_token_purchase` RPC) fonctionne quand même.

**Conséquence** : la table `invoices` reste vide après les achats, mais les transactions sont bien tracées dans `token_transactions` avec leur `invoice_number`.

**À faire dans une session future** : aligner soit le code de la fonction `stripe-webhook` avec le schéma actuel de `invoices`, soit ajouter une migration qui ajoute les colonnes manquantes.

### Autres
- `BLOCKERS.md` § B-2 (clé publique Stripe à vérifier) — non bloquant
- `TODO_HUMAN.md` mentionne encore le vieux chemin `C:\Users\zalin\Desktop\…`
- Logs Supabase Edge Functions ne sont pas systématiquement visibles via MCP (`get_logs` retourne parfois vide même quand des appels sont faits)

---

## 💳 État Stripe (récap)

### Compte de l'utilisateur (`acct_1TPbCh...`) — TEST MODE

**Produits créés (par l'utilisateur)** :
| Pack | priceId Test | Montant | Tokens |
|---|---|---|---|
| pack20 (Découverte) | `price_1TRqnaGbkiwQlw6ADATVkH6n` | 2,00 € | 20 |
| pack40 (Essentiel) | `price_1TRqo3GbkiwQlw6A3tgTqL0X` | 3,50 € | 40 |
| pack50 (Confort) | `price_1TRqoIGbkiwQlw6AmCOFcZH8` | 4,00 € | 50 |
| pack80 (Pro) | `price_1TRqoTGbkiwQlw6AhPoifOH8` | 5,00 € | 80 |

**Webhook Test** : créé par l'utilisateur, pointe sur `https://olmhckwethdcxhvsrfie.supabase.co/functions/v1/stripe-webhook`. Listening events : `checkout.session.completed`, `payment_intent.payment_failed`.

**Secrets Supabase Edge Functions** :
- `STRIPE_SECRET_KEY` : `sk_test_…` (compte utilisateur)
- `STRIPE_WEBHOOK_SECRET` : `whsec_…` (signing secret du webhook ci-dessus)
- `SITE_URL` : `http://localhost:5173`

### ⚠️ Sécurité : clé Live exposée dans le chat (à confirmer rotée)

Au début de la session, l'utilisateur a collé sa clé `sk_live_51TPbCh...` dans la conversation. Je lui ai demandé de la **régénérer** immédiatement (Roll key dans Stripe Dashboard). **Statut à reconfirmer** à la prochaine session : la clé compromise doit être inactive.

### Bascule Live mode (à faire plus tard)

Quand l'utilisateur voudra encaisser de vrais clients :
1. Activer le compte Stripe en Live mode (validation business — compte déjà activé d'après son `sk_live_…` initial)
2. Recréer les 4 produits **en mode Live** (mêmes tarifs)
3. Récupérer les nouveaux `priceId` Live
4. Mettre à jour les `priceId` dans `create-checkout-session/index.ts`
5. Récupérer la `sk_live_…` dans Stripe Dashboard et la mettre dans Supabase `STRIPE_SECRET_KEY`
6. Créer un webhook **Live** dans Stripe Dashboard → mettre son `whsec_…` dans Supabase `STRIPE_WEBHOOK_SECRET`
7. Redéployer la fonction Edge `create-checkout-session`
8. Tester avec une vraie carte (pack à 2€)

---

## 🗄️ État de la base Supabase

Projet `olmhckwethdcxhvsrfie` (`trajetpro-prod`, région West EU - Paris).

### Utilisateurs en DB

| Email | Crédits | Note |
|---|---|---|
| `test@test.fr` | **60** (10 + 50 du test paiement) | Compte de test, mdp = `Test1234!` |
| `bidbuh22@gmail.com` | 5 | Compte test |
| `bidbuhh@gmail.com` | 5 | Compte test |

### Edge Functions actives

| Fonction | JWT | Version | Statut |
|---|---|---|---|
| `verify-siret` | non (anonyme OK) | 3 | ACTIVE |
| `create-checkout-session` | oui | **6** | ACTIVE — priceIds compte utilisateur, validation clé Stripe au démarrage |
| `stripe-webhook` | non (signature vérifiée) | 2 | ACTIVE |

### Tables (toutes avec RLS activée)

`users` · `bookings` · `invoices` · `token_transactions` · `device_fingerprints` · `verification_codes` · `blocked_email_domains`

### Schema réel de `invoices` (vérifié)

`id`, `user_id`, `booking_id`, `invoice_number`, `customer_name`, `amount_ht`, `amount_vat`, `amount_ttc`, `vat_rate`, `status`, `fingerprint`, `paid_at`, `issued_at`, `created_at`

⚠️ **PAS** de colonnes `qr_code_data`, `payment_method`, `customer_address`, `customer_email`, `vat_intra`, `vat_reverse_charge`, `pdf_url`, `cancelled_at` — la fonction webhook ou le code SQL de référence pourrait les attendre. Voir bug "Schema drift" ci-dessus.

---

## 🔑 Identifiants et endpoints utiles

```
Supabase project ref : olmhckwethdcxhvsrfie
Supabase URL         : https://olmhckwethdcxhvsrfie.supabase.co
Stripe account (MCP) : acct_1TPbCvGYVtGQnVrZ (sandbox Anthropic, pas l'utilisateur)
Stripe account (user): acct_1TPbCh... (compte réel TrajetPro, accès via Dashboard)
Bundle ID mobile     : com.trajetpro.app

Compte test app      : test@test.fr / Test1234!
```

---

## 📐 Décisions importantes prises pendant la session

1. **Ne pas réinstaller gitnexus** sans VS Build Tools — abandon temporaire.
2. **Ne pas déplacer le projet hors OneDrive** sans autorisation explicite.
3. **Ne pas modifier les secrets Supabase via MCP** — l'utilisateur les modifie via Dashboard.
4. **Bascule Stripe = manuelle via Dashboard** — l'utilisateur crée produits + webhook, je fais les swap dans le code.
5. **Garder la version verbose** de `create-checkout-session` (champs `detail`, `stripe_code`, etc.) car utile pour le support en prod ; pas vraiment de risque sécurité car ce sont des messages Stripe destinés à l'utilisateur final.

---

## 🎬 Reprise de session — checklist à faire en premier

```
□ Lis CLAUDE.md (mission)
□ Lis ce fichier MEMORY.md (état)
□ git status → vois ce qui n'est pas commité
□ git log -5 → vois les derniers commits
□ Demande à l'utilisateur quel est son objectif
□ Avant tout changement : npm run build pour vérifier que rien n'est cassé
```

---

## 🧹 À faire un jour (technique post-debug)

1. **Aligner `invoices` schema vs code webhook** — soit migration ajoutant colonnes manquantes, soit retrait des inserts qui plantent.
2. **Mettre à jour `docs/CHANGELOG.md`** avec une nouvelle entrée pour les fixes de cette session.
3. **Tag `v1.0.0`** quand le premier paiement Live aboutit.
4. **Nettoyer `TODO_HUMAN.md`** : enlever références à l'ancien chemin Windows, rayer ce qui est fait.
5. **Commit Vite warnings cleanup** déjà fait, mais **vérifier qu'il n'en reste pas** ailleurs dans `App.jsx`.
6. **Confirmer** que `sk_live_51TPbCh...` (clé exposée dans le chat) a bien été régénérée par l'utilisateur.

---

## 🛠️ Commandes utiles

```bash
cd "C:/Users/aslan/OneDrive/Bureau/Appli CLAUDE/trajet pro/trajetpro"

# Dev
npm run dev                # Vite dev server, http://localhost:5173/

# Build
npm run build              # Vite production build

# Capacitor
npm run cap:sync           # build + sync
npm run cap:android        # ouvre Android Studio
npm run cap:ios            # ouvre Xcode (⚠️ Mac requis)

# Reset complet node_modules
rm -rf node_modules package-lock.json && npm install
```

---

**Note pour l'IA** : tiens ce fichier à jour à chaque session significative. Garde-le **utile et concis**.
