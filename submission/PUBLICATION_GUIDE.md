# 🚀 Guide de publication TrajetPro — App Store + Play Store

> **Pour Aslan, sans aucune compétence technique requise.**
>
> Ce guide te tient la main de A à Z. Chaque étape précise : ce qu'il faut cliquer, ce qu'il faut taper, combien de temps ça prend, et comment vérifier que c'est bien fait.
>
> ⏱ **Temps total réaliste** : 3-5 demi-journées étalées sur 2-3 semaines (à cause des temps d'attente : 24-48h validation Apple, 24h Google, 1-2 jours review).
>
> 💰 **Budget total** : 124 € minimum (99 € Apple + 25 € Google) + 0-30 € (Mac cloud si tu n'en as pas).

---

## 📋 Vue d'ensemble — ce que tu vas faire dans l'ordre

| Jour | Étape | Difficulté | Bloque sur |
|---|---|---|---|
| **J1 (matin)** | Préparer les comptes Apple + Google | 🟢 Facile | Carte bancaire |
| **J1 (aprèm)** | Activer GitHub Pages + remplir les `[XXX]` rouges | 🟢 Facile | Aucun |
| **J2-J3** | Attendre validation Apple Developer (24-48h) | ⏸ Patience | — |
| **J3-J4** | Préparer les screenshots (Android = OK depuis Windows, iOS = besoin Mac) | 🟡 Moyen | Mac (iOS) |
| **J5** | Build + soumission Google Play (depuis Windows) | 🟡 Moyen | Aucun |
| **J6+** | Build + soumission App Store (besoin Mac) | 🟡 Moyen | Mac, Apple validé |
| **J7-J14** | Reviews stores (Google : 1-2j, Apple : 1-7j) | ⏸ Patience | — |

---

# 🟢 PARTIE 0 — ULTRA-IMPORTANT : ce que tu dois préparer AVANT de commencer

Avant de toucher à quoi que ce soit, rassemble **physiquement** ces infos sur une feuille ou dans un fichier texte. Tu vas en avoir besoin partout :

## 0.1 Tes infos personnelles / professionnelles

```
Nom complet         : ________________________________
Prénom              : ________________________________
Adresse complète    : ________________________________
                      ________________________________
Code postal + ville : ________________________________

Pays                : France
Téléphone           : ________________________________
Email pro principal : contact@trajetpro.fr  ← à créer si pas fait

Forme juridique     : ☐ Auto-entrepreneur  ☐ EURL  ☐ SASU  ☐ Autre : _______
Nom de l'entreprise : ________________________________
SIRET (14 chiffres) : ________________________________
N° RCS              : ________________________________ (si SASU/EURL)
Ville du tribunal   : ________________________________
TVA intracommun.    : ________________________________ (si applicable)
Carte bancaire pro  : pour payer les comptes développeurs
```

## 0.2 Ce que tu DOIS créer si pas déjà fait

### a) Une adresse mail dédiée à l'app (5 min)

Ne mélange pas ton mail perso et ton mail d'app. Crée :
- `contact@trajetpro.fr` (si tu as le domaine) — ou
- `trajetpro.contact@gmail.com` (si tu n'as pas encore le domaine)

**Pourquoi ?** Cette adresse sera publique dans l'App Store et le Play Store. Tu y recevras les retours clients, les emails Apple/Google, les renouvellements de compte développeur. Autant qu'elle ne soit pas mélangée à ton mail perso.

### b) Un compte Google neuf si tu utilises déjà Google Play comme acheteur (10 min)

Si ton compte Gmail personnel a déjà acheté des apps sur le Play Store, **ne l'utilise PAS** comme compte développeur. Crée un nouveau Google account dédié à TrajetPro Developer.

**Pourquoi ?** Si Google bannit ton compte développeur (ça arrive même par erreur), tu perds aussi ton compte perso. À ne JAMAIS mélanger.

### c) Le domaine `trajetpro.fr` (optionnel mais recommandé, 12 €/an)

Va sur **OVH** ou **Gandi** ou **Namecheap**, achète `trajetpro.fr`. Ça te servira pour :
- Avoir une vraie adresse `contact@trajetpro.fr` (au lieu d'un Gmail générique)
- Avoir une URL `https://trajetpro.fr/privacy` plus pro que le github.io

**Si tu reportes** : pas grave, tu pourras y migrer plus tard. Pour la v1.0, le github.io suffit.

---

# 🍎 PARTIE 1 — Publier sur l'APP STORE (iPhone)

## 🗓️ J1 — Créer le compte Apple Developer (30 min + attente)

### Étape 1.1 — Créer un Apple ID dédié à l'app (5 min)

1. Va sur https://appleid.apple.com/account
2. Clique **"Create Your Apple ID"**
3. Utilise l'email **`contact@trajetpro.fr`** (PAS ton Apple ID perso d'iPhone)
4. Mot de passe fort : note-le quelque part en sûreté
5. Date de naissance : la tienne réelle
6. Pays : **France**
7. Question de sécurité : note les réponses
8. Tu reçois un code à 6 chiffres par mail → entre-le pour valider

✅ **Vérification** : tu peux te connecter sur appleid.apple.com avec ce nouvel Apple ID.

### Étape 1.2 — S'inscrire au Apple Developer Program (15 min + 24-48h)

1. Va sur https://developer.apple.com/programs/enroll/
2. Connecte-toi avec ton nouvel Apple ID `contact@trajetpro.fr`
3. **"Start Your Enrollment"**
4. Type d'entité :
   - **Si auto-entrepreneur** → choisis **"Individual / Sole Proprietor"** (le plus simple, pas besoin de DUNS)
   - **Si SASU/EURL** → choisis **"Organization"** → tu auras besoin d'un numéro **D-U-N-S** (gratuit, 5-10 jours via https://developer.apple.com/enroll/duns-lookup/)
5. Renseigne ton adresse, téléphone, SIRET
6. Accepte les conditions
7. **Paiement** : 99 USD (≈ 99 €). Apple débite ta carte. Si le paiement échoue, vérifie que ta CB autorise les paiements internationaux.
8. **Soumets**

### Étape 1.3 — Attendre la validation Apple (24-48h)

Apple vérifie tes infos manuellement. Tu reçois un email "Welcome to the Apple Developer Program" quand c'est validé. **Pas de panique** si ça prend 2 jours, c'est normal.

⚠️ **Si Apple demande des justificatifs supplémentaires** (relevé Kbis pour SASU, attestation auto-entrepreneur) : envoie-les rapidement, sinon ils ferment le dossier.

✅ **Vérification** : tu peux te connecter sur https://appstoreconnect.apple.com et tu vois la console développeur.

---

## 🗓️ J1 (aprèm) — Activer GitHub Pages pour l'URL de privacy (10 min)

⭐ **Étape OBLIGATOIRE** avant la soumission App Store : tu dois fournir une URL publique de politique de confidentialité.

### Étape 1.4 — Pousser le code sur GitHub

Ouvre un terminal dans le dossier `trajetpro/` et tape :
```bash
git push
```

Si ça te demande des identifiants, c'est ton login GitHub.

### Étape 1.5 — Activer GitHub Pages

1. Va sur https://github.com/chiccarvtc84-sys/vtc-bon
2. Clique **Settings** (en haut à droite)
3. Dans le menu de gauche, clique **Pages**
4. **Build and deployment** :
   - Source : **"Deploy from a branch"**
   - Branch : **`main`** / dossier : **`/docs`**
5. Clique **Save**

Attends 1-2 minutes, puis ouvre dans un navigateur :
👉 https://chiccarvtc84-sys.github.io/vtc-bon/

✅ **Vérification** : la page s'affiche en doré sur fond noir. Les liens Confidentialité / CGU / Mentions légales fonctionnent.

### Étape 1.6 — Remplir les placeholders rouges `[XXX]`

Les pages contiennent des mentions visibles en rouge. Tu DOIS les remplacer par tes infos réelles, sinon **Apple rejettera ta soumission**.

1. Dans le dossier `trajetpro/docs/`, ouvre dans un éditeur de texte (Notepad++ ou VS Code) :
   - `privacy.html`
   - `terms.html`
   - `legal.html`

2. Recherche/remplace toutes les occurrences :

| À remplacer | Par |
|---|---|
| `[NOM_DE_VOTRE_ENTREPRISE]` | Ton nom commercial ou raison sociale |
| `[VOTRE_SIRET]` | Ton SIRET (14 chiffres avec espaces : `XXX XXX XXX XXXXX`) |
| `[ADRESSE_COMPLÈTE]` | Ton adresse de domiciliation |
| `[VILLE_DU_TRIBUNAL]` | Ex. "Avignon" |
| `[VOTRE_NOM_ET_PRÉNOM]` | Ton nom + prénom |
| `[FORME_JURIDIQUE]` | "Auto-entrepreneur (EI)" ou "SASU" ou "EURL"… |
| `[DATE_DE_PUBLICATION]` | Ex. "2 mai 2026" |
| `[VOTRE_NUMÉRO]` | Ton numéro de support, ou laisse "Non disponible" |
| `[VILLE_DE_VOTRE_SIÈGE]` | Pareil que ville du tribunal |
| `[À_PRÉCISER…]` | "MEDICYS" (médiateur consommation par défaut) |

3. Sauvegarde.
4. Dans le terminal :
```bash
git add docs/
git commit -m "fill legal placeholders for App Store submission"
git push
```

5. Attends 1-2 minutes que GitHub Pages se redéploie.
6. Recharge la page : il ne doit plus rester aucun rouge `[XXX]`.

✅ **Vérification finale** : ouvre https://chiccarvtc84-sys.github.io/vtc-bon/privacy.html → toutes les mentions sont remplies.

---

## 🗓️ J3-J4 — Préparer les screenshots iPhone (1-2h, NÉCESSITE UN MAC)

⚠️ **Cette étape est BLOQUANTE sans Mac.** Si tu n'en as pas, voir options en bas de cette section.

### Option A — Tu as un Mac (recommandé)

1. **Installer Xcode** (gratuit, mais 12 GB) :
   - Mac App Store → cherche "Xcode" → Install (15-30 min)

2. **Cloner le projet sur le Mac** :
   ```bash
   cd ~/Documents
   git clone https://github.com/chiccarvtc84-sys/vtc-bon.git
   cd vtc-bon
   ```

3. **Installer les dépendances** :
   ```bash
   npm install
   npx cap sync ios
   cd ios/App
   pod install     # première fois, peut prendre 5 min
   ```

4. **Ouvrir dans Xcode** :
   ```bash
   open App.xcworkspace
   ```
   ⚠️ **`.xcworkspace`** PAS `.xcodeproj` — c'est très important.

5. **Choisir le simulateur** :
   - En haut de Xcode, dropdown "iPhone 16 Pro Max"
   - **Cmd + R** pour lancer

6. **Préparer un compte de démo** dans l'app simulée :
   - Crée un compte test (`demo@trajetpro.fr`)
   - Ajoute 5 fausses courses (suggestions dans `submission/SCREENSHOTS_GUIDE.md`)
   - Émets 2-3 factures

7. **Capturer 5 écrans** :
   - Dans le simulateur : **Cmd + S** (ou `xcrun simctl io booted screenshot ~/Desktop/01.png`)
   - Les 5 captures recommandées (dans l'ordre) :
     1. Écran d'accueil avec le solde de tokens
     2. Modal dictée vocale ouverte
     3. Bon de course pré-rempli après dictée
     4. Une facture conforme générée
     5. La liste des bons / dashboard

8. **Vérifier les dimensions** :
   - Doit faire **1320 × 2868 px** (iPhone 16 Pro Max portrait)
   - Sinon, ajuste : `Window → Physical Size`

✅ **Tu as 5 fichiers PNG** dans `~/Desktop/` aux dimensions 1320×2868. Garde-les pour la soumission.

### Option B — Pas de Mac, pas le budget MacInCloud

**Solution de secours** : utilise les screenshots **Android** (qu'on va faire ci-dessous) et soumet d'abord sur Play Store. Reporte la soumission App Store quand tu auras un Mac (achat / location).

### Option C — Louer un Mac dans le cloud (~30 €)

1. Va sur https://www.macincloud.com → choisis "Pay-as-you-go" 1 mois (29 USD)
2. Connecte-toi en remote desktop
3. Suis l'option A ci-dessus

---

## 🗓️ J5+ — Build et upload sur App Store Connect (1h, NÉCESSITE MAC)

### Étape 1.7 — Configurer Xcode pour ton compte développeur

Dans Xcode (sur le Mac) :

1. Sélectionne le projet "App" dans le panneau de gauche
2. Onglet **"Signing & Capabilities"**
3. **Team** : sélectionne ton équipe (apparait après validation Apple Developer J3)
4. **Bundle Identifier** : doit être `com.trajetpro.app` (déjà configuré)
5. **Version** : `1.0.0`
6. **Build** : `1`
7. Active **"Automatically manage signing"**

### Étape 1.8 — Créer l'app dans App Store Connect

1. Va sur https://appstoreconnect.apple.com
2. **My Apps** → **+** → **New App**
3. Plateformes : **iOS**
4. Nom : **TrajetPro · Bons VTC** (ce qui apparaît dans le store)
5. Langue principale : **French (France)**
6. Bundle ID : **com.trajetpro.app** (apparaîtra dans la liste après le J3)
7. SKU (identifiant interne) : **trajetpro-1**
8. **Create**

### Étape 1.9 — Remplir la fiche App Store

Ouvre le fichier `submission/APP_STORE_MARKETING.md` et copie-colle les sections dans App Store Connect :

**Pricing and Availability** :
- Price : **Free** (gratuit — les achats de crédits passent par Stripe externe)
- Availability : **All countries** ou seulement France selon ta cible

**Localization → French (France)** :
- Subtitle : copie depuis `APP_STORE_MARKETING.md` § "Sous-titre"
- Promotional Text : copie depuis `APP_STORE_MARKETING.md` § "Texte promotionnel"
- Description : copie depuis `APP_STORE_MARKETING.md` § "Description longue"
- Keywords : copie depuis `APP_STORE_MARKETING.md` § "Mots-clés"
- Support URL : `https://chiccarvtc84-sys.github.io/vtc-bon/`
- Marketing URL : `https://chiccarvtc84-sys.github.io/vtc-bon/`

**App Icon** :
- Upload `submission/store-graphics/appstore-icon-1024.png` (1024×1024)

**Screenshots iPhone 6.9"** :
- Upload tes 5 PNG capturés (1320×2868)

**App Privacy** :
- Suis le tableau dans `APP_STORE_MARKETING.md` § "App Privacy → Data Types collected"
- Pour chaque type : indique si collecté, lié à l'utilisateur, utilisé pour tracking

**App Review Information** :
- Démo account → email + mot de passe (crée `apple-review@trajetpro.fr` dans ton app, donne-leur)
- Notes : copie depuis `APP_STORE_MARKETING.md` § "Notes pour le reviewer"

### Étape 1.10 — Build et upload depuis Xcode

1. Dans Xcode, en haut : sélectionne **"Any iOS Device (arm64)"** (PAS un simulateur)
2. Menu **Product → Archive**
3. Attends 5-10 min pendant que Xcode compile
4. Une fenêtre **Organizer** s'ouvre avec ton archive
5. Clique **"Distribute App"** → **"App Store Connect"** → **"Upload"**
6. Suit les étapes (signing automatique)
7. Clique **"Upload"**
8. Attends 5-15 min que ça monte vers les serveurs Apple

✅ **Vérification** : dans App Store Connect, va dans ton app → Onglet "TestFlight" → tu vois le build apparaître au bout de 10-30 min ("Processing" puis "Ready to Submit")

### Étape 1.11 — Sélectionner le build et soumettre

1. App Store Connect → ton app → onglet **"App Store"**
2. Section **"Build"** → **"Select a build"** → choisis le build qui vient d'arriver
3. Vérifie que tout est bien rempli (icône, screenshots, descriptions)
4. **"Add for Review"** en haut à droite
5. **"Submit to App Review"**

### Étape 1.12 — Attendre la review (1-7 jours)

Apple review l'app manuellement. Tu reçois un email quand c'est :
- ✅ **In Review** : Apple est en train de tester (1-3 jours)
- ✅ **Approved** : ton app est dans le store !
- ❌ **Rejected** : Apple liste les raisons → tu corriges et re-soumets

**Causes courantes de rejet** :
- Permissions sans justification claire dans Info.plist → re-vérifier les textes
- Compte de test ne fonctionne pas → re-tester avant de soumettre
- Privacy policy URL invalide → re-tester
- Achats in-app non passés par StoreKit → voir section "tokens vs IAP" en fin de guide

### Étape 1.13 — Release manuel ou automatique

Une fois approved, tu peux :
- **Release immédiate** : disponible dans le store sous 24h
- **Release manuelle** : tu choisis le jour (utile pour synchroniser une comm)

---

# 🤖 PARTIE 2 — Publier sur GOOGLE PLAY STORE (Android)

⭐ **Bonne nouvelle** : tout peut se faire 100% depuis Windows. Pas besoin de Mac.

## 🗓️ J1 — Créer le compte Google Play Console (30 min)

### Étape 2.1 — S'inscrire (10 min + 25 € one-shot)

1. Va sur https://play.google.com/console/signup
2. Connecte-toi avec ton **compte Google dédié** (pas ton perso !)
3. Choisis **"Individual"** (sauf si tu as une SASU/EURL → "Organization")
4. Accepte les conditions
5. **Payer** : 25 USD (≈ 25 €) — débité une seule fois, à vie
6. Renseigne tes infos pro (SIRET, adresse, etc.)

### Étape 2.2 — Vérification d'identité

Google demande de plus en plus une vérification d'identité (depuis 2024) :
- Pièce d'identité (carte, passeport)
- Selfie avec la pièce
- Justificatif de domicile

Suis les indications, ça prend 1-3 jours pour valider.

✅ **Vérification** : tu peux accéder à https://play.google.com/console et créer une nouvelle app.

---

## 🗓️ J2 — Préparer le keystore (30 min, MAIS À FAIRE UNE SEULE FOIS DANS TA VIE)

⚠️ **ULTRA-IMPORTANT** : le keystore Android, c'est l'identité crypto de ton app. Si tu le perds, tu ne pourras **jamais plus** mettre à jour ton app sur le Play Store. Si quelqu'un le vole, il peut publier des updates malveillantes en ton nom.

### Étape 2.3 — Générer le keystore

Ouvre PowerShell **en tant qu'administrateur** dans le dossier `trajetpro/` et tape :

```powershell
keytool -genkey -v `
  -keystore "$HOME\trajetpro-release.keystore" `
  -alias trajetpro `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000
```

Réponds aux questions :
- **Mot de passe du keystore** : choisis un mot de passe FORT (mini 12 caractères, mélange lettres/chiffres/symboles). **Note-le** — sans lui le keystore est inutile.
- **Mot de passe de l'alias** : tu peux le mettre identique au précédent
- **Nom et prénom** : ton nom complet
- **Unité organisationnelle** : "TrajetPro"
- **Organisation** : ton nom commercial
- **Ville, État, Pays** : France, FR

Le fichier `trajetpro-release.keystore` se crée dans `C:\Users\aslan\trajetpro-release.keystore`.

### Étape 2.4 — SAUVEGARDER LE KEYSTORE EN 3 ENDROITS

C'est non-négociable :

1. **Cloud chiffré** : OneDrive, Google Drive, Dropbox (dans un dossier "Backup keystore")
2. **Clé USB** : copie sur une clé USB que tu mets dans un tiroir sûr
3. **Email à toi-même** : envoie-toi par email avec le mot de passe noté à part

Note dans un fichier texte (et sauvegarde-le aussi) :
```
Keystore TrajetPro
==================
Fichier      : trajetpro-release.keystore
Alias        : trajetpro
Mot de passe : [LE_MOT_DE_PASSE_QUE_TU_AS_CHOISI]
Date création: [DATE]
SHA-256      : [calculé plus tard, après premier upload]
```

### Étape 2.5 — Configurer Gradle pour signer avec ce keystore

Crée le fichier `android/keystore.properties` (à la racine du dossier android) :

```properties
storeFile=C:/Users/aslan/trajetpro-release.keystore
storePassword=TON_MOT_DE_PASSE
keyAlias=trajetpro
keyPassword=TON_MOT_DE_PASSE
```

⚠️ **IMPORTANT** : ce fichier ne doit JAMAIS être committé dans git. Vérifie qu'il est dans `.gitignore` :

```bash
cd "C:\Users\aslan\OneDrive\Bureau\Appli CLAUDE\trajet pro\trajetpro"
echo "android/keystore.properties" >> .gitignore
```

Édite `android/app/build.gradle` pour utiliser ce keystore. Ajoute en haut du fichier :

```gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('keystore.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    // ... (config existante)

    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
            }
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            // ... reste de la config
        }
    }
}
```

✅ **Si tu n'es pas à l'aise** : demande-moi (Claude) de le faire — je peux modifier `android/app/build.gradle` pour toi.

---

## 🗓️ J3 — Builder le bundle Android `.aab` (15 min)

### Étape 2.6 — Compiler l'app

Depuis le terminal dans le dossier `trajetpro/` :

```bash
npm run build
npx cap sync android
cd android
./gradlew bundleRelease
```

Sur Windows PowerShell :
```powershell
npm run build
npx cap sync android
cd android
.\gradlew.bat bundleRelease
```

Attends 5-10 min. Si tout va bien, le fichier est créé à :

```
android/app/build/outputs/bundle/release/app-release.aab
```

C'est CE fichier que Google Play attend.

### Étape 2.7 — Si la compilation échoue

Erreurs courantes :

| Erreur | Solution |
|---|---|
| `SDK location not found` | Installer Android Studio (gratuit) → ouvrir une fois → fermer. Ça configure les variables. |
| `JAVA_HOME is not set` | Tu as Java 21, c'est bon. PowerShell : `$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.9.10-hotspot"` |
| `keystore not found` | Vérifie le chemin dans `keystore.properties` (slashes Windows = `\\` ou `/`) |
| `wrong password` | Re-vérifie les 2 mots de passe dans `keystore.properties` |

---

## 🗓️ J3-J4 — Préparer les screenshots Android (1h)

### Étape 2.8 — Sur émulateur Android Studio (gratuit)

1. Installer Android Studio (https://developer.android.com/studio) si pas fait
2. Lance-le → **More Actions → Virtual Device Manager**
3. **Create Virtual Device** → **Pixel 8 Pro** (1080×2400)
4. Choisis l'image système Android 14
5. **Finish** → l'émulateur démarre

6. Dans Android Studio, ouvre le dossier `android/` du projet
7. Sélectionne ton émulateur en cible
8. Clique **▶ Run**
9. L'app se lance sur l'émulateur

10. **Capturer les écrans** : dans la fenêtre de l'émulateur, icône appareil photo (à droite)
11. Les captures se sauvent dans `~/Desktop/`

Cible : **3-5 captures portrait, 1080×1920 ou 1080×2400**.

✅ **Tu as 3-5 PNG**.

---

## 🗓️ J5 — Créer la fiche Google Play (1h)

### Étape 2.9 — Créer l'app dans Play Console

1. Va sur https://play.google.com/console
2. **Create app**
3. Nom de l'app : **TrajetPro · Bons VTC**
4. Langue par défaut : **French (France)**
5. App ou jeu : **App**
6. Gratuite ou payante : **Gratuite**
7. Coche les déclarations (politiques developer, lois export US)
8. **Create app**

### Étape 2.10 — Remplir la fiche

**Onglet "Main store listing"** :

Copie depuis `submission/GOOGLE_PLAY_MARKETING.md` :
- App name : 30 chars
- Short description : 80 chars
- Full description : 4000 chars

**Graphics** :
- Upload `submission/store-graphics/playstore-icon-512.png` (icône 512×512)
- Upload `submission/store-graphics/playstore-feature-1024x500.png` (feature graphic)
- Upload tes 3-5 screenshots Android

**Categorization** :
- Application or game : Application
- Category : **Productivity**
- Tags : **Voyage et navigation**, **Économie et finance**

**Contact details** :
- Email : `contact@trajetpro.fr`
- Website : `https://chiccarvtc84-sys.github.io/vtc-bon/`

**Privacy policy** :
- URL : `https://chiccarvtc84-sys.github.io/vtc-bon/privacy.html`

**Store settings → App content** : remplis tous les questionnaires :
- App access (compte de test → fournis email + password)
- Ads → No
- Content rating → questionnaire IARC (réponses dans `GOOGLE_PLAY_MARKETING.md`)
- Target audience → 18+ (chauffeurs VTC pros)
- News app → No
- COVID-19 contact tracing → No
- Data safety → table dans `GOOGLE_PLAY_MARKETING.md`
- Government app → No

### Étape 2.11 — Uploader le bundle .aab

1. Dans le menu de gauche : **Production**
2. **Create new release**
3. Section **App bundles** : drag-and-drop `app-release.aab`
4. Si ça te demande "Use Play App Signing" → **Continue** (Google ré-signe avec sa propre clé pour distribuer, c'est sécurisé)
5. Release name : **1.0.0**
6. Release notes : "Première version de TrajetPro. Bons de course VTC, factures conformes, dictée vocale, programme de parrainage."
7. **Save**

### Étape 2.12 — Soumettre pour review

1. Vérifie que tous les onglets sont en ✅ vert dans le menu de gauche
2. **Production → Review release**
3. **Start rollout to Production**
4. Confirmer

Délai review : **24-48h** (parfois plus pour les nouveaux comptes développeur).

---

# 📝 PARTIE 3 — Récapitulatif des fichiers à uploader

Tous les fichiers prêts sont dans le dossier `submission/`. Voici l'inventaire :

## App Store Connect

| Champ | Fichier / Texte |
|---|---|
| App icon (1024×1024) | `submission/store-graphics/appstore-icon-1024.png` |
| Screenshots 6.9" (5 fichiers) | À capturer sur Mac (voir guide screenshots) |
| Title, subtitle, description, keywords | `submission/APP_STORE_MARKETING.md` |
| Privacy URL | `https://chiccarvtc84-sys.github.io/vtc-bon/privacy.html` |
| Build (.ipa) | À builder sur Mac via Xcode → Archive |
| Test account | À créer dans ton app, fournir email + password à Apple |

## Google Play Console

| Champ | Fichier / Texte |
|---|---|
| App icon (512×512) | `submission/store-graphics/playstore-icon-512.png` |
| Feature graphic (1024×500) | `submission/store-graphics/playstore-feature-1024x500.png` |
| Screenshots téléphone (3-5) | À capturer sur émulateur Android Studio (Windows OK) |
| App name, short desc, full desc | `submission/GOOGLE_PLAY_MARKETING.md` |
| Privacy URL | `https://chiccarvtc84-sys.github.io/vtc-bon/privacy.html` |
| Bundle (.aab) | À builder via `./gradlew bundleRelease` (Windows OK) |
| Test account | Pareil que Apple |

---

# 🆘 PARTIE 4 — Questions fréquentes

### Q1. Apple va-t-il rejeter mon système de crédits Stripe ?

Possible. Apple exige In-App Purchase (StoreKit) pour les "biens numériques consommés dans l'app". Tes crédits TrajetPro permettent d'émettre des **documents officiels exportés en PDF** (assimilable à du contenu professionnel externe) — Apple peut accepter ou refuser.

**Stratégies en cas de rejet** :

| Stratégie | Effort | Conséquence |
|---|---|---|
| **A. Retirer l'achat in-app de la v1.0** | Faible (2h) | Pas de monétisation à v1.0, tu rajoutes plus tard |
| **B. Passer à StoreKit (Apple)** | Important (1-2 jours) | Apple prend 30% de commission |
| **C. Garder Stripe + argumenter** | Faible | Tu écris à App Review pour expliquer "ce sont des documents pros, pas du contenu numérique consommé" |

Recommandation : **soumets tel quel en v1.0**, vois la réponse, ajuste si besoin.

### Q2. Combien de temps avant que mon app soit visible ?

- **Apple** : 1-7 jours après "Approved" + 24h pour propagation dans le store
- **Google** : 24-48h après "Released" + immédiat dans le store

### Q3. Si je perds le keystore Android, que faire ?

- **Tu peux pas mettre à jour l'app actuelle** sur Play Store
- **Solution** : créer une nouvelle app avec un nouvel ID (par exemple `com.trajetpro.app2`), uploader avec un nouveau keystore. Tes utilisateurs devront re-télécharger.
- **Pour l'éviter** : sauvegarde les 3 endroits dès J2 ! Et active **"Play App Signing"** au premier upload (Google garde une copie de la clé).

### Q4. Comment mettre à jour l'app après publication ?

1. Modifier le code
2. Bump le version dans `package.json`, `android/app/build.gradle` (`versionCode`, `versionName`), `ios/App/App/Info.plist` (`CFBundleShortVersionString`, `CFBundleVersion`)
3. Re-builder + re-uploader (étapes 1.10 / 2.6+2.11)
4. Re-soumettre review

### Q5. Si Apple ou Google rejette, qu'est-ce que je fais ?

- Lis attentivement le **Reason** : ils sont précis
- Corrige dans le code OU dans la fiche
- Re-soumets : pas besoin de payer à nouveau
- Tu peux aussi **répondre au reviewer** (notes pour le reviewer) pour expliquer

### Q6. Mon app peut-elle gagner combien à terme ?

Aucune garantie. Quelques benchmarks :
- Apps SaaS B2B niche (chauffeurs VTC) : 50-500 users payants potentiels en France
- Conversion à payant : 5-15%
- Revenu moyen : 2-10 €/user/mois si abonnement, 5-30 €/user/an si packs
- → Estimation : **300-3000 €/mois** réaliste à 1 an si bien marketé

---

# 📦 PARTIE 5 — Inventaire complet du dossier `submission/`

```
submission/
├── PUBLICATION_GUIDE.md        ← Le présent guide
├── APP_STORE_MARKETING.md      ← Copy Apple : titre/desc/keywords/notes reviewer
├── GOOGLE_PLAY_MARKETING.md    ← Copy Google : titre/desc/keywords/data safety
├── SCREENSHOTS_GUIDE.md        ← Comment capturer les screenshots
├── GITHUB_PAGES_SETUP.md       ← Activer le site légal
├── CHECKLIST_FINALE.md         ← Cocher avant chaque submit
└── store-graphics/
    ├── appstore-icon-1024.png       ← App Store : icône 1024×1024
    ├── playstore-icon-512.png       ← Play Store : icône 512×512
    └── playstore-feature-1024x500.png ← Play Store : bandeau de tête
```

---

# 🎯 EN RÉSUMÉ : que faire MAINTENANT ?

## Cette semaine (depuis ton Windows)

1. **Aujourd'hui** : crée l'Apple Developer + Google Play Console (étapes 1.1-1.2 + 2.1) → 60 min + attente
2. **Aujourd'hui** : push GitHub + active Pages (étapes 1.4-1.5) → 20 min
3. **Demain** : remplis les `[XXX]` dans les HTML (étape 1.6) → 30 min
4. **Cette semaine** : génère le keystore Android + builde le `.aab` (étapes 2.3-2.6) → 1h
5. **Cette semaine** : capture screenshots Android sur émulateur (étape 2.8) → 1h
6. **Cette semaine** : soumets sur Google Play (étapes 2.9-2.12) → 1h ➜ **app live dans 1-2j !** 🎉

## Quand tu auras un Mac

7. Suis Partie 1 § J3-J4 (screenshots iPhone) → 2h
8. Suis Partie 1 § J5+ (build + soumission App Store) → 1h
9. Attends review Apple → 1-7j

---

**Bon courage Aslan, t'es à 1 semaine du App Store et 2-3 jours du Play Store. Ne lâche rien. 🚀**

*Pour toute question pendant le processus, demande-moi (Claude). Je peux t'aider à débloquer chaque étape en temps réel.*
