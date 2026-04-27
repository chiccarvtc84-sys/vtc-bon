# 🤖 Prompt complet pour Claude Code — Projet TrajetPro

> **À COPIER-COLLER ENTIÈREMENT dans Claude Code après avoir uploadé le ZIP du projet.**

---

## 🎯 CONTEXTE GLOBAL

Je m'appelle [TON PRÉNOM], chauffeur VTC indépendant à Sorgues (84). Je n'ai **aucune compétence technique** en programmation. J'ai travaillé pendant plusieurs semaines avec Claude (le chat) sur la création d'une application mobile de gestion VTC appelée **TrajetPro**, mais je suis bloqué sur l'intégration technique React + Supabase.

**Mon objectif :** finaliser entièrement l'application pour qu'elle soit fonctionnelle, branchée à Supabase, prête pour les builds mobiles (iOS + Android) et la mise en production.

**Tu as devant toi :**
- Le code source React complet (`App.jsx` ~3700 lignes)
- Le schema SQL Supabase complet (`SUPABASE_SCHEMA.sql`)
- 8 guides de chaque phase (`phase2` à `phase9`)
- Mes informations de configuration (voir section ci-dessous)

**Ta mission :** terminer le projet de A à Z, en respectant la conception existante, en livrant un repo Git propre, fonctionnel, déployable.

---

## 📋 MES INFOS DE CONFIGURATION

### Identité chauffeur (constante dans l'app)
```javascript
const DRIVER_PROFILE = {
  firstName: "Moi",
  lastName: "Conducteur",
  siret: "832 456 789 00012",
  vtcNumber: "EVTC084220001",
  proCardNumber: "VTC-84-2024-0428",
  vehiclePlate: "GT-482-AV",
  vehicleModel: "Mercedes Classe E",
  baseCity: "Sorgues (84)",
  vatRate: 10
};
```

### Constantes de l'app
```javascript
const INITIAL_TOKEN_BALANCE = 5;
const COST_BOOKING = 1;
const COST_INVOICE = 1;
const PACKAGES = {
  pack20: { tokens: 20, price: 2.00, label: "Pack Découverte" },
  pack40: { tokens: 40, price: 3.50, label: "Pack Essentiel" },
  pack50: { tokens: 50, price: 4.00, label: "Pack Confort" },
  pack80: { tokens: 80, price: 5.00, label: "Pack Pro" }
};
const REFERRAL_BONUS_REFERRER = 10;
const REFERRAL_BONUS_REFEREE = 5;
const MONTHLY_BONUS_TOKENS = 1;
```

### Stack technique
- **Frontend** : React 19 + Vite + Capacitor (iOS + Android)
- **Backend** : Supabase (Auth + PostgreSQL + Edge Functions)
- **Paiements** : Stripe (mode Test pour développement)
- **Région Supabase** : West EU (Paris)
- **Bundle ID** : `com.trajetpro.app`

### Charte graphique
- Fond : noir profond `#0B0B0D`
- Doré principal : `#F4B942`
- Polices : **Fraunces** (titres) + **Plus Jakarta Sans** (corps)
- Style : minimaliste, premium, sombre

---

## ✅ CE QUI EST DÉJÀ FAIT

### Phase 1 - Conception (100% ✅)
- Maquette React complète dans `App.jsx` (3700 lignes)
- Identité visuelle finalisée
- Système de tokens conçu
- Anti-fraude conçu (email + SIRET + device fingerprint)

### Phase 2 - Backend Supabase (100% ✅)
- Projet Supabase créé : `trajetpro-prod` (région Paris)
- Project ref : `olmhckwethdcxhvsrfie`
- 6 tables créées avec RLS activée :
  - `users`, `bookings`, `invoices`, `token_transactions`, `device_fingerprints`, `verification_codes`
- 4 RPC functions créées : `consume_tokens`, `credit_token_purchase`, `credit_monthly_bonus`, `credit_referral_bonus`
- Email confirmation activée

### Phase 3 - Anti-fraude (100% ✅)
- Table `blocked_email_domains` avec 400+ domaines jetables
- Fonction SQL `is_disposable_email()`
- Trigger `calculate_risk_on_signup()` qui calcule un score de risque automatique
- Rate limiting configuré
- Edge Function `verify-siret` déployée et fonctionnelle (valide SIRET via API gouv.fr)

