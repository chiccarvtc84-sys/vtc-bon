# 🍎 Guide pas-à-pas — Publier TrajetPro sur l'App Store (avec un Mac)

> **Pour Aslan** (sans aucune compétence tech)
> Ce guide te tient la main de A à Z une fois que tu as un Mac.
> Chaque étape : ce qu'il faut cliquer, ce qu'il faut taper, combien de temps ça prend.
>
> ⏱ **Temps total** : 4-6 heures de travail effectif, étalé sur 1-3 jours (à cause des temps de review Apple).

---

# 📋 Table des matières

| Partie | Quoi | Temps |
|---|---|---|
| **0** | Ce que tu dois avoir AVANT de commencer | 0 (vérification) |
| **1** | Préparer le Mac (Xcode + Cocoapods) | 30-45 min |
| **2** | Récupérer le projet sur le Mac | 10 min |
| **3** | Premier test sur le simulateur iPhone | 15 min |
| **4** | Configurer Xcode pour ton compte Apple | 10 min |
| **5** | Tester sur ton vrai iPhone | 15 min |
| **6** | Générer les 5 screenshots App Store | 45 min |
| **7** | Créer la fiche App Store Connect (en parallèle) | 30 min |
| **8** | Builder le `.ipa` (Archive) | 15 min |
| **9** | Uploader sur App Store Connect | 15 min |
| **10** | Remplir la fiche App Store complète | 45 min |
| **11** | Submit for Review | 5 min |
| **12** | Attendre la review Apple | 1-7 jours ⏸ |
| **13** | Si Approved : release ; si Rejected : corriger | 30 min |

---

# 🔍 Partie 0 — Ce que tu dois avoir AVANT de commencer

Avant de toucher au Mac, vérifie cette liste :

- [ ] **Compte Apple Developer Program** validé (99 €/an) — ✅ tu l'as déjà
- [ ] **Mac** (achat OU MacInCloud) avec :
  - [ ] macOS 14 (Sonoma) ou plus récent
  - [ ] Au moins 50 Go d'espace libre (Xcode pèse 30 Go)
  - [ ] Connexion Internet stable
- [ ] **Apple ID** avec lequel tu es enrôlé Developer (le même que `contact@trajetpro.fr` que tu as utilisé)
- [ ] **iPhone physique** (idéalement) pour tester avant de soumettre — peut être ton iPhone perso
- [ ] **Câble Lightning ou USB-C** pour relier l'iPhone au Mac
- [ ] **Sign in with Apple** opérationnel — ✅ tu l'as déjà testé
- [ ] **Privacy Policy URL** publique — ✅ tu l'as déjà : https://chiccarvtc84-sys.github.io/vtc-bon/privacy.html
- [ ] **Compte de test** dans ton app pour Apple Review : crée `apple-review@trajetpro.fr` avec ton mot de passe simple, mets-y 5+ tokens

📝 **Note** : si tu utilises **MacInCloud**, le délai de provisionnement est immédiat après paiement (~5 min). Choisis l'option "Pay-as-you-go 1 month" à 30 USD.

---

# 🖥 Partie 1 — Préparer le Mac (30-45 min)

## 🧠 Qu'est-ce qu'on installe ?

- **Xcode** : l'IDE officiel Apple pour compiler l'app iOS (gratuit, 30 Go)
- **Command Line Tools** : utilitaires bash (compilateur, git, etc.) — auto-installés avec Xcode
- **Cocoapods** : gestionnaire de dépendances iOS — Capacitor en a besoin

## ⏱ Étape 1.1 — Installer Xcode (20-30 min, télécharge en arrière-plan)

1. Sur le Mac, ouvre **Mac App Store** (icône bleue avec un "A" blanc)
2. Dans la barre de recherche en haut à gauche, tape **`Xcode`**
3. Clique sur l'app Xcode (icône bleue avec un marteau)
4. Clique **`Obtenir`** puis **`Installer`**
5. Tu valides avec ton mot de passe Apple ID si demandé
6. **L'install démarre** : ~30 Go à télécharger, peut prendre 30-60 min selon ta connexion

🍵 Pendant que ça télécharge, va te chercher un café et continue par les autres étapes ci-dessous.

## ⏱ Étape 1.2 — Pendant que Xcode télécharge : installer Homebrew

Homebrew, c'est le "Microsoft Store" du terminal Mac. On en a besoin pour Cocoapods plus tard.

1. Ouvre **Terminal** (Cmd+Espace, tape `terminal`, Entrée)
2. Copie-colle cette commande dans le Terminal et appuie Entrée :
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
3. On te demande ton mot de passe Mac → tape-le (rien ne s'affiche, c'est normal) → Entrée
4. Attends ~5 min que ça finisse
5. À la fin, le script affiche 2 commandes pour ajouter Homebrew au PATH. **Copie-colle ces 2 commandes** et lance-les (généralement `eval "$(/opt/homebrew/bin/brew shellenv)"`).

✅ Vérifie : tape `brew --version` → tu dois voir une version comme `Homebrew 4.x.x`.

## ⏱ Étape 1.3 — Installer Cocoapods

Toujours dans Terminal :

```bash
brew install cocoapods
```

Attends ~5 min.

✅ Vérifie : tape `pod --version` → tu dois voir une version comme `1.15.x`.

