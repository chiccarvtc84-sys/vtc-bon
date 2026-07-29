# 🔄 Reprendre TrajetPro sur un autre ordinateur

Guide de reprise du projet sur une nouvelle machine (et/ou un autre compte
Claude Code). À lire en premier — `CLAUDE.md` contient ensuite tout le contexte
technique du projet.

---

## 1. Récupérer le code

```bash
git clone https://github.com/chiccarvtc84-sys/vtc-bon.git
cd vtc-bon
```

> Le dossier créé s'appelle `vtc-bon` (nom du dépôt GitHub) et contient
> directement `package.json` — il n'y a **pas** de sous-dossier `trajetpro`.

## 2. Installer les dépendances

Prérequis : **Node.js 20+** (https://nodejs.org).

```bash
npm install --legacy-peer-deps
```

> ⚠️ Le `--legacy-peer-deps` est **obligatoire** : conflit de peer dependency
> préexistant entre React 19 et `@capacitor-community/stripe`. Un `.npmrc` à la
> racine l'applique déjà automatiquement, le flag est une ceinture de sécurité.

## 3. Recréer le fichier `.env` ⚠️ ÉTAPE CRITIQUE

Le `.env` **n'est pas** sur GitHub (il est dans `.gitignore`, volontairement).
Sans lui, l'app se lance mais ne peut ni se connecter ni encaisser de paiement.

```bash
cp .env.example .env
```

Puis remplacer les placeholders par les vraies valeurs :

| Variable | Où la trouver |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API (clé `anon public`) |
| `VITE_STRIPE_PUBLIC_KEY` | Stripe → Développeurs → Clés API → **mode LIVE** (`pk_live_…`) |
| `VITE_REVENUECAT_API_KEY` | RevenueCat → Project settings → API keys → Apple (`appl_…`) |

Ces quatre clés sont **publiques** (elles finissent dans le code de l'app) : les
copier depuis les dashboards ne présente pas de risque. Les clés **secrètes**
(`sk_live_…`, service role, webhooks) ne vivent QUE dans Supabase → Edge
Functions → Secrets, et n'ont jamais à être recopiées ici.

Le plus simple reste de **copier le `.env` depuis l'ancien ordinateur**
(clé USB, message chiffré) — c'est plus rapide et évite les fautes de frappe.

## 4. Vérifier que tout démarre

```bash
npm run dev
```

Ouvrir http://localhost:5173 → l'écran d'accueil TrajetPro doit s'afficher.
Tester « Continuer sans compte » : si l'app fonctionne en mode invité, le build
est bon ; si la connexion échoue, c'est le `.env` Supabase.

## 5. Rebrancher les accès (comptes, pas fichiers)

Rien à installer, juste se reconnecter sur la nouvelle machine :

- **Supabase** — projet `olmhckwethdcxhvsrfie` (région Paris). Pour que Claude
  Code puisse lire/modifier la base, rebrancher le **connecteur MCP Supabase**.
- **Stripe** — mode LIVE.
- **RevenueCat** — projet TrajetPro.
- **App Store Connect / Apple Developer** — pour les builds et TestFlight.

## 6. Pour builder sur iPhone (Mac uniquement)

```bash
npm run cap:sync
npx cap open ios
```

Dans Xcode : onglet **Signing & Capabilities** → sélectionner le **Team**, puis
`Cmd + R`.

> ⚠️ `cap sync` régénère `android/app/capacitor.build.gradle`,
> `android/capacitor.settings.gradle` et `ios/App/Podfile`. Ces fichiers étant
> versionnés, ils créent régulièrement des conflits au `git pull`. Réflexe :
> `git stash` → `git pull origin main` → `npm run cap:sync`.

---

## Ce que le nouveau Claude Code ne saura PAS

`CLAUDE.md` (versionné) lui donne l'architecture, les règles métier et les
invariants issus de l'audit. En revanche, l'historique conversationnel et la
mémoire locale de l'ancienne machine ne le suivent pas. Les points à lui
signaler si besoin :

- L'état d'avancement de la publication App Store (cf. `TODO_HUMAN.md`).
- Le fait que la **prod Supabase est en avance sur `SUPABASE_SCHEMA.sql`** :
  toujours interroger la base réelle via MCP, jamais se fier au fichier.
- Les décisions listées dans la section « NE PAS RÉGRESSER » de `CLAUDE.md`.
