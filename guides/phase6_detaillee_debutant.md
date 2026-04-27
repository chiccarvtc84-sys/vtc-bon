# 📱 Phase 6 détaillée pour grand débutant — Build mobile natif

> **⚠️⚠️⚠️ PHASE LA PLUS DIFFICILE DU PROJET.**
>
> **Durée réelle :** 6 à 12 heures étalées sur 1 semaine
>
> **Niveau de difficulté :** ⚠️⚠️⚠️⚠️ (très technique)
>
> **Honnêteté totale :** c'est ici que 80% des non-développeurs abandonnent ou délèguent à un freelance. Je te donne TOUT pour essayer, mais prévois un **plan B** : un développeur iOS/Android pour 500-1000€ qui peut faire cette phase en 2-3 jours.

---

## 🎯 Qu'est-ce qu'on va faire exactement ?

Ton app actuelle est un **site web** qui tourne dans un navigateur. Pour qu'elle soit téléchargeable sur App Store et Google Play, il faut la convertir en **application mobile native**.

On va utiliser **Capacitor**, un outil d'Ionic, qui "emballe" ton code web dans une vraie app iOS et Android.

**Résultat final :**
- Un fichier `.ipa` pour iOS (à uploader sur App Store Connect)
- Un fichier `.aab` pour Android (à uploader sur Google Play Console)

---

## 🚨 Prérequis MATÉRIEL obligatoires

**Pour iOS :**
- [ ] **Un Mac** (macOS 13 ou plus récent) — **non négociable**, Xcode ne tourne que sur Mac
- [ ] **Au moins 30 Go d'espace disque libre**
- [ ] **Un iPhone ou iPad** pour les tests (ou le simulateur Xcode)
- [ ] **Un câble USB-C / Lightning**

**Pour Android :**
- [ ] Un ordinateur (Mac, Windows ou Linux) avec 20 Go libres
- [ ] Un smartphone Android pour les tests (ou l'émulateur)

**Solutions alternatives si tu n'as pas de Mac :**
1. **Louer un Mac en ligne via MacinCloud** (~25 €/mois) pour les 2 semaines de cette phase
2. **Emprunter le Mac d'un proche** pendant 1 semaine
3. **Ne publier que sur Android** en V1 (tu ajouteras iOS quand tu auras les moyens)
4. **Déléguer à un freelance** pour 500-1500 € qui fera tout le build iOS pour toi

---

## 📅 Plan d'attaque en 1 semaine

**Jour 1-2 (3h)** — Installer Xcode + Android Studio + Capacitor
**Jour 3 (2h)** — Configurer l'app Capacitor + permissions
**Jour 4 (2h)** — Générer icônes et splash screen
**Jour 5 (2h)** — Premier build iOS (sur simulateur)
**Jour 6 (2h)** — Premier build Android (sur émulateur)
**Jour 7 (2h)** — Build de production signés

---

# 📆 JOUR 1-2 — Installation des outils (3h)

## Étape 1 — Installer Xcode (Mac uniquement)

**Xcode est le logiciel officiel d'Apple pour créer des apps iOS. Il pèse ~15 Go.**

1. Ouvre l'**App Store** sur ton Mac (icône bleue avec un "A")
2. Dans la barre de recherche, tape **"Xcode"**
3. Clique sur **"Obtenir"** puis **"Installer"**
4. **Attends 30 min à 2h** selon ta connexion internet (15 Go à télécharger)
5. Une fois installé, ouvre Xcode au moins une fois pour accepter les licences
6. Quand on te demande d'installer les "Command Line Tools", accepte

**Vérification :** ouvre le Terminal et tape :
```bash
xcodebuild -version
```
Tu dois voir `Xcode 15.x` ou plus récent.

## Étape 2 — Installer CocoaPods (Mac uniquement)

CocoaPods gère les dépendances iOS. Capacitor en a besoin.

Dans le Terminal :
```bash
sudo gem install cocoapods
```

Entre le mot de passe de ton Mac quand demandé.

Vérification :
```bash
pod --version
```

Tu dois voir `1.15.x` ou plus.

## Étape 3 — Installer Android Studio

**Android Studio est l'équivalent de Xcode pour Android. Il pèse ~3 Go.**

1. Va sur **`developer.android.com/studio`**
2. Télécharge **Android Studio** (bouton bleu)
3. Installe normalement

4. Au premier lancement, suis l'assistant d'installation :
   - **Type** : Standard (choix par défaut)
   - **UI Theme** : Dark ou Light (au choix)
   - **SDK Components** : coche tout ce qui est recommandé
   - **Accept licenses** : accepte toutes les licences

5. **Attends encore 20-30 min** : Android Studio télécharge le SDK Android (~2 Go supplémentaires)

## Étape 4 — Installer un émulateur Android

1. Dans Android Studio → **Tools** → **Device Manager**
2. Clique **"Create device"**
3. Choisis un device : **Pixel 7** (ou autre récent)
4. Choisis une version d'Android : **API 34** (Android 14)
5. Clique **Finish**
6. L'émulateur se télécharge (1-2 Go)

**Pour le tester :** dans Device Manager, clique le bouton ▶️ à côté de ton émulateur. Un iPhone... pardon, un Pixel virtuel s'ouvre.

## Étape 5 — Installer Java JDK (pour Android)

Android a besoin de Java.

### Sur Mac
```bash
brew install openjdk@17
```

Puis ajoute à ton fichier `~/.zshrc` :
```bash
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
export PATH="$JAVA_HOME/bin:$PATH"
```

### Sur Windows
1. Télécharge JDK 17 sur **`adoptium.net`**
2. Installe normalement

**Vérification :**
```bash
java -version
```

Tu dois voir `openjdk version "17.x"`.

**Fin du Jour 1-2.** Tu as installé pour ~20 Go d'outils. **Félicitations, tu as la configuration d'un développeur mobile pro !** 🎉

---

# 📆 JOUR 3 — Configurer Capacitor (2h)

## Étape 6 — Retourner dans ton app React

1. Ouvre le Terminal
2. Va dans ton dossier d'app :
   ```bash
   cd ~/Documents/trajetpro-app
   ```

## Étape 7 — Initialiser Capacitor

Capacitor a déjà été installé en Phase 4. On va maintenant l'initialiser.

1. Initialise :
   ```bash
   npx cap init
   ```

2. Réponds aux questions :
   - **App name** : `TrajetPro`
   - **App Package ID** : `com.trajetpro.app`
     - ⚠️ Ce Package ID est UNIQUE MONDIALEMENT. Si quelqu'un l'a déjà pris, change en `com.tonpseudo.trajetpro`
   - **Web asset directory** : `dist`

3. Un fichier `capacitor.config.ts` a été créé à la racine. **Ouvre-le dans VS Code** et vérifie qu'il ressemble à :

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trajetpro.app',
  appName: 'TrajetPro',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0B0B0D',
      showSpinner: false,
    },
  },
};