### Phase 4 - Frontend connecté (50% ✅)
**FAIT :**
- Projet React Vite créé dans `trajetpro-app/`
- Toutes les dépendances installées (`@supabase/supabase-js`, `lucide-react`, `@capacitor/*`, etc.)
- Fichier `.env` configuré avec les clés Supabase
- Fichier `src/lib/supabase.js` créé avec les helpers
- Étape 8.1 : import Supabase ajouté dans App.jsx
- Étape 8.2 : `handleInitialSubmit` (inscription) branchée à Supabase
- Étape 8.3 : fonction `submit` (connexion) branchée à `supabase.auth.signInWithPassword`
- Étape 8.4 : récupération des données au démarrage avec `useEffect` + `loadUserData`
- Étape 8.5 : `onSaveBooking` (création bon) branchée à Supabase

**DÉJÀ CORRIGÉ EN COURS DE ROUTE :**
- Bug `isDisposableEmail` déclaré 2 fois → version locale supprimée
- Fonction `consume_tokens` recréée avec trigger automatique de synchronisation
- Trigger `trg_sync_token_balance` ajouté pour synchro auto solde ↔ transactions
- Recalcul du `token_balance` à partir de l'historique fait
- Fonction `credit_monthly_bonus` recréée avec protection anti-doublon (max 1/mois)
- Bug Luhn dans `verify-siret` corrigé (Luhn supprimé, INSEE valide)
- Filtre VTC élargi pour accepter codes APE 49.32, 49.39, 53.20, 49.41, 74.90, 82.99, 96.09

---

## ⏳ CE QUI RESTE À FAIRE (PAR ORDRE DE PRIORITÉ)

### 🔴 PRIORITÉ 1 — Finir Phase 4 (frontend Supabase)

#### 4.1 — Étape 8.6 : suppression et facturation à brancher à Supabase
Dans `App.jsx`, les fonctions `onDeleteBooking` et `onInvoiceBooking` utilisent encore `setState` localement. Il faut les remplacer par des appels Supabase (les versions à utiliser sont dans `guides/phase4_detaillee_debutant.md` étape 8.6).

#### 4.2 — Étape 8.7 : déconnexion (`onLogout`)
Doit appeler `supabase.auth.signOut()` puis nettoyer l'état local. Code disponible dans `guides/phase4_detaillee_debutant.md` étape 8.7.

#### 4.3 — Brancher l'achat de crédits au système Supabase + Stripe
Pour l'instant, le composant `PurchaseModal` utilise une logique factice. Il faut :
- En **dev** : utiliser le système actuel mais sauvegarder les transactions dans `token_transactions`
- En **prod** : intégrer Stripe via Edge Functions (voir Phase 5)

#### 4.4 — Brancher le parrainage
La fonction `onReferralValidate` doit appeler `supabase.rpc('credit_referral_bonus', ...)` au lieu de la simulation actuelle.

#### 4.5 — Nettoyer les données factices
Supprimer du code :
- `INITIAL_BOOKINGS`, `INITIAL_INVOICES`, `INITIAL_TOKEN_HISTORY` (lignes 68-95)
- `DEMO_USER` (ligne 198)
- Toutes les références à `u_demo001`

#### 4.6 — Auto-créer le profil dans `public.users` lors de l'inscription
Actuellement, quand un user s'inscrit via Supabase Auth, son profil n'est PAS créé automatiquement dans `public.users`. Il faut :
- Soit créer un trigger SQL `on_auth_user_created` qui copie auto dans `public.users`
- Soit faire l'INSERT côté React après le `signUp` réussi (déjà partiellement fait dans étape 8.2 mais à valider)
- ⚠️ Le profil doit recevoir 5 crédits initiaux via une transaction `welcome` dans `token_transactions` (pour respecter la "source unique de vérité")

#### 4.7 — Tester le flow complet
- Inscription → email confirmation → connexion → 5 crédits offerts → création bon → décrémentation → facturation → décrémentation → achat pack → ajout crédits → déconnexion → reconnexion → données toujours présentes

### 🟠 PRIORITÉ 2 — Phase 5 : intégration Stripe (paiements)

Suis le guide `guides/phase5_detaillee_debutant.md`.

À faire :
- Créer compte Stripe (test mode)
- Créer 4 produits (pack20, pack40, pack50, pack80)
- Créer Edge Function `create-payment-intent`
- Créer Edge Function `stripe-webhook`
- Configurer les secrets Stripe sur Supabase
- Configurer le webhook dans Stripe Dashboard
- Brancher le `PurchaseModal` côté React avec `@stripe/stripe-js`
- Tester un paiement avec carte test `4242 4242 4242 4242`