## ⏱ Étape 1.4 — Une fois Xcode installé — première ouverture

1. Ouvre Xcode (depuis le Launchpad ou Applications)
2. Une fenêtre **"Welcome to Xcode"** s'affiche
3. Une popup demande **"Install additional components"** → clique **`Install`** → mot de passe Mac
4. Attends ~5 min
5. Xcode est prêt

✅ **Vérification de la Partie 1** :
- [ ] Xcode 15+ ouvert sans erreur
- [ ] Terminal : `brew --version` fonctionne
- [ ] Terminal : `pod --version` fonctionne
- [ ] Terminal : `git --version` fonctionne (auto-installé avec Xcode)
- [ ] Terminal : `node --version` doit afficher v18+ (sinon `brew install node`)

---

# 📦 Partie 2 — Récupérer le projet sur le Mac (10 min)

## ⏱ Étape 2.1 — Cloner le repo GitHub

Dans Terminal :

```bash
cd ~/Documents
git clone https://github.com/chiccarvtc84-sys/vtc-bon.git
cd vtc-bon
```

⚠️ Si Git te demande des identifiants, c'est ton login GitHub (le compte `chiccarvtc84-sys`).

✅ Vérifie : `ls` affiche les dossiers `src`, `ios`, `android`, `supabase`, etc.

## ⏱ Étape 2.2 — Installer les dépendances JavaScript

```bash
npm install --legacy-peer-deps
```

Attends ~3-5 min (download de plusieurs centaines de paquets).

⚠️ `--legacy-peer-deps` est nécessaire car certains plugins Capacitor ont des conflits de peer deps (déjà documenté dans `MEMORY.md`).

## ⏱ Étape 2.3 — Builder le frontend

```bash
npm run build
```

Attends ~15 secondes. Tu dois voir `✓ built in X.XXs` à la fin.

## ⏱ Étape 2.4 — Synchroniser avec iOS

```bash
npx cap sync ios
```

Cette commande copie le bundle web dans le projet iOS et installe les plugins natifs.

## ⏱ Étape 2.5 — Installer les pods iOS (CRUCIAL pour Capacitor)

```bash
cd ios/App
pod install
```

Attends ~3-5 min.

⚠️ Si tu vois une erreur du genre `[!] CDN: trunk Repo update failed`, attends 30s et relance — c'est juste que CocoaPods met à jour son catalogue.

✅ **Vérification de la Partie 2** :
- [ ] Le dossier `ios/App/Pods/` existe et contient plein de sous-dossiers
- [ ] Le fichier `ios/App/App.xcworkspace` existe (c'est CE fichier qu'on ouvre, pas `.xcodeproj`)

---

# 🎮 Partie 3 — Premier test sur le simulateur iPhone (15 min)

## ⏱ Étape 3.1 — Ouvrir le projet dans Xcode

Toujours dans Terminal (toujours dans `ios/App`) :

```bash
open App.xcworkspace
```

⚠️ **TRÈS IMPORTANT** : ouvre `App.xcworkspace` (avec un `s`), **PAS** `App.xcodeproj`. Sinon Xcode ne charge pas les Pods et rien ne marche.

## ⏱ Étape 3.2 — Choisir un simulateur

Dans Xcode :

1. En haut au centre, à droite du nom "App", tu vois un dropdown qui affiche un appareil (par défaut souvent iPhone XX)
2. Clique sur ce dropdown → choisis **`iPhone 16 Pro Max`** (ou plus récent si dispo)

## ⏱ Étape 3.3 — Lancer l'app

1. En haut à gauche, clique sur le **gros bouton ▶ (Play)**
2. Xcode compile pendant 1-2 min (tu vois "Building...")
3. Le simulateur iOS s'ouvre dans une nouvelle fenêtre
4. L'app TrajetPro se lance automatiquement

✅ Tu dois voir l'écran d'accueil noir avec "TrajetPro" en grand doré.

## ⏱ Étape 3.4 — Tester rapidement

Dans le simulateur, fais un test minimal :

1. Clique **"Continuer sans compte"** → tu arrives sur l'écran d'accueil
2. Clique **"Nouveau bon vocal"** → la modal Voice s'ouvre (le micro ne marche pas en simulateur, c'est normal)
3. Clique **"Saisir manuellement"** ou **"Annuler"** → retour à l'accueil

🎉 Si ça marche, ton projet compile correctement sur Mac.

🔴 **Si ça plante avec une erreur** :
- "Cannot find module" → relance `npx cap sync ios && cd ios/App && pod install`
- "No team selected" → on règle ça dans la Partie 4 ci-dessous
- Autre erreur → copie-colle dans un message et je débogue

---

# 🔐 Partie 4 — Configurer Xcode pour ton compte Apple (10 min)

## 🧠 Pourquoi cette étape

Apple veut que **chaque app soit signée** avec ton compte développeur. Sans ça, impossible d'installer sur ton vrai iPhone, et impossible de soumettre.

## ⏱ Étape 4.1 — Ajouter ton Apple ID dans Xcode