export default config;
```

## Étape 8 — Ajouter les plateformes iOS et Android

```bash
npx cap add ios
npx cap add android
```

Ça crée 2 dossiers : `ios/` et `android/` qui contiennent les projets natifs.

## Étape 9 — Build de ton app React

```bash
npm run build
```

Ça génère un dossier `dist/` avec l'app optimisée.

## Étape 10 — Synchroniser avec les projets natifs

```bash
npx cap sync
```

Cette commande copie le contenu de `dist/` dans les projets iOS et Android.

**À chaque modification de ton code, tu devras refaire :**
```bash
npm run build
npx cap sync
```

## Étape 11 — Configurer les permissions iOS

Les permissions (micro, localisation, etc.) doivent être déclarées avec des textes explicatifs.

1. Ouvre le projet iOS dans Xcode :
   ```bash
   npx cap open ios
   ```

2. Xcode s'ouvre. Dans l'arborescence à gauche, trouve **App → App → Info.plist**

3. **Clic droit** sur Info.plist → **Open As → Source Code**

4. Avant la balise `</dict>` (tout en bas), **colle** :

```xml
<key>NSMicrophoneUsageDescription</key>
<string>TrajetPro utilise le microphone pour vous permettre de dicter vos courses et gagner du temps.</string>

<key>NSSpeechRecognitionUsageDescription</key>
<string>Nécessaire pour convertir votre voix en bon de réservation.</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>Pour vous suggérer les adresses fréquentes autour de vous.</string>

<key>NSCameraUsageDescription</key>
<string>Pour scanner les QR codes et photographier les justificatifs.</string>

<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

5. **Sauvegarde** (Cmd+S).

## Étape 12 — Configurer les permissions Android

1. Ouvre le projet Android :
   ```bash
   npx cap open android
   ```

2. Android Studio s'ouvre. **Attends 5-10 min** le premier lancement (il indexe le projet).

3. Dans l'arborescence, navigue vers `app/src/main/AndroidManifest.xml`

4. Ouvre ce fichier. Tu vois déjà des permissions de base. **Ajoute** ces lignes à l'intérieur de `<manifest>` (avant `<application>`) :

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
```

5. **Sauvegarde.**

---

# 📆 JOUR 4 — Icônes et Splash Screen (2h)

## Étape 13 — Créer l'icône 1024×1024

1. Va sur **`canva.com`** (gratuit)
2. Crée un compte si pas encore fait
3. Cherche le modèle **"App Icon"** (1024×1024)
4. **Design suggéré :**
   - Fond : ton doré TrajetPro `#F4B942` ou noir `#0B0B0D`
   - Symbole : une voiture stylisée, ou la lettre "T" décorative
   - **Pas de texte** (illisible en petit)
   - Simple et reconnaissable

