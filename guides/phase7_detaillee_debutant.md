# 🧪 Phase 7 détaillée pour grand débutant — Tests beta

> **Durée réelle :** 2 à 5 heures étalées sur 1-2 semaines (beaucoup d'attente des retours testeurs)
>
> **Niveau de difficulté :** ⚠️⚠️ (moyen : clics dans App Store Connect et Play Console)
>
> **Objectif :** faire tester ton app à 10-20 vraies personnes AVANT de la publier au grand public pour détecter les bugs et améliorer l'expérience.

---

## 🎯 Pourquoi tester en beta ?

**Imagine un restaurant qui ouvrirait sans jamais faire goûter ses plats.** C'est ce que tu ferais si tu publiais directement.

**Les bénéfices :**
- **Détecter les bugs** que tu n'as pas vus
- **Améliorer les textes** qui ne sont pas clairs
- **Valider le parcours utilisateur** (est-ce intuitif ?)
- **Obtenir les premiers avis** pour améliorer avant le vrai lancement
- **Créer un groupe d'ambassadeurs** qui parleront de ton app

**Chiffre concret :** sur mes projets, 60-70% des bugs critiques sont découverts par les beta testeurs, pas par le développeur.

---

## 👥 Qui recruter pour tester ?

**Profil idéal (10-20 personnes) :**
- 5-10 **chauffeurs VTC** de ton réseau ou de groupes Facebook
- 2-3 **amis proches** (pour les retours honnêtes même embarrassants)
- 1-2 **experts** : ton comptable, un ami développeur si tu en as
- 1-2 **personnes pas du tout techniques** (grand-parent, enfant) pour tester l'ergonomie

**Où les trouver ?**
- Les 20-30 personnes qui ont répondu à ton questionnaire de validation marché (ils sont déjà intéressés !)
- Ton carnet de contacts WhatsApp
- Groupes Facebook : "Chauffeurs VTC France", "VTC Indépendants", groupes régionaux
- Forum VTC-Network

---

## 📅 Plan d'attaque sur 2 semaines

**Semaine 1 :**
- Jour 1 (1h) — Setup TestFlight iOS
- Jour 2 (1h) — Setup Test interne Google Play
- Jour 3 (1h) — Inviter les beta testeurs
- Jours 4-7 — Laisser tester (silence radio de ta part)

**Semaine 2 :**
- Jour 8 (30 min) — Relance des testeurs pour feedback
- Jours 9-11 (2-3h) — Corriger les bugs remontés
- Jour 12 (1h) — Déployer la v2 corrigée
- Jour 13-14 — Validation finale

---

# 📆 JOUR 1 — Setup TestFlight iOS (1h)

## Étape 1 — Vérifier que ton build iOS est disponible

1. Va sur **`appstoreconnect.apple.com`**
2. Connecte-toi avec ton Apple ID développeur
3. Clique **"Mes apps"**
4. Clique sur **"TrajetPro"**

Si tu ne vois pas encore ton app : retourne à la Phase 6 Étape 24 pour uploader l'archive.

## Étape 2 — Attendre le traitement du build

1. Dans ton app, clique sur l'onglet **"TestFlight"**
2. Tu vois ton build avec le statut **"Traitement"**
3. **Attends 15-60 min** que Apple traite ton binaire
4. Statut passe à **"Prêt pour tester"**

## Étape 3 — Compléter les informations de test

1. Clique sur ton build
2. Onglet **"Test Information"**
3. Remplis :
   - **Quoi tester** :
     ```
     Bonjour et merci de tester TrajetPro !

     Merci de tester ces fonctionnalités :
     1. Créer un compte et vérifier votre email
     2. Tester la dictée vocale sur le bouton microphone
     3. Créer un bon de course manuellement
     4. Émettre une facture
     5. Consulter la section "Gérer mes jetons" dans Profil
     6. Tester le parrainage en copiant votre code

     Dites-moi si :
     - Quelque chose n'est pas clair
     - Vous rencontrez un bug
     - Une fonctionnalité est manquante
     ```
   - **Informations** : `TrajetPro est une application pour chauffeurs VTC.`
   - **Email** : `contact@trajetpro.fr`

4. Clique **"Save"**

## Étape 4 — Activer les tests internes

1. Dans TestFlight, à gauche, clique **"Groupes de tests internes"**
2. Clique **"+"** → **"Créer un nouveau groupe"**
3. Nom : `Beta Interne TrajetPro`
4. Clique **"Créer"**

5. Dans le groupe, **"Testeurs"** :
   - Clique **"+"** → **"Ajouter des testeurs"**
   - Entre les emails de 2-3 personnes de confiance (toi-même, un proche)
   - ⚠️ Ces personnes doivent avoir un **Apple ID** (même perso)

6. **Builds** : coche ton build v1.0
7. Clique **"Sauvegarder"**

**Les personnes vont recevoir un email de TestFlight avec les instructions.**

## Étape 5 — Activer les tests externes (jusqu'à 10 000 testeurs)

1. **"Groupes de tests externes"** → **"+"**
2. Nom : `Beta Externe TrajetPro`
3. Clique **"Créer"**

4. Ajoute les testeurs par email
5. Coche ton build

6. ⚠️ **Avant que les testeurs externes puissent tester, Apple fait une review de ton build** (24-48h)
7. Après validation Apple, les testeurs reçoivent leur invitation

---

# 📆 JOUR 2 — Setup Test interne Google Play (1h)

## Étape 6 — Ouvrir Google Play Console

1. Va sur **`play.google.com/console`**
2. Connecte-toi
3. Clique sur **"Toutes les applications"** → **"Créer une application"**

4. Remplis :
   - **Nom** : `TrajetPro`
   - **Langue par défaut** : Français (France)
   - **Application ou jeu** : Application
   - **Gratuite ou payante** : Gratuite
   - **Coche** les 2 déclarations obligatoires
5. Clique **"Créer"**

## Étape 7 — Configurer les informations de base

Tu arrives sur un **tableau de bord** avec une longue liste de tâches à faire. Ne panique pas, on va les faire progressivement.

**Pour le test interne, il te faut MINIMUM :**

### 7.1 — Confidentialité des données

1. Menu de gauche → **"Contenu de l'application"** → **"Politique de confidentialité"**
2. Entre l'URL de ta politique : `https://trajetpro.fr/confidentialite.html`
3. Sauvegarder

### 7.2 — Accès à l'application

1. **"Contenu de l'application"** → **"Accès à l'application"**
2. Coche **"Toutes les fonctionnalités sont disponibles sans restrictions d'accès"** si ton app n'a pas de zone privée.
3. Sinon, fournis un compte de test : `demo@trajetpro.fr` / `Demo12345!`
4. Sauvegarder

### 7.3 — Annonces

1. **"Annonces"**
2. Coche **"Non, mon application ne contient pas d'annonces"**
3. Sauvegarder

### 7.4 — Évaluation du contenu (questionnaire)

1. **"Évaluation du contenu"** → **"Démarrer le questionnaire"**
2. Email : `contact@trajetpro.fr`
3. Catégorie : **"Entreprise - Finance - Productivité"**
4. Réponds "Non" à toutes les questions sur violence, drogue, contenu adulte, etc.
5. Soumets → tu obtiens une classification (probablement PEGI 3 / IARC équivalent)

### 7.5 — Public cible

1. **"Public cible"**
2. Coche uniquement **"18 ans et plus"**
3. Sauvegarder

### 7.6 — Sécurité des données

1. **"Sécurité des données"** → **"Démarrer"**
2. **Section "Collecte de données"** : oui, je collecte des données
3. Déclare les données (sois honnête, Google vérifie) :
   - **Nom et prénom** : requis, utilisé pour l'app et les factures
   - **Email** : requis, utilisé pour l'authentification
   - **Téléphone** : facultatif
   - **Adresse email** : requis pour communication
   - **Informations de paiement** : traité par Stripe, non stocké
4. **Chiffrement** : coche "Oui, les données sont chiffrées en transit"
5. **Suppression** : coche "Oui, les utilisateurs peuvent demander la suppression"
6. Sauvegarder

## Étape 8 — Créer la release interne

1. Menu de gauche → **"Test"** → **"Test interne"**
2. Clique **"Créer une release"**

3. **Upload le fichier .aab** :
   - Glisse-dépose `app-release.aab` (généré en Phase 6)
   - Attends l'upload + analyse (5-10 min)

4. **Nom de la release** : `v1.0.0-beta1`
5. **Notes de la release** :
   ```
   Première version beta de TrajetPro

   Merci de tester :
   - Inscription avec vérification email
   - Création de bons de course
   - Émission de factures
   - Dictée vocale
   ```

6. Clique **"Suivant"**
7. **Examiner la release** → **"Déployer pour les tests internes"**

## Étape 9 — Ajouter les testeurs

1. Dans **Test interne**, onglet **"Testeurs"**
2. Clique **"Créer une liste d'adresses e-mail"**
3. Nom : `Beta Testeurs TrajetPro`
4. Ajoute les emails Gmail de tes testeurs
5. Sauvegarder

6. **Copie le lien d'adhésion** (affiché en haut)
7. Ce lien sert à donner aux testeurs pour qu'ils s'inscrivent.

---

# 📆 JOUR 3 — Inviter les beta testeurs (1h)

## Étape 10 — Préparer l'email/message d'invitation

**Modèle pour les testeurs iOS :**

```
Salut [Prénom] !

Comme promis, voici l'accès beta à TrajetPro, l'app que je développe pour nous, les VTC.

📱 POUR INSTALLER :

1. Télécharge l'app "TestFlight" sur l'App Store :
   https://apps.apple.com/fr/app/testflight/id899247664

2. Ouvre l'email que tu vas recevoir de TestFlight
   (si tu ne le vois pas, regarde les spams)

3. Clique sur "Voir dans TestFlight"
4. Clique "Installer"

⏱️ Ça prend 2 minutes.

✅ CE QUE JE TE DEMANDE :
Utilise l'app pendant quelques jours pour tes courses réelles.
Puis dis-moi par WhatsApp :
- Qu'est-ce qui marche bien ?
- Qu'est-ce qui bug ou n'est pas clair ?
- Qu'est-ce qui manque ?

🎁 EN REMERCIEMENT :
Tu auras 100 crédits offerts (10€ de valeur) quand je lancerai la version définitive.

Merci énormément, ton avis est précieux !
```

**Modèle pour les testeurs Android :**

```
Salut [Prénom] !

Voici l'accès beta à TrajetPro pour Android :

📱 POUR INSTALLER :

1. Clique ce lien sur ton téléphone :
   [COLLER LE LIEN D'ADHÉSION GOOGLE PLAY]

2. Clique sur "Devenir testeur"
3. Attends 5-10 min, puis réinstalle TrajetPro depuis le Play Store
4. L'app va maintenant en version beta s'installer

Le reste comme ci-dessus.
```

## Étape 11 — Envoyer les invitations

1. WhatsApp tes 10-15 testeurs personnellement (ça marche 5x mieux qu'un email automatisé)
2. Attends leurs premières installations
3. Sur TestFlight / Play Console, tu peux voir qui a installé

## Étape 12 — Attendre sans stresser (4-7 jours)

Tes testeurs ont besoin de temps pour utiliser l'app et te faire des retours. **Laisse-les tranquilles 4-7 jours**, ne les harcèle pas.

Occupe-toi de ton entreprise pendant ce temps. 😊

---

# 📆 JOUR 8 — Relance pour feedback (30 min)

Après une semaine, relance gentiment ceux qui n'ont pas répondu :

```
Salut [Prénom] !

Juste un petit rappel : j'espère que TrajetPro t'a servi cette semaine.

Est-ce que tu pourrais me dire en 2-3 phrases :
- Est-ce que tu as créé au moins 1 bon de course avec ?
- Qu'est-ce que tu as aimé / pas aimé ?

Merci ! 🙏
```

## Collecte des retours

**Crée un simple tableau Excel/Google Sheets :**

| Testeur | Bug ? | Description | Priorité |
|---------|-------|-------------|----------|
| Marc | Oui | La dictée vocale ne comprend pas "Châteauneuf" | Haute |
| Sophie | Non | Pas de bug | - |
| Jean | Oui | Écran blanc après paiement | Haute |
| Laure | Non | Suggestion : ajouter l'option rapide "client habitué" | Moyenne |

## Classer les retours

**Les 3 catégories de retours :**

1. **🔴 Bugs bloquants** (écran blanc, crash, données perdues)
   → À corriger avant publication

2. **🟡 Améliorations UX** (bouton mal placé, texte peu clair)
   → À corriger si tu as le temps, sinon v1.1

3. **🟢 Suggestions de features** (nouvelles fonctionnalités)
   → Roadmap pour plus tard, pas maintenant

---

# 📆 JOURS 9-11 — Corriger les bugs (2-3h)

## Étape 13 — Prioriser les corrections

**Règle d'or :** tu ne DOIS corriger QUE les bugs bloquants avant publication. Les autres peuvent attendre la v1.1 qui sortira 2-4 semaines après.

## Étape 14 — Modifier le code

Ouvre VS Code et corrige les bugs listés. Teste localement avec `npm run dev`.

## Étape 15 — Rebuild et redéployer

```bash
# Bump la version
# Dans package.json : "version": "1.0.1"

# Dans Xcode : App → General → Build : 2
# Dans android/app/build.gradle : versionCode 2, versionName "1.0.1"

npm run build
npx cap sync

# iOS
npx cap open ios
# → Archive → Distribute → Upload

# Android
npx cap open android
# → Generate Signed Bundle

# Re-uploader sur App Store Connect et Play Console
```

## Étape 16 — Notifier les testeurs

```
Nouvelle version beta (1.0.1) disponible !

J'ai corrigé les bugs que vous avez remontés :
✅ Bug de la dictée vocale sur les noms avec accent
✅ Écran blanc après paiement

Mettez à jour TestFlight/Play Store et re-testez 🙏
```

---

# 📆 JOURS 12-14 — Validation finale

## Étape 17 — Check-list avant publication

- [ ] 10+ testeurs ont utilisé l'app
- [ ] Au moins 5 ont créé un bon de course
- [ ] Au moins 2 ont émis une facture
- [ ] Tous les bugs critiques sont corrigés
- [ ] Aucun crash rapporté dans les dernières 48h
- [ ] Les testeurs disent "oui, je recommanderais"

## Étape 18 — Demande de témoignages

Demande à tes testeurs satisfaits :

```
[Prénom], content que TrajetPro te plaise !

J'aurais une petite faveur : pourrais-tu me laisser un avis écrit de 2-3 phrases que je pourrai utiliser sur mon site ? Exemple :

"TrajetPro m'a fait gagner X heures par semaine. Super pratique pour ... - [Nom]"

Ça m'aiderait énormément pour lancer l'app auprès d'autres chauffeurs.

Merci encore ! 🙏
```

**Objectif :** collecter 5-10 témoignages écrits pour ton site web et ta communication de lancement.

---

## 🎉 Phase 7 terminée !

Tu as :
- ✅ Testé ton app sur TestFlight (iOS)
- ✅ Testé ton app en Test interne (Android)
- ✅ Reçu des retours de vrais utilisateurs
- ✅ Corrigé les bugs critiques
- ✅ Collecté des témoignages

**Tu as validé que ton app fonctionne vraiment avec de vrais utilisateurs.** Maintenant place à la publication officielle.

---

## 🚨 Dépannage

### "Mes testeurs ne reçoivent pas l'email TestFlight"

- Regarde dans leurs spams
- Vérifie que tu as ajouté la bonne adresse Apple ID (pas leur email pro)
- En dernier recours, utilise le lien d'invitation public de TestFlight

### "Google Play refuse mon build interne"

- Vérifie que tu as bien rempli TOUTES les sections "Contenu de l'application"
- La section "Sécurité des données" est la plus souvent cause de rejet

### "Mes testeurs se plaignent de bugs mais je ne les reproduis pas"

- Demande-leur une **capture d'écran** ou **vidéo**
- Demande le **modèle de téléphone** et **version OS**
- Crée un document avec les "configurations ayant des problèmes" pour mieux cibler

### "Aucun testeur ne répond"

- Relance individuellement sur WhatsApp (pas par email groupé)
- Propose un **appel de 5 min** pour avoir un feedback oral
- Propose un **cadeau plus gros** (carte cadeau 10€) à ceux qui laissent un retour écrit détaillé

---

## 🎓 Ce que tu as appris

- **Configuration complète d'App Store Connect**
- **Configuration complète de Google Play Console**
- **Gestion d'un programme beta**
- **Collecte et priorisation de feedbacks**
- **Itération produit** (le cycle : déployer → recueillir → améliorer)

**Phase 7 complète. La suite : la soumission officielle aux stores !** 🚀
