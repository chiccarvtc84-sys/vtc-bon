# 👤 TODO HUMAN — Actions qui demandent **toi** (pas Claude Code)

Ce fichier liste tout ce que je ne peux pas automatiser et que tu dois faire
toi-même. Chaque entrée a une **priorité** et un **lien** vers le contexte.

---

## 🔴 Bloquants pour tester la Phase 4

### 1. Tester le flow signup → confirmation email → login
**Pourquoi humain :** Supabase envoie un vrai email de confirmation, je n'ai pas
de boîte mail.

**Comment tester :**
1. `npm --prefix trajetpro run dev` (déjà lancé pour toi en preview port 5174,
   ou tu peux le relancer toi-même).
2. Va sur http://localhost:5173 (ou 5174 selon le port disponible).
3. Clique "Créer un compte".
4. Remplis le formulaire avec :
   - **Un vrai email à toi** (le compte démo `contact@trajetpro.fr` n'existe
     plus, et Supabase Auth bloquera les emails fictifs).
   - SIRET valide et VTC : utilise le tien (`832 456 789 00012` est dans
     `DRIVER_PROFILE` mais ce n'est pas forcément un SIRET valide INSEE — si
     l'API verify-siret te renvoie une erreur, mets un vrai SIRET de chauffeur
     VTC actif).
   - Mot de passe ≥ 8 caractères.
   - (Optionnel) un code de parrainage si tu en as déjà un en base.
5. Clique "Créer le compte". Tu devrais voir l'écran "Vérifiez votre email".
6. Va dans ta boîte mail → clique sur le lien de confirmation Supabase.
7. Reviens sur l'app, clique "Aller à la connexion", connecte-toi.
8. Tu devrais voir 5 crédits affichés sur l'accueil.

**Ce qu'il faut vérifier :**
- [ ] Le profil apparaît bien dans `public.users` (Supabase Dashboard → Table
      Editor → `users`).
- [ ] Une ligne `welcome` avec `tokens_delta = 5` est dans `token_transactions`.
- [ ] Le solde `users.token_balance` est bien à 5.
- [ ] Si parrainage utilisé : 2 lignes `referral_bonus` (parrain +10, filleul +5).

### 2. Vérifier que `verify-siret` est bien déployée et fonctionnelle
**Pourquoi humain :** je ne peux pas tester un appel HTTP authentifié facilement
sans un user authentifié.

**Comment tester :**
1. Supabase Dashboard → Edge Functions → `verify-siret` doit être listée
   comme déployée.
2. Si manquante : suivre `guides/phase3_detaillee_debutant.md` étape de
   déploiement, ou m'envoyer un message pour que je redéploie.

---

## 🟠 Pour la Phase 5 — Stripe (avant que je puisse continuer)

### 3. Compte Stripe + clés API
**Pourquoi humain :** créer un compte Stripe demande une vérification d'identité.

**Étapes :**
1. https://dashboard.stripe.com/register → créer compte (mode Test pour dev).
2. Récupérer :
   - **Clé publique test** (`pk_test_…`) → à mettre dans `.env` :
     `VITE_STRIPE_PUBLIC_KEY=pk_test_…`
   - **Clé secrète test** (`sk_test_…`) → ne **pas** mettre dans `.env`,
     me la donner et je la déposerai dans les secrets Supabase via
     `mcp__…__deploy_edge_function` ou via le Dashboard.
3. (À la fin de la Phase 5) **Webhook signing secret** (`whsec_…`) — généré
   après la création du webhook dans le Dashboard Stripe. Idem secrets Supabase.

### 4. Choix d'une politique de remboursement
**Pourquoi humain :** décision business.

Pour les crédits achetés par carte :
- Option A : **non remboursables sauf bug** (politique stricte, claire en CGU).
- Option B : **remboursés sous 14 jours conformément à L221-18 du Code de la
  consommation**, sauf si crédits déjà consommés.

Je recommande **B** car obligatoire en France pour vente à distance — sauf
exception "service exécuté immédiatement" (art. L221-28). Dis-moi ton choix
pour rédiger les CGU.

---

## 🟡 Pour la Phase 6 — Build mobile

### 5. Compte Apple Developer
**Pourquoi humain :** demande paiement annuel ($99) + vérification d'identité.

- https://developer.apple.com/programs/enroll/
- Choisir "Individual" (pas "Organization") sauf si tu as une SAS/SARL.
- Bundle ID à pré-créer : `com.trajetpro.app`.

### 6. Compte Google Play Console
**Pourquoi humain :** paiement unique $25 + vérification.

- https://play.google.com/console/signup
- Créer une "App" avec package name `com.trajetpro.app`.