1. Dans Xcode, clique sur le menu **`Xcode`** (en haut à gauche, à côté de la pomme)
2. Clique sur **`Settings...`** (ou `Preferences` selon ta version macOS)
3. Une fenêtre s'ouvre. Clique sur l'onglet **`Accounts`**
4. En bas à gauche, clique le bouton **`+`** → choisis **`Apple ID`** → **`Continue`**
5. Entre l'email + mot de passe de ton compte Developer (probablement `contact@trajetpro.fr`)
6. Si Apple t'envoie un code 2FA, entre-le

✅ Ton compte apparaît à gauche avec ton équipe (Team ID `CXQXB5DW9T` qu'on a vu en Partie A d'Apple Sign In).

🟦 **Ferme la fenêtre Settings** (clic sur la pastille rouge en haut à gauche).

## ⏱ Étape 4.2 — Sélectionner ton Team dans le projet

1. Dans Xcode, dans le panneau de gauche (le navigateur), tu vois un arbre de fichiers
2. Tout en haut, clique sur l'item bleu **`App`** (avec un picto Xcode)
3. Le panneau du milieu se met à jour avec les paramètres du projet
4. En haut, sélectionne l'onglet **`Signing & Capabilities`**
5. Dans la section **"Signing"** :
   - Coche **`Automatically manage signing`**
   - Dans le dropdown **`Team`** : choisis ton équipe (ton nom + Team ID)
6. Xcode télécharge automatiquement le profil de provisionnement

✅ **Tu dois voir** sous "Signing" :
- Provisioning Profile : `Xcode Managed Profile`
- Signing Certificate : `Apple Development`

🔴 **Si tu vois une erreur en rouge** :
- "Failed to register bundle identifier" → l'identifiant `com.trajetpro.app` est déjà pris ailleurs. Solution : change-le en `com.trajetpro.app1` (mais alors mets à jour la même chose dans la fiche App Store Connect).
- "No profiles for 'com.trajetpro.app' were found" → vérifie que ton compte Apple Developer est bien actif. Sinon, va sur https://developer.apple.com/account vérifier.

## ⏱ Étape 4.3 — Vérifier le Bundle Identifier

Toujours dans **Signing & Capabilities** :

- **Bundle Identifier** doit être : `com.trajetpro.app`
- Si c'est différent, **modifie-le** ici (il sera utilisé toute la vie de l'app, donc fais bien attention)

## ⏱ Étape 4.4 — Vérifier la version

1. Dans le même panneau, clique sur l'onglet **`General`** (à gauche de Signing)
2. Section **"Identity"** :
   - **Display Name** : `TrajetPro`
   - **Bundle Identifier** : `com.trajetpro.app` (déjà fait)
   - **Version** : `1.0.0` (ce que verront les utilisateurs)
   - **Build** : `1` (numéro interne, à incrémenter à chaque upload)