5. Exporte en PNG 1024×1024

6. Sauvegarde dans `trajetpro-app/resources/icon.png`
   - Crée le dossier `resources` si besoin à la racine du projet

## Étape 14 — Créer le Splash Screen 2732×2732

Le splash screen, c'est l'écran qui s'affiche 1-2 secondes au démarrage.

1. Dans Canva, crée un design **2732×2732** (carré)
2. Fond `#0B0B0D` (noir TrajetPro)
3. Logo TrajetPro centré au milieu, taille ~30% de l'image
4. Exporte en PNG
5. Sauvegarde dans `trajetpro-app/resources/splash.png`

## Étape 15 — Générer toutes les tailles automatiquement

Capacitor Assets génère automatiquement les 30+ tailles d'icônes/splash nécessaires.

1. Dans le Terminal, dans `trajetpro-app` :
   ```bash
   npm install -g @capacitor/assets
   npx capacitor-assets generate
   ```

2. ✅ Les icônes et splash sont maintenant générés dans `ios/App/App/Assets.xcassets/` et `android/app/src/main/res/`

---

# 📆 JOUR 5 — Premier build iOS (2h)

## Étape 16 — Ouvrir le projet dans Xcode

```bash
npx cap sync
npx cap open ios
```

## Étape 17 — Configurer la signature

1. Dans Xcode, clique sur **"App"** tout en haut de l'arborescence gauche
2. Onglet **"Signing & Capabilities"**
3. **Coche** "Automatically manage signing"
4. **Team** : choisis ton compte Apple Developer
   - Si vide : Xcode → Settings → Accounts → + → Apple ID → connecte-toi avec ton Apple ID développeur
5. **Bundle Identifier** : `com.trajetpro.app` (déjà configuré)

## Étape 18 — Choisir un simulateur iPhone

1. En haut de Xcode, à côté du bouton Play ▶️, tu vois un sélecteur de device
2. Clique dessus → choisis **"iPhone 15 Pro"**

## Étape 19 — Lancer l'app !

1. Clique le **gros bouton Play ▶️** en haut à gauche
2. **Attends 3-5 minutes** le premier build
3. Le simulateur iPhone s'ouvre automatiquement
4. **Ton app TrajetPro s'ouvre sur l'iPhone virtuel !** 🎉

### 🚨 Si ça échoue

**"Build failed"** :
- Menu **Product → Clean Build Folder** (Cmd+Shift+K)
- Puis Play ▶️ à nouveau

**"No account for team"** :
- Xcode → Settings → Accounts → Ajoute ton Apple ID

**"Pod install failed"** :
- Terminal : `cd ios/App && pod install`

## Étape 20 — Tester sur ton vrai iPhone

1. Connecte ton iPhone à ton Mac avec le câble
2. Déverrouille l'iPhone
3. Accepte "Faire confiance à cet ordinateur"
4. Dans Xcode, change le device (en haut) pour **ton iPhone physique**
5. Clique Play ▶️
6. **La première fois**, iOS va refuser de lancer une app d'un "développeur non fiable"
7. Sur ton iPhone : **Réglages → Général → VPN et gestion d'appareil** → clique sur ton nom → **"Faire confiance"**
8. Relance l'app depuis l'écran d'accueil

**Ton app TrajetPro tourne sur ton vrai iPhone !** 🎉🎉

---

# 📆 JOUR 6 — Premier build Android (2h)

## Étape 21 — Ouvrir le projet Android

```bash
npx cap sync
npx cap open android
```

## Étape 22 — Lancer sur l'émulateur

1. En haut d'Android Studio, tu vois un sélecteur de device
2. Choisis ton émulateur Pixel 7
3. Clique le bouton **Run ▶️** (vert, en haut)
4. **Attends 3-10 min** le premier build (Gradle est lent la première fois)
5. L'émulateur Pixel 7 s'ouvre avec ton app TrajetPro

## Étape 23 — Tester sur ton vrai téléphone Android

1. Sur ton téléphone, active le **mode développeur** :
   - Réglages → À propos du téléphone → **Tape 7 fois sur "Numéro de build"**
   - Tu verras "Vous êtes maintenant développeur"
2. Retourne dans Réglages → **Options pour développeurs** → active **"Débogage USB"**
3. Branche ton téléphone à l'ordi
4. Accepte l'autorisation de débogage sur le téléphone
5. Dans Android Studio, ton téléphone apparaît dans le sélecteur
6. Clique Run ▶️
7. **Ton app TrajetPro s'installe et se lance sur ton téléphone !**

---