### 7. Mac avec Xcode pour build iOS
**Pourquoi humain :** Apple ne signe les `.ipa` que via Xcode sur macOS.

- Xcode 15+ requis (App Store sur macOS Sonoma+).
- Si tu n'as pas de Mac : Mac mini d'occasion (~600€), MacInCloud (location),
  ou GitHub Actions runner macOS (gratuit pour repos publics, payant pour privés).

### 8. Génération + sauvegarde du keystore Android
**Pourquoi humain :** **CRITIQUE** — perdre le keystore = impossible de
mettre à jour l'app sur Google Play, jamais.

**Procédure (à faire dans Android Studio quand on y arrivera) :**
1. Build → Generate Signed Bundle.
2. Create New keystore.
3. **Sauvegarder le `.jks` + le mot de passe dans 3 endroits différents :**
   - Disque dur externe chiffré.
   - Cloud chiffré (proton drive, tresorit, …).
   - Coffre-fort physique ou imprimé chez un proche de confiance.

Je peux t'aider à automatiser le build mais je ne peux pas faire la sauvegarde
multi-endroits à ta place.

### 9. Assets visuels : icône + splash screen
**Pourquoi humain :** design graphique = décision créative.

Faut produire :
- `assets/icon.png` → 1024×1024 px (logo TrajetPro sur fond doré ou noir).
- `assets/splash.png` → 2732×2732 px (logo centré sur fond `#0B0B0D`).

Si tu n'as pas envie de les faire toi-même :
- Figma + tutoriel (gratuit, 30 min).
- Fiverr / 5euros.com (un graphiste pour ~30€).
- Demande-moi de générer des prompts pour Midjourney / DALL-E.

Une fois les fichiers prêts, place-les dans `trajetpro/assets/`. Je lancerai
`npx capacitor-assets generate` pour produire toutes les tailles dérivées.

---

## 🟢 Phases 7-9 — Soumission aux stores (humain)

### 10. Screenshots optimisés pour les stores
Je peux t'aider à les capturer depuis le simulateur, mais il faut un vrai
simulateur ouvert (Mac requis pour iOS). Tailles obligatoires :

- **iOS** :
  - iPhone 6.7" : 1290×2796 (3 minimum)
  - iPhone 6.5" : 1242×2688 (3 minimum)
  - iPhone 5.5" : 1242×2208 (3 minimum)
- **Android** :
  - Phone : 1080×1920 ou 1080×2340 (2 à 8)
  - Feature graphic : 1024×500 (1 obligatoire)

### 11. Descriptions et traductions
- Description courte iOS (30 caractères max).
- Description longue (4000 caractères).
- Mots-clés App Store (100 caractères, séparés par virgules).
- Politique de confidentialité hébergée (URL publique nécessaire).

`docs/documents_legaux_trajetpro.md` contient déjà des bases. Je peux te
sortir un brouillon optimisé ASO si tu me donnes ton positionnement.

### 12. Beta testers TestFlight + Internal Testing
- TestFlight : inviter 5-10 chauffeurs VTC pour bêta privée (1-2 semaines).
- Internal Testing Google Play : idem côté Android.

---

## 🔵 Améliorations différées (pas urgent)

### 13. Migrer `KNOWN_DEVICES` (Map en mémoire) vers la table `device_fingerprints`
La table existe en DB mais n'est pas alimentée. Pour avoir un anti-fraude
device fingerprint persistant, il faut :
- Au signup, INSERT dans `device_fingerprints` (avec `accounts_count`).
- Au signup, vérifier si le fingerprint a déjà ≥ N comptes.

Ce n'est pas critique : pour l'instant, l'anti-fraude repose sur l'email
vérifié + SIRET INSEE + score de risque automatique côté SQL.

### 14. Réinstaller `gitnexus` proprement
Le segfault rencontré pendant le setup vient de l'install `--omit=optional`
(la dep native `tree-sitter-dart` n'est pas compilée). Pour le faire marcher :
- Installer Visual Studio Build Tools 2022 (workload "Desktop development with C++").
- Installer Python 3.11.
- `npm install -g gitnexus@latest` (sans `--omit=optional`).

### 15. ESLint + Prettier
Le `package.json` déclare `"lint": "eslint ."` mais aucune config ESLint
n'est présente. Si tu veux un lint propre :
- Demande-moi d'ajouter `eslint.config.js` et `.prettierrc`.

---

## 📝 Conventions

Quand tu as fait une action, raye-la avec `~~texte~~` ou supprime-la et
laisse une note dans `CHANGELOG.md`. Si une action soulève une question,
ajoute-la à `BLOCKERS.md` et je la traiterai à ma prochaine session.