3. Section **"Deployment Info"** :
   - **iOS X.X** (Minimum Deployments) : laisse `15.0` ou `14.0` (Capacitor 7 par défaut)
   - **Device Orientation** : **uniquement** "Portrait" coché (Apple n'aime pas les apps qui prétendent supporter le paysage sans le faire)

4. Section **"App Icons and Launch Screen"** :
   - **App Icon** : doit afficher `AppIcon` (déjà géré par notre `npm run assets`)
   - **Launch Screen** : doit afficher `Splash` (idem)

✅ **Vérification de la Partie 4** :
- [ ] Tu vois ton nom dans Xcode → Settings → Accounts
- [ ] Signing & Capabilities → Team est sélectionné
- [ ] Aucune erreur rouge dans Signing
- [ ] General → Version 1.0.0, Build 1, Bundle `com.trajetpro.app`

---

# 📱 Partie 5 — Tester sur ton vrai iPhone (15 min)

## ⏱ Étape 5.1 — Brancher l'iPhone au Mac

1. Connecte ton iPhone au Mac avec un câble Lightning ou USB-C
2. Sur l'iPhone, une popup demande **"Faire confiance à cet ordinateur ?"** → **`Faire confiance`**
3. Tu valides avec ton code de déverrouillage iPhone

## ⏱ Étape 5.2 — Activer le mode développeur sur l'iPhone (iOS 16+)

⚠️ Sur iPhone récent (iOS 16+), tu dois explicitement activer le mode Developer :

1. Sur l'iPhone, **Réglages → Confidentialité et sécurité**
2. Tout en bas, **`Mode développeur`**
3. Active le toggle
4. Une popup demande **"Redémarrer l'iPhone"** → confirme
5. Après redémarrage, va re-activer le toggle (il revient désactivé après reboot)

## ⏱ Étape 5.3 — Sélectionner ton iPhone comme cible

Dans Xcode :

1. En haut au centre (le dropdown qu'on a utilisé pour le simulateur), clique
2. Cette fois, choisis ton **iPhone physique** (apparaît avec son nom, ex. "iPhone d'Aslan")

## ⏱ Étape 5.4 — Lancer sur l'iPhone

🟦 Clique sur le bouton ▶ (Play) en haut à gauche.

Xcode :
- Compile (~1 min)
- Installe l'app sur ton iPhone
- Lance l'app

🔴 **Si l'app refuse de se lancer sur l'iPhone** :
- Sur l'iPhone : **Réglages → Général → VPN et gestion d'appareil**
- Tu vois "Apple Development : ton.email@..."
- Clique → **`Faire confiance à "ton.email@..."`** → **`Faire confiance`**
- Retourne sur Xcode et relance ▶

## ⏱ Étape 5.5 — Tester les fonctions clés

Sur ton iPhone, vérifie :

- [ ] **Login** avec ton compte Apple via le bouton "Continuer avec Apple" → ça marche ?
- [ ] **Dictée vocale** : crée un bon, parle pendant 5 sec, vérifie l'extraction Gemini
- [ ] **Création de bon manuel** : remplis les champs, sauvegarde
- [ ] **Émission de facture** + **Téléchargement PDF**
- [ ] **Notifications** : crée un bon avec une heure dans 5 min, attends que la notification arrive
- [ ] **Biométrie** : Profil → Préférences → Facturation → active la biométrie → tu dois avoir un prompt Face ID

🎉 Si tout marche, **ton app fonctionne sur un vrai iPhone**.

✅ **Vérification de la Partie 5** :
- [ ] App installée et lancée sur ton iPhone
- [ ] Sign in with Apple marche en natif
- [ ] Dictée vocale + extraction Gemini marche
- [ ] Notifications de rappel arrivent

---

# 📸 Partie 6 — Générer les 5 screenshots App Store (45 min)

⚠️ Cette étape est **critique** : ce sont les premières choses que les utilisateurs voient sur l'App Store. Mauvais screenshots = pas de téléchargement.

## 🧠 Spec Apple

- **Format obligatoire iPhone 6.9"** : 1320 × 2868 px (portrait), PNG ou JPEG
- **Nombre** : 3 minimum, 10 maximum (recommandé : 5)
- Apple peut fallback automatique aux iPhone 6.5" si tu fournis seulement 6.9", donc **fais juste les 6.9"**

## ⏱ Étape 6.1 — Préparer le simulateur dans la bonne taille

1. Dans Xcode, retourne sur le simulateur iPhone 16 Pro Max (au lieu de ton iPhone physique)
2. Lance l'app avec ▶
3. Une fois l'app lancée, ferme la fenêtre Xcode (mais le simulateur reste ouvert)

## ⏱ Étape 6.2 — Figer la status bar à des valeurs propres

Apple veut une status bar propre dans les screenshots (pas "iPhone Simulator", pas une batterie à 87%). On la force avec une commande Terminal :

```bash
xcrun simctl status_bar booted override --time "9:41" --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3
```

Vérifie sur le simulateur : l'heure est figée à 9:41, batterie pleine, signal max. ✨

## ⏱ Étape 6.3 — Préparer un compte démo "joli"

Dans le simulateur :

1. Crée un nouveau compte test (`demo@trajetpro.fr` / mdp facile)
2. Ajoute 5 fausses courses (suggestions ci-dessous)
3. Émets 2-3 factures
4. Ne laisse aucun écran vide pendant les screenshots

### Suggestions de fausses courses

```
Course 1 : Karim Benali — Avignon TGV → Aéroport Marseille — 95 km — 130 €
Course 2 : Sophie Martin — Hôtel Mercure → Aéroport Marignane — 32 km — 65 €
Course 3 : Yacine Diallo — Sorgues → Avignon centre — 12 km — 22 €
Course 4 : Jean Dubois — Gare TGV → Aix-en-Provence — 78 km — 95 €
Course 5 : Aïcha Traoré — Vaucluse Hôtel → Avignon centre — 8 km — 18 €
```

## ⏱ Étape 6.4 — Capturer les 5 écrans (un par un)

Pour chaque écran, navigue dessus dans le simulateur, puis utilise **Cmd + S** pour capturer (le screenshot atterrit sur ton Bureau Mac).

### Capture 1 — Accueil

- Écran : Home avec le solde de tokens visible et "Nouveau bon vocal" en gros
- Action : Cmd + S → fichier `01-accueil.png` créé sur ton Bureau

### Capture 2 — Modal de dictée vocale

- Écran : Tu cliques "Nouveau bon vocal" → modal s'ouvre avec le micro
- Action : Cmd + S → `02-dictee.png`

### Capture 3 — Bon de course

- Écran : ouvre la course "Karim Benali" en détail (toutes les infos, conformité décret 2017-483)
- Action : Cmd + S → `03-bon-course.png`

### Capture 4 — Facture

- Écran : ouvre une facture émise
- Action : Cmd + S → `04-facture.png`

### Capture 5 — Liste des bons + total mensuel

- Écran : onglet "Bons" avec la liste de tes 5 fausses courses + total CA en haut
- Action : Cmd + S → `05-liste.png`

## ⏱ Étape 6.5 — Vérifier les dimensions

1. Sur le Bureau du Mac, clique-droit sur `01-accueil.png` → **Lire les informations**
2. Tu dois voir **Dimensions : 1320 × 2868**

Si la dimension est différente, c'est que tu n'as pas le bon simulateur. Refais avec iPhone 16 Pro Max.

## ⏱ Étape 6.6 — Optionnel : embellir avec previewed.app

Si tu veux des screenshots qui ont vraiment un look "premium" (avec frame d'iPhone autour, fond dégradé, slogan en haut) :

1. Va sur https://previewed.app
2. Choisis "iPhone 16 Pro Max - Portrait"
3. Upload un de tes 5 screenshots simulateur
4. Ajoute par-dessus :
   - Fond dégradé (or → noir, charte TrajetPro)
   - Slogan en haut (ex. "Vos bons en 5 secondes")
   - Sous-titre (ex. "Dictée vocale intelligente")
   - Frame iPhone automatique
5. Export en 1320 × 2868

Repete pour les 5 captures.

⏱ +30 min mais résultat 2x plus pro.

✅ **Vérification de la Partie 6** :
- [ ] 5 fichiers PNG sur ton Bureau Mac
- [ ] Dimensions : 1320 × 2868 chaque
- [ ] Status bar propre (9:41, batterie pleine)
- [ ] Pas de Lorem Ipsum, pas de placeholder visible

---

# 🌐 Partie 7 — Créer la fiche App Store Connect (45 min)

⚠️ **Tu peux faire cette partie depuis n'importe quel ordi (même Windows)** — pas besoin du Mac. Fais-la pendant que Xcode télécharge ou en parallèle.

## ⏱ Étape 7.1 — Créer l'app

1. Va sur https://appstoreconnect.apple.com
2. Login avec ton Apple ID Developer
3. Tout en haut, clique **`My Apps`** (ou `Mes apps`)
4. Clique le bouton bleu **`+`** → **`New App`**

5. Remplis le formulaire :
   - **Plateformes** : ✅ **iOS** (uniquement)
   - **Nom** : `TrajetPro · Bons VTC` (visible dans l'App Store, max 30 chars)
   - **Langue principale** : `French (France)`
   - **Bundle ID** : choisis `com.trajetpro.app (TrajetPro)` dans le dropdown
   - **SKU** : `trajetpro-ios-1` (identifiant interne de TON usage, jamais visible publiquement)
   - **User Access** : Full Access

6. Clique **`Create`**

✅ Tu arrives sur la page de configuration de l'app.

## ⏱ Étape 7.2 — Pricing & Availability (à gauche)

1. Dans le menu de gauche, clique **`Pricing and Availability`**
2. **Price** : `Free` (gratuit — les achats de tokens passent par Stripe externe)
3. **Availability** : choisis France + autres pays UE si tu veux
4. **App Distribution Methods** : laisse les valeurs par défaut

🟦 Clique **`Save`** en haut à droite.

## ⏱ Étape 7.3 — App Information

1. Menu de gauche → **`App Information`**
2. **Subtitle** (max 30 chars) : `Bons & factures VTC en 5s`
3. **Privacy Policy URL** : `https://chiccarvtc84-sys.github.io/vtc-bon/privacy.html`
4. **Category** :
   - Primary : `Business` (Économie et entreprise)
   - Secondary : `Productivity` (Productivité)
5. **Content Rights** : `No, it does not contain, show, or access third-party content`
6. **Age Rating** : clique **`Edit`** → réponds NON à toutes les questions (pas de violence, pas de contenu sexuel, etc.) → tu obtiens **4+**

🟦 **Save**.

## ⏱ Étape 7.4 — Localisation FR (la plus longue)

1. Menu de gauche → **iOS App 1.0.0** → tu vois ton premier "version"
2. Clique dessus

Tu arrives sur la page de cette version. Beaucoup de champs à remplir.

### a) Promotional Text (170 chars)

Modifiable sans review, donc utile pour des campagnes/changements rapides :

```
Vos bons de course VTC en 5 secondes par dictée vocale. Factures conformes décret 2017-483. Sans abonnement, RGPD français. 5 crédits offerts à l'inscription.
```

### b) Description (4000 chars)

Copie-colle depuis `submission/APP_STORE_MARKETING.md` la section "Description longue (max 4000 caractères)".

### c) Keywords (100 chars)

```
VTC,bon de course,facture,chauffeur,taxi,course,décret,SIRET,dictée,vocale,Stripe
```

⚠️ Pas de mots-clés concurrents (Uber, Bolt) — risque de rejet.

### d) Support URL

```
https://chiccarvtc84-sys.github.io/vtc-bon/
```

### e) Marketing URL (optionnel)

Pareil que Support URL, ou laisse vide.

## ⏱ Étape 7.5 — App Privacy

⚠️ **OBLIGATOIRE depuis 2020**.

1. Menu de gauche → **App Privacy**
2. Clique **`Get Started`** ou **`Edit`**
3. Tu dois déclarer chaque type de donnée collectée

Suis le tableau dans `submission/APP_STORE_MARKETING.md` § "App Privacy → Data Types collected" :

| Type | Collecté ? | Lié à user ? | Tracking ? |
|---|---|---|---|
| Email | ✅ | ✅ | ❌ |
| Nom | ✅ | ✅ | ❌ |
| Téléphone | ⚠️ Optionnel | ✅ | ❌ |
| Adresse | ⚠️ Optionnel | ✅ | ❌ |
| User ID | ✅ | ✅ | ❌ |
| Achats | ✅ | ✅ | ❌ |
| Historique financier | ✅ | ✅ | ❌ |
| Identifiants device | ✅ | ✅ | ❌ |
| Diagnostic | ✅ | ❌ | ❌ |

Pour CHAQUE type oui :
- Type → choisis l'item dans la liste
- Linked to identity ? → Yes
- Used for tracking ? → No
- Purpose : `App Functionality`

🟦 **Save**.

## ⏱ Étape 7.6 — App Review Information

Dans la même page de version, scrolle jusqu'à **App Review Information** :

### Sign-In Information (CRUCIAL)

⚠️ Apple va se connecter pour tester. Si tu fournis un mauvais compte, **rejet quasi-certain**.

- **User name** : `apple-review@trajetpro.fr`
- **Password** : ton mot de passe simple pour ce compte de test (note-le aussi pour toi)

⚠️ Avant de soumettre, **vérifie que ce compte existe et fonctionne** dans ton app. Si tu ne l'as pas créé, fais-le maintenant.

### Notes (optionnel mais recommandé)

```
Bonjour,

TrajetPro est une application de gestion pour chauffeurs VTC indépendants français.

Pour tester :
1. Connectez-vous avec apple-review@trajetpro.fr / [le mot de passe]
2. Le compte démarre avec 5 crédits offerts
3. Tapez "Nouveau bon" → testez la dictée vocale (en français : "Je récupère monsieur Karim à la gare d'Avignon, je le dépose à Marignane, 95 km, 130 euros")
4. Visualisez le bon créé, puis émettez la facture associée

L'app fonctionne aussi en mode invité (sans connexion) — bouton "Continuer sans compte" sur l'écran d'accueil.

Permissions demandées et leur usage :
• Microphone : dictée vocale des bons de course (Web Speech API)
• Reconnaissance vocale : transcription locale + extraction IA via Gemini
• Notifications : rappels T-3h / T-1h / T-15min avant chaque course
• Face ID : authentification biométrique optionnelle

Aucun contenu généré utilisateur n'est partagé publiquement.
Les paiements de crédits passent par Stripe Checkout (paiement web externe).

Merci pour votre review.
```

### Contact Information

- **First Name** : Aslan
- **Last Name** : Souleymanov
- **Phone** : ton numéro
- **Email** : `contact@trajetpro.fr` (ou un email valide où tu lis tes mails)

🟦 **Save**.

## ⏱ Étape 7.7 — Uploader screenshots & icon

Toujours sur la page de version, clique l'onglet **`iOS App`** dans la barre du haut (à gauche de "App Information").

### App Icon

1. Section **App Icon** → Drag-drop le fichier `submission/store-graphics/appstore-icon-1024.png`
2. Ou clique "Choose File" → sélectionne-le

### Screenshots iPhone 6.9"

1. Section **iPhone 6.9" Display**
2. Drag-drop tes 5 fichiers (`01-accueil.png` à `05-liste.png`) dans l'ordre
3. Tu peux les réorganiser en les drag-dropant

⚠️ Apple n'accepte les fichiers QUE si la résolution est exacte. Si erreur, vérifie 1320 × 2868.

🟦 **Save** (bouton en haut à droite, devient bleu quand ya des changements).

✅ **Vérification de la Partie 7** :
- [ ] Fiche App Store Connect créée
- [ ] Subtitle, Description, Keywords remplis (FR)
- [ ] App Privacy déclarée (table complète)
- [ ] App Review Information avec login démo + notes
- [ ] App Icon 1024×1024 uploadée
- [ ] 5 screenshots 1320×2868 uploadés

---

# 🛠 Partie 8 — Builder le `.ipa` (Archive) (15 min)

C'est l'étape "publication" finale, à faire sur le Mac dans Xcode.

## ⏱ Étape 8.1 — Sélectionner "Any iOS Device"

Dans Xcode, en haut au centre (dropdown du device cible) :

1. Clique le dropdown
2. Choisis **`Any iOS Device (arm64)`** (PAS un simulateur, PAS ton iPhone)

⚠️ Si tu choisis un simulateur ou ton iPhone, l'option "Archive" sera grisée.

## ⏱ Étape 8.2 — Lancer l'Archive

Dans le menu Xcode tout en haut (à côté de la pomme) :

1. Menu **`Product`** → **`Archive`**
2. Xcode démarre la compilation pour distribution
3. Attends 5-15 min (selon la taille du Mac)

Tu peux suivre la progression dans le panneau de droite (Activity).

## ⏱ Étape 8.3 — L'Organizer s'ouvre

Quand l'archive est finie, une fenêtre **`Organizer`** s'ouvre automatiquement :

- Tu vois ton archive `App` avec aujourd'hui en date
- Version : 1.0.0
- Build : 1

🟦 **Sélectionne** ton archive (clique dessus).

🔴 **Si l'Organizer ne s'ouvre pas tout seul** : menu **`Window`** → **`Organizer`**.

🔴 **Si tu vois des erreurs** :
- "Code signing failed" → retour Partie 4 vérifier le Team
- "Provisioning profile error" → fais un cmd-shift-K (Clean) puis relance
- Autres → décris-moi l'erreur, je débogue

✅ **Vérification de la Partie 8** :
- [ ] Archive réussie sans erreur
- [ ] Organizer affiche ton archive avec version 1.0.0 build 1

---

# 📤 Partie 9 — Uploader sur App Store Connect (15 min)

Toujours dans Xcode Organizer (avec ton archive sélectionnée).

## ⏱ Étape 9.1 — Distribute App

🟦 À droite, clique le bouton bleu **`Distribute App`**.

## ⏱ Étape 9.2 — Choisir App Store Connect

1. Une popup demande "How would you like to distribute your app?"
2. Choisis **`App Store Connect`** → **`Next`**

## ⏱ Étape 9.3 — Upload

1. Choisis **`Upload`** (PAS Export, PAS Generate IPA)
2. **`Next`**
3. Coche les options par défaut :
   - ✅ Upload your app's symbols to receive symbolicated reports from Apple
   - ✅ Strip Swift symbols
4. **`Next`**
5. Code signing : **`Automatically manage signing`** → **`Next`**

Xcode prépare l'upload (~30 sec).

6. Une page récap s'affiche → **`Upload`**

## ⏱ Étape 9.4 — Attente

L'upload prend 5-10 min selon ta connexion. Tu vois une barre de progression.

À la fin, tu vois un check vert **"App uploaded to App Store Connect"** → **`Done`**.

## ⏱ Étape 9.5 — Vérifier dans App Store Connect

1. Va sur https://appstoreconnect.apple.com → ton app
2. Onglet **TestFlight** → tu dois voir ton build "Processing" (~10-30 min)
3. Quand ça passe à **"Ready to Submit"**, tu peux passer à l'étape suivante

⚠️ Si tu vois des warnings dans l'email Apple ("ITMS-90XXX"), lis-les. Souvent c'est un avertissement non-bloquant. Si c'est bloquant, l'upload sera rejeté.

✅ **Vérification de la Partie 9** :
- [ ] Upload Xcode terminé sans erreur
- [ ] Build apparaît dans App Store Connect → TestFlight
- [ ] Status passé à "Ready to Submit"

---

# 📝 Partie 10 — Remplir la fiche App Store Connect complète (45 min)

Maintenant que ton build est uploadé, on finalise la fiche.

## ⏱ Étape 10.1 — Sélectionner le build dans la version

1. App Store Connect → ton app → onglet **`App Store`** (haut de la page)
2. Cherche la section **`Build`** → bouton **`Select a Build`** ou icône **+**
3. Choisis ton build qui vient d'arriver (1.0.0 - 1)
4. **`Done`**

## ⏱ Étape 10.2 — Vérifier que tout est en ✅ vert

Sur le côté gauche de la page de version, tu as une checklist :

- ✅ App Information
- ✅ Pricing and Availability
- ✅ App Privacy
- ✅ Subtitle, Description, etc.
- ✅ Build sélectionné
- ✅ Screenshots
- ✅ App Review Information

⚠️ Si une section est en ❌ rouge ou ⚠️ orange, clique dessus, complète, sauvegarde.

## ⏱ Étape 10.3 — General App Information

Dernière vérif :

- **Copyright** : `2026 TrajetPro` (ou ton nom)
- **Trade Representative Contact Information** : remplir avec ton adresse pro

🟦 **Save**.

✅ **Vérification de la Partie 10** :
- [ ] Tous les ✅ verts dans la checklist de gauche
- [ ] Build sélectionné
- [ ] Pas de warning en haut de la page

---

# 🚀 Partie 11 — Submit for Review (5 min)

C'est le moment de la vérité.

## ⏱ Étape 11.1 — Add for Review

1. Tout en haut à droite de la page de version, clique le bouton bleu **`Add for Review`**
2. Apple te montre un récap final
3. Vérifie une dernière fois
4. Clique **`Submit to App Review`**

## ⏱ Étape 11.2 — Confirmation

Tu reçois un email d'Apple **"Your app submission has been received"**.

Le statut de l'app passe à **"Waiting for Review"** → puis **"In Review"** (généralement dans les 24h) → puis **"Approved"** ou **"Rejected"**.

✅ **Vérification de la Partie 11** :
- [ ] Email "Submission received" reçu
- [ ] Status app : "Waiting for Review" ou "In Review"

---

# ⏳ Partie 12 — Attendre la review Apple (1-7 jours)

Statistiques en 2026 :
- **24-48h** : médiane (la plupart des apps)
- **3-5 jours** : si Apple a beaucoup de soumissions
- **1 semaine+** : si Apple a un doute, ou si rejet et re-submit

Pendant l'attente, tu reçois des emails Apple à chaque changement de statut.

## ✅ Si Approved

Email "Your app TrajetPro has been approved." → tu reçois un lien.

Tu peux choisir entre :
- **Release immediately** → l'app est dans l'App Store sous 24h
- **Release manually** → tu décides du jour de mise en ligne

🎉 Bravo !

## ❌ Si Rejected

Email "Your app TrajetPro has been rejected." avec :
- Le **Resolution Center** où Apple liste précisément les raisons
- Des **screenshots** d'Apple montrant le problème

Causes communes de rejet :
1. **Demo account ne marche pas** → vérifier que `apple-review@trajetpro.fr` se connecte
2. **Permissions sans justification claire** → vérifier les `NSXxxUsageDescription` dans Info.plist
3. **Sign in with Apple obligatoire** → ✅ on l'a déjà
4. **Achats in-app via Stripe** → Apple peut refuser, voir Q1 ci-dessous
5. **App ne suit pas les guidelines de design Apple** → rare pour une app utilitaire

→ Tu corriges → rebuild → upload nouveau build → re-submit. **Pas de paiement supplémentaire**, juste re-soumission.

---

# 🔄 Partie 13 — Updates futures (5 min)

Pour mettre à jour l'app après la v1.0 :

1. Modifie le code
2. Bump la version dans :
   - `package.json` → `version: "1.0.1"`
   - Xcode → General → Version + Build (incrémente Build à chaque upload, ex. 2)
3. `npm run build && npx cap sync ios`
4. Xcode → Product → Archive
5. Distribute → App Store Connect → Upload
6. App Store Connect → ton app → **`+ Version`** (à gauche) → 1.0.1
7. Sélectionne le nouveau build
8. Submit for Review

---

# 🆘 Q&A — Questions fréquentes

### Q1. Apple va-t-il rejeter mon système Stripe pour les tokens ?

**Possible**. Apple App Store règle 3.1.1 : les **biens numériques consommés dans l'app** doivent passer par In-App Purchase (commission 30 %).

Tes tokens sont... à la limite. Apple peut accepter ou refuser.

**Stratégies en cas de rejet** :

| Option | Effort | Conséquence |
|---|---|---|
| **A. Retirer l'achat in-app de la v1.0** | 2h dev | Tu ressors la fonctionnalité achat en v1.1 |
| **B. Migrer vers In-App Purchase Apple** | 1-2 jours | Apple commission 30 % |
| **C. Garder Stripe + argumenter** | 0 | Tu écris au reviewer "ce sont des documents fiscaux pros, pas du contenu in-app" |

Recommandation : **soumettre tel quel**, voir la réponse Apple. Si rejet, option C en premier (réponse argumentée). Si nouveau rejet, option A (retirer l'achat de la v1.0).

### Q2. Je n'ai pas le code de mon Apple ID, comment me connecter sur le Mac ?

→ Reset depuis https://appleid.apple.com/

### Q3. Xcode plante au lancement / refuse de signer

→ Quitte Xcode complètement (Cmd+Q), redémarre le Mac, ré-ouvre.
→ Si ça persiste, supprime les certificats expirés : Xcode → Settings → Accounts → ton compte → Manage Certificates → supprime les vieux → relance.

### Q4. Combien ça coûte au total ?

| Item | Coût |
|---|---|
| Apple Developer Program | 99 €/an |
| Mac (achat) | 500-1000 € one-shot |
| OU Mac (MacInCloud) | 30 €/mois × ~1-2 mois pour soumettre |
| Domaine `trajetpro.fr` (optionnel) | 12 €/an |
| App Store soumission | 0 € |
| **Total minimum** | **~130 €/an** (avec MacInCloud 1 mois) |

### Q5. Tu peux scheduler un agent pour vérifier le statut de la review ?

Oui, dis-le moi et je crée une tâche programmée qui vérifie tous les jours (ou tu vas juste sur App Store Connect).

---

# ✅ Checklist finale avant Submit

Imprime cette page (ou ouvre-la sur un 2e écran) :

## Mac & Xcode
- [ ] Xcode 15+ installé
- [ ] Cocoapods installé
- [ ] Repo cloné, `npm install`, `pod install` faits

## Project
- [ ] `npm run build && npx cap sync ios` exécuté
- [ ] Bundle ID = `com.trajetpro.app` dans Xcode
- [ ] Version 1.0.0, Build 1
- [ ] Team Apple sélectionné dans Signing
- [ ] Pas d'erreur rouge dans Signing & Capabilities

## Test fonctionnel
- [ ] App lance sur simulateur sans crash
- [ ] App lance sur iPhone physique
- [ ] Sign in with Apple marche en natif
- [ ] Dictée vocale + Gemini extraction OK
- [ ] Notifications de rappel arrivent
- [ ] Téléchargement PDF facture OK

## App Store Connect
- [ ] Fiche app créée
- [ ] Subtitle, Description, Keywords remplis (FR)
- [ ] Privacy Policy URL valide
- [ ] App Privacy déclarée (toutes les data types)
- [ ] App Icon 1024×1024 uploadée
- [ ] 5 screenshots iPhone 6.9" uploadés
- [ ] Demo account créé + login testé
- [ ] App Review Notes remplies

## Build
- [ ] Archive Xcode réussi
- [ ] Upload vers App Store Connect réussi
- [ ] Build "Ready to Submit" dans TestFlight
- [ ] Build sélectionné dans la version
- [ ] Tous ✅ verts dans la checklist de gauche
- [ ] **Submit to App Review cliqué**

---

# 🎉 Quand l'app sera live

1. **Annonce sur tes réseaux** : LinkedIn, groupes Facebook chauffeurs VTC, forums VTC France
2. **Active le programme de parrainage** : utilise ton propre code
3. **Stripe Live mode** : ✅ déjà actif (vérifié dans le précédent audit)
4. **Backup** : ton keystore Apple Developer est-il bien sauvegardé sur 3 endroits ? (Pareil que le `.p8` de Sign in with Apple)
5. **Monitoring** : check les logs Supabase 1× par jour la première semaine
6. **Support actif** : check `contact@trajetpro.fr` 2× par jour

**Bon courage Aslan, t'es à 1 semaine de vivre sur l'App Store. 🚀**

*Pour toute question pendant le processus, demande-moi (Claude). Je peux t'aider à débloquer chaque étape en temps réel.*