⚠️ **Important** : la facture Stripe doit être générée côté backend dans le webhook (numéro `TRP-2026-XXXX`, empreinte fiscale, TVA intracommunautaire si client hors-FR).

### 🟡 PRIORITÉ 3 — Phase 6 : build mobile natif

Suis le guide `guides/phase6_detaillee_debutant.md`.

À faire :
- Installer Capacitor proprement (déjà partiellement installé)
- `npx cap init` avec `com.trajetpro.app`
- `npx cap add ios` et `npx cap add android`
- Configurer `Info.plist` (permissions micro, locale, caméra)
- Configurer `AndroidManifest.xml` (permissions identiques)
- Générer les icônes 1024×1024 et splash screens 2732×2732 (j'ai uploadé `icon.png` et `splash.png` dans `assets/`)
- `npx capacitor-assets generate`
- Build Xcode (Mac requis pour iOS) → archive `.ipa`
- Build Android Studio → bundle `.aab` signé
- ⚠️ **CRITIQUE** : sauvegarder le keystore Android dans 3 endroits différents (sinon impossible de mettre à jour l'app plus tard)

### 🟢 PRIORITÉ 4 — Phases 7, 8, 9 : tests + soumission + lancement

Ces phases sont essentiellement administratives (Apple Developer Program, Google Play Console, screenshots, descriptions, beta testing). Je m'en occuperai personnellement avec les guides `phase7`, `phase8`, `phase9`.

**MAIS** tu peux préparer pour moi :
- Les screenshots optimisés depuis le simulateur (3 tailles iOS + 1 Android)
- La feature graphic Google Play (1024×500)
- Le fichier `release-notes.md` avec les changelogs

---

## 🔧 ENVIRONNEMENT DE TRAVAIL ATTENDU

Voici le repo final que j'attends de toi :

```
trajetpro/
├── README.md                              ← documentation projet
├── package.json                           ← deps front
├── vite.config.js
├── capacitor.config.ts
├── .env.example                           ← template clés (sans valeurs réelles)
├── .gitignore                             ← n'oublie pas .env, node_modules, dist
├── index.html
├── src/
│   ├── App.jsx                            ← code React principal NETTOYÉ
│   ├── main.jsx
│   ├── index.css
│   └── lib/
│       ├── supabase.js                    ← helpers Supabase
│       ├── stripe.js                      ← helpers Stripe (Phase 5)
│       └── utils.js                       ← fonctions utilitaires (générer fingerprint, etc.)
├── ios/                                   ← projet iOS Capacitor
├── android/                               ← projet Android Capacitor
├── supabase/
│   ├── functions/
│   │   ├── verify-siret/
│   │   │   └── index.ts                   ← déjà déployée
│   │   ├── create-payment-intent/
│   │   │   └── index.ts                   ← Phase 5
│   │   └── stripe-webhook/
│   │       └── index.ts                   ← Phase 5
│   └── migrations/
│       └── 20260427_initial_schema.sql    ← schema complet de la base
└── docs/
    ├── DEPLOYMENT.md                      ← comment déployer en prod
    ├── ARCHITECTURE.md                    ← schéma technique
    └── TROUBLESHOOTING.md                 ← bugs connus + solutions
```

---

## ⚠️ POINTS DE VIGILANCE IMPORTANTS

### Sécurité
- **Jamais** de clés Stripe ou Supabase Service Role côté client
- **Toujours** valider côté backend les opérations critiques (achat tokens, facturation)
- RLS activée sur **toutes** les tables
- Vérifier les permissions JWT sur chaque Edge Function

### Conformité française
- Bons de course conformes au **décret 2017-483** (mentions obligatoires : SIRET, n° VTC, carte pro, immatriculation, modèle véhicule)
- Factures conformes au **CGI** (numérotation chronologique sans rupture, empreinte fiscale, QR code)
- TVA à 10% pour transport de personnes (article 279 b sexies CGI)
- TVA intracommunautaire : auto-liquidation pour clients UE hors France
- RGPD : politique de confidentialité, droit à l'effacement, hébergement EU

### UX
- Toutes les actions critiques doivent avoir un **état de loading**
- Tous les formulaires doivent avoir une **validation côté client + serveur**
- Tous les messages d'erreur doivent être en **français clair** (pas de techno-blabla)
- L'app doit fonctionner en **mode hors-ligne** pour la consultation (pas la création)

### Performance
- Lazy-loading des images
- Code-splitting des modales lourdes
- Cache des données fréquemment consultées (recent customers)

---

## 📝 INSTRUCTIONS SPÉCIALES POUR TOI, CLAUDE CODE

1. **Lis d'abord TOUT** le fichier `App.jsx` pour comprendre l'architecture existante avant de modifier quoi que ce soit. Le code est dense mais cohérent.

2. **Respecte la charte graphique** : couleurs, polices, dimensions exactes. Pas d'innovation visuelle non demandée.

3. **Préserve toutes les fonctionnalités existantes** : dictée vocale, parsing intelligent, conformité décret, etc. Mon code de Phase 1 est volontairement riche, ne le simplifie pas.

4. **Travaille phase par phase** : finis la Phase 4 avant d'attaquer la 5. Test après chaque phase. Commits Git réguliers (`feat: Phase X.Y - description`).

5. **Documente tout dans des commits clairs** : je dois pouvoir comprendre chaque changement même 6 mois plus tard.

6. **Si tu rencontres une décision technique non triviale**, propose-moi 2-3 options avec pros/cons avant de choisir. Exemples :
   - "Faut-il un trigger SQL ou faire l'INSERT côté React ?"
   - "Stripe Elements ou Checkout hosted ?"
   - "Capacitor PWA ou app native pure ?"

7. **À chaque test réussi, fais un commit Git** avec un message clair. Tag les versions importantes (`v0.4.0` après Phase 4 finie, `v0.5.0` après Phase 5, etc.).

8. **Génère un changelog** dans `docs/CHANGELOG.md` au fur et à mesure.

9. **Vérifie systématiquement la cohérence des données** :
   - Solde `token_balance` doit toujours = SUM(tokens_delta) dans transactions
   - Numérotation factures sans saut
   - Pas de bons orphelins (sans user_id valide)

10. **Pour les choses que tu ne peux pas faire** (ex: créer compte Apple Developer, configurer Google Play Console, faire les builds Xcode sur Mac), liste-les dans un fichier `TODO_HUMAN.md` avec instructions claires pour que je m'en occupe.

---

## 🎯 LIVRABLES FINAUX ATTENDUS

À la fin de ton travail, je dois avoir :

1. ✅ Un **repo Git propre** que je peux push sur GitHub
2. ✅ Une **app React qui fonctionne en local** (`npm run dev` → tout marche)
3. ✅ Une **base Supabase fonctionnelle** avec migration SQL versionnée
4. ✅ Des **Edge Functions déployées** (verify-siret, create-payment-intent, stripe-webhook)
5. ✅ Des **builds mobiles prêts** :
   - Archive iOS uploadable sur TestFlight
   - Bundle Android uploadable sur Google Play Internal Testing
6. ✅ Une **documentation claire** pour que je puisse maintenir le projet seul ensuite
7. ✅ Un **fichier `TODO_HUMAN.md`** avec ce qu'il me reste à faire moi-même

---

## 💬 STYLE DE COMMUNICATION

- **Français** uniquement (je suis francophone)
- **Vulgarise** les termes techniques quand tu m'expliques quelque chose
- **Explique le pourquoi** des choix techniques importants
- **Ne te plains pas** des incohérences ou bugs du code existant — corrige-les sereinement
- **Sois honnête** : si tu vois qu'une partie de mon design est mauvaise, dis-le-moi (avec une alternative)

---

## 📞 SI TU ES BLOQUÉ

Si tu ne peux **vraiment** pas avancer (ex: il manque une info, une décision business est requise, un service externe est down) :

1. **Documente le blocage** dans `BLOCKERS.md`
2. **Liste les options** que tu envisages
3. **Recommande la meilleure**
4. **Continue** sur les autres tâches en attendant ma réponse

---

## ✨ DERNIÈRE NOTE

Ce projet représente plusieurs semaines de travail acharné de ma part. Je n'ai pas un budget illimité pour des freelances. **Tu es ma meilleure chance** de finir cette app et de la lancer.

Sois rigoureux, sois rapide, sois clair. Et si on y arrive, ça aidera des dizaines de chauffeurs VTC français à mieux gérer leur activité.

**Allez, on s'y met !** 🚀

---

*Fichiers fournis dans ce ZIP :*
- `App.jsx` : code React principal (à finir de migrer)
- `SUPABASE_SCHEMA.sql` : schéma complet de la base
- `guides/` : 8 guides détaillés des phases 2 à 9
- `assets/` : icônes et splash screens
- `.env.example` : template variables d'environnement
- `package.json` : dépendances frontend