# 📆 JOUR 7 — Builds de production signés (2h)

Les builds d'aujourd'hui n'étaient que pour tester. Pour **publier sur les stores**, il faut créer des builds **signés**.

## Étape 24 — Build iOS signé (.ipa)

1. Dans Xcode, en haut, change le device en **"Any iOS Device (arm64)"**
2. Menu **Product → Archive**
3. **Attends 5-15 min**
4. Une fenêtre **Organizer** s'ouvre automatiquement
5. Sélectionne ton archive → **"Distribute App"**
6. Choisis **"App Store Connect"** → **Next**
7. Choisis **"Upload"** → **Next**
8. Options par défaut, valide tout
9. Sign avec ton compte Apple → **Upload**
10. ✅ **L'archive est uploadée sur App Store Connect !**

⚠️ **Incrémentation de version :** à chaque nouveau build, tu dois incrémenter le **Build number** dans Xcode (sinon Apple rejette). Clic sur App → onglet General → Build : mets 2, puis 3, etc.

## Étape 25 — Build Android signé (.aab)

1. Dans Android Studio, menu **Build → Generate Signed Bundle / APK**
2. Choisis **"Android App Bundle"** (.aab, recommandé par Google)
3. Clique **Next**

4. **Première fois UNIQUEMENT :** clique **"Create new..."** pour générer la clé de signature
   - **Key store path** : clique le bouton "..." → crée un dossier sécurisé (ex: `~/keystores/`) → nomme le fichier `trajetpro.jks`
   - **Password** : génère un mot de passe fort, **sauvegarde-le immédiatement dans ton gestionnaire**
   - **Alias** : `trajetpro`
   - **Validity (years)** : `25`
   - **Certificate info** : remplis avec tes vraies infos entreprise

5. ⚠️⚠️⚠️ **CRITIQUE : SAUVEGARDE ce fichier `trajetpro.jks` IMMÉDIATEMENT** :
   - **Copie-le** sur un disque externe
   - **Copie-le** dans un cloud chiffré (Bitwarden Send, Proton Drive)
   - **Copie-le** dans un email à toi-même sur un autre compte

   **SI TU PERDS CE FICHIER, tu ne pourras PLUS JAMAIS mettre à jour ton app Android. Tu devrais republier sous un NOUVEAU nom.** C'est la règle n°1 du développement Android.

6. Clique **Next**

7. **Build Variants** : choisis **"release"**

8. Clique **"Finish"**

9. **Attends 5-15 min**

10. ✅ Un fichier `.aab` est généré dans `android/app/release/app-release.aab`

---

## 🎉 Récapitulatif de ce que tu as fait

- ✅ Xcode + Android Studio installés
- ✅ Capacitor configuré avec iOS + Android
- ✅ Permissions déclarées sur les 2 plateformes
- ✅ Icônes et splash screen générés
- ✅ App testée sur simulateur ET sur vrai téléphone iOS
- ✅ App testée sur émulateur ET sur vrai téléphone Android
- ✅ Archive iOS uploadée sur App Store Connect
- ✅ Fichier .aab Android prêt à upload

**C'était la phase la plus dure. Si tu l'as complétée, tu as réellement les compétences d'un développeur mobile junior.** 🏆

---

## 🚨 Dépannage général

### "Xcode dit : No signing certificate found"

→ Xcode → Settings → Accounts → Download manual profiles

### "Gradle Sync failed"

→ Android Studio → File → Invalidate Caches → Invalidate and Restart

### "Mon app crash au démarrage sur mobile"

→ Dans Xcode, menu Debug → View Debug Area → Show Debug Area pour voir les logs
→ Dans Android Studio, onglet Logcat en bas pour voir les logs

### "Je suis bloqué, rien ne marche"

**Option de secours : déléguer à un freelance**

Si tu es vraiment bloqué, voici le message à envoyer à un freelance mobile :

> Bonjour, j'ai une app React + Capacitor déjà développée qui fonctionne en web. J'ai besoin de quelqu'un pour :
> 1. Compiler les builds iOS et Android
> 2. Gérer les signatures et certificats
> 3. Préparer les screenshots et icônes
> 4. Soumettre aux 2 stores
> J'ai déjà les comptes Apple Developer et Google Play. Budget : 500-1000€. Délai : 1 semaine.

Avec ce brief clair, un bon freelance iOS/Android peut faire cette phase en 2-3 jours.

---

## 🎓 Ce que tu as appris

- **Le fonctionnement de Xcode et Android Studio**
- **La signature d'apps mobiles** (un concept crucial)
- **La notion de "bundle ID" / "package name"**
- **Les permissions mobiles**
- **Capacitor et le bridge web/natif**

**Phase 6 terminée. La suite : les tests beta avec TestFlight !** 🧪
