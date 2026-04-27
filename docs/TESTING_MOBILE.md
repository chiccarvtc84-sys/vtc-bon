# 📱 Tester TrajetPro sur Android et iOS — guide pas à pas

> **Pour qui ?** Toi, sans compétence technique en programmation.
> **Objectif :** voir l'app tourner sur un téléphone (émulateur ou réel) en moins de 2h pour Android, idem côté iOS si tu as accès à un Mac.

Tout se passe dans ton dossier projet :
```
C:\Users\zalin\Desktop\claude code\trajetpro
```

---

## 🤖 PARTIE 1 — ANDROID (Windows OK, sans Mac)

### Étape A1 — Installer Android Studio (~3 Go, 30 min)

1. Va sur **https://developer.android.com/studio**
2. Clique le gros bouton bleu **"Download Android Studio"**.
3. Accepte les conditions, télécharge l'`.exe` (~1,2 Go).
4. Lance l'installeur, **"Next"** partout, accepte les chemins par défaut.
5. À la fin de l'install, **lance Android Studio**.
6. Au premier lancement, l'assistant te demande :
   - **Import settings** → "Do not import"
   - **Send usage statistics** → comme tu veux
   - **Install Type** → **Standard** (important)
   - **UI Theme** → choisis Dark ou Light
   - **SDK Components** → coche tout ce qui est recommandé (laisse les défauts)
   - **Accept** toutes les licences
7. **Patiente 15-30 min** pendant le téléchargement du SDK Android (~2 Go).
8. Quand tu vois la fenêtre "Welcome to Android Studio", c'est bon.

### Étape A2 — Créer un émulateur Pixel (5 min)

1. Dans la fenêtre d'accueil → en bas à droite, clique **"More Actions"** puis **"Virtual Device Manager"**.
2. Clique **"Create Device"** (en haut à gauche).
3. Choisis **Pixel 7** (ou Pixel 8) → **Next**.
4. Onglet **"Recommended"** → choisis **"VanillaIceCream"** (Android 15) ou **"UpsideDownCake"** (Android 14).
   - Si l'image n'est pas téléchargée, clique le **"⬇️ Download"** à côté du nom (1-2 Go).
5. **Next** → **Finish**.
6. L'émulateur apparaît dans la liste. Clique le bouton ▶️ vert pour le lancer une fois (juste pour vérifier qu'il marche). Un Pixel virtuel s'ouvre. Tu peux le fermer ensuite.

### Étape A3 — Lancer TrajetPro sur l'émulateur (5 min)

1. Ouvre **PowerShell** (touche Windows → tape "powershell" → Enter).
2. Colle ces 2 commandes l'une après l'autre :
   ```powershell
   cd "C:\Users\zalin\Desktop\claude code\trajetpro"
   npm run cap:android
   ```
3. Patiente 30 secondes : Vite build, copy vers Android, et **Android Studio s'ouvre tout seul** sur ton projet.
4. Dans Android Studio, en haut de la fenêtre :
   - À gauche du bouton ▶️ vert, vérifie que ton émulateur Pixel 7 est sélectionné.
   - Clique le bouton ▶️ vert **"Run 'app'"** (ou raccourci `Maj+F10`).
5. **Première fois : 2-3 min** de Gradle build (barre de progression en bas). Les fois suivantes : 30 secondes.
6. Si une popup demande des permissions Java / accepter des licences SDK, clique **"Accept"**.
7. L'émulateur s'allume → TrajetPro s'installe → l'écran de bienvenue apparaît avec l'icône dorée. 🎉

### Étape A4 — Tester les fonctionnalités

Sur l'émulateur :
- **Crée un compte** : remplis le formulaire (avec **un vrai email à toi** car Supabase t'envoie un mail de confirmation).
- Va dans ta boîte mail (sur ton ordi, dans un autre onglet) → clique sur le lien.
- Reviens sur l'émulateur → clique **"Aller à la connexion"** → connecte-toi.
- Tu vois 5 crédits sur l'accueil.
- Crée un bon de course (clique sur le micro doré pour la dictée vocale).
- Émets une facture.
- Va dans **Profil → Recharger mes crédits** → choisis un pack.
- Sur Stripe Checkout : carte test `4242 4242 4242 4242`, date `12 / 34`, CVC `123`, code postal `75001`.
- Retour app → toast "✅ Paiement confirmé".

### Étape A5 — Tester sur ton vrai smartphone Android (optionnel)

1. Sur ton téléphone : **Réglages → À propos du téléphone → Numéro de build** → tape 7 fois dessus → un message dit "Vous êtes maintenant développeur".
2. **Réglages → Système → Options pour les développeurs** → active **"Débogage USB"**.
3. Branche le téléphone à l'ordi en USB. Une popup sur le téléphone : "Autoriser le débogage USB ?" → **Oui, toujours**.
4. Dans Android Studio, le menu déroulant à côté de ▶️ doit maintenant afficher **ton téléphone** au lieu de "Pixel 7" → sélectionne-le.
5. Clique ▶️. L'app s'installe directement sur ton téléphone.

### Étape A6 — Si tu modifies du code et veux retester

```powershell
cd "C:\Users\zalin\Desktop\claude code\trajetpro"
npm run cap:sync
```
Puis dans Android Studio, clique encore ▶️.

> 💡 Plus rapide pour le dev quotidien : `npm run dev` dans un terminal séparé, puis ouvrir `http://localhost:5173` dans Chrome — tu vois tout en direct sans rebuild Capacitor. Capacitor sert à valider la version finale.

### ❌ Problèmes fréquents Android

| Symptôme | Solution |
|---|---|
| "Gradle sync failed" | Menu **File → Invalidate Caches → Invalidate and Restart** |
| Émulateur ultra lent | Active **"Hardware - GLES 2.0"** dans les paramètres de l'émulateur (icône clé) |
| "JAVA_HOME is not set" | Android Studio inclut son propre Java. Menu **File → Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK** → choisir "Embedded JDK" |
| Webview blanche | Vérifie que `dist/` contient `index.html` après `npm run cap:sync` |

---

## 🍎 PARTIE 2 — iOS (Mac obligatoire)

> ⚠️ **Apple ne signe les apps iOS que via Xcode sur macOS**. Pas de Mac = pas d'iOS. Solutions :
> - Mac mini d'occasion (~600 €)
> - **MacInCloud** (location, ~25 €/mois pour 2 semaines)
> - Emprunter le Mac d'un proche
> - Ne publier que sur Android en V1

Cette partie suppose que tu as accès à un Mac avec **macOS Sonoma (14)** ou plus récent.

### Étape I1 — Transférer le projet sur le Mac

1. Sur Windows : zippe le dossier `trajetpro/` mais **sans** :
   - `node_modules/` (sera réinstallé sur Mac)
   - `dist/` (sera regénéré)
   - `android/build/`, `android/app/build/`, `android/.gradle/` (Android-only)
2. Transfère le ZIP sur le Mac (USB / Drive / mail à toi-même).
3. Sur le Mac : dézippe dans **`~/Documents/trajetpro`**.

Ou via Git si tu as poussé sur GitHub : `git clone <ton-repo> ~/Documents/trajetpro`.

### Étape I2 — Installer Xcode (~15 Go, 1-2 h)

1. Sur le Mac : ouvre **App Store** (icône bleue avec "A").
2. Cherche **"Xcode"** → **Obtenir** → **Installer**.
3. **Patiente 30 min à 2 h** selon ta connexion.
4. Lance Xcode au moins une fois → accepte les licences.
5. Ouvre **Terminal** (touche Cmd+Espace → tape "Terminal" → Enter) :
   ```bash
   xcodebuild -version
   ```
   Tu dois voir `Xcode 15.x` ou plus.

### Étape I3 — Installer Node + npm + CocoaPods

Dans le Terminal :

1. Installer **Homebrew** (gestionnaire de paquets Mac) si pas déjà :
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   Suis les instructions affichées (tape ton mot de passe Mac quand demandé).

2. Installer **Node 22 LTS** :
   ```bash
   brew install node@22
   echo 'export PATH="/opt/homebrew/opt/node@22/bin:$PATH"' >> ~/.zshrc
   source ~/.zshrc
   node --version    # doit afficher v22.x
   ```

3. Installer **CocoaPods** :
   ```bash
   sudo gem install cocoapods
   pod --version     # doit afficher 1.15.x ou plus
   ```

### Étape I4 — Préparer le projet iOS

Dans le Terminal :

```bash
cd ~/Documents/trajetpro
npm install                  # 2-3 min
cd ios/App
pod install                  # 1-2 min — télécharge les deps Capacitor iOS
cd ../..
npm run cap:sync
```

Si `pod install` plante avec "could not connect to GitHub", c'est probablement un certificat à mettre à jour :
```bash
sudo gem update --system
sudo gem install cocoapods --pre
```

### Étape I5 — Lancer sur le simulateur iPhone

```bash
cd ~/Documents/trajetpro
npm run cap:ios
```

Xcode s'ouvre tout seul sur le projet.

Dans Xcode :
1. En haut à gauche, à côté du bouton ▶️ : sélectionne **"App"** comme schéma, puis un device dans le menu déroulant → choisis **"iPhone 15 Pro"** (ou la version la plus récente).
2. Clique le bouton ▶️ noir (ou raccourci `Cmd+R`).
3. **Première fois : 3-5 min** (Xcode compile tout). Les fois suivantes : 30 secondes.
4. Le simulateur iPhone s'ouvre, TrajetPro s'installe, l'écran de bienvenue apparaît. 🎉

### Étape I6 — Tester sur un vrai iPhone (optionnel, recommandé)

Apple t'oblige à avoir **un compte Apple Developer gratuit** au minimum (l'inscription payante 99 $ / an n'est nécessaire que pour publier sur l'App Store) :

1. Va sur **https://developer.apple.com/account** → connecte-toi avec ton Apple ID.
2. Dans Xcode : menu **Xcode → Settings → Accounts** → bouton **"+"** → connecte ton Apple ID.
3. Sélectionne ton compte → bouton **"Manage Certificates"** → clique **"+"** → "Apple Development".
4. Branche ton iPhone au Mac avec un câble. Sur l'iPhone, accepte la popup "Faire confiance à cet ordinateur".
5. Sur l'iPhone : **Réglages → Confidentialité et sécurité → Mode développeur** → active. (L'iPhone redémarre.)
6. Dans Xcode : menu déroulant des devices → choisis ton iPhone (à la place de "iPhone 15 Pro").
7. Clique ▶️.
8. La 1re fois, l'iPhone refuse de lancer une app non signée par l'App Store. Sur l'iPhone : **Réglages → Général → VPN et gestion de l'appareil → Profils de développeur → Faire confiance à [ton Apple ID]**.
9. Relance depuis Xcode → l'app TrajetPro tourne sur ton iPhone réel. 🎉

> ⚠️ Une app installée par Xcode sans compte payant **expire au bout de 7 jours**. C'est juste pour tester. Pour distribuer aux bêta testeurs (TestFlight), il faudra le compte payant 99 $/an.

### Étape I7 — Si tu modifies du code

Sur le Mac :
```bash
cd ~/Documents/trajetpro
npm run cap:sync
```
Puis dans Xcode, ▶️ encore.

### ❌ Problèmes fréquents iOS

| Symptôme | Solution |
|---|---|
| `pod install` lent ou bloqué | `sudo gem install cocoapods --pre` puis réessaye |
| "Signing for App requires a development team" | Xcode → onglet **Signing & Capabilities** du projet App → coche "Automatically manage signing" → choisis ton **Team** (= ton Apple ID) |
| "Could not launch app" sur iPhone réel | Vérifie le **Mode développeur** activé sur l'iPhone, puis "Faire confiance" au profil de dev |
| WebView blanche | `npm run cap:sync` puis menu Xcode **Product → Clean Build Folder** (Cmd+Maj+K) |
| `xcrun: error: invalid active developer path` | `sudo xcode-select --reset` |

---

## 🧪 Checklist de test fonctionnel à faire sur chaque plateforme

Une fois l'app lancée (Android et/ou iOS), passe en revue :

### Auth
- [ ] Inscription avec un email réel → écran "vérifiez votre email"
- [ ] Lien email cliqué → confirmation Supabase → retour à login
- [ ] Connexion → 5 crédits visibles sur l'accueil
- [ ] Déconnexion → retour à l'écran de bienvenue, **immédiat**
- [ ] Reconnexion → données précédentes toujours là

### Bons de course (Phase 4)
- [ ] Créer un bon manuellement → -1 crédit, apparaît dans la liste
- [ ] Créer un bon par dictée vocale (autorise le micro quand demandé)
- [ ] Modifier un bon existant → gratuit, mise à jour OK
- [ ] Supprimer un bon → confirmation, disparaît de la liste

### Factures (Phase 4)
- [ ] Émettre une facture depuis un bon → -1 crédit, facture créée
- [ ] Vérifier dans la table `invoices` Supabase : numéro `FAC-2026-XXXX`, fingerprint SHA-256

### Crédits (Phase 5 — Stripe)
- [ ] **Profil → Recharger mes crédits** → choisir un pack
- [ ] Redirection Stripe Checkout (en français)
- [ ] Carte test `4242 4242 4242 4242`, date `12/34`, CVC `123`, CP `75001`
- [ ] Retour app → toast "✅ Paiement confirmé. N crédits ajoutés"
- [ ] Vérifier dans Supabase : nouvelle ligne dans `token_transactions` (kind=purchase) + nouvelle ligne `invoices` (numéro `TRP-2026-XXXX`, status='paid', QR code rempli)

### Parrainage
- [ ] Inscription d'un 2e compte avec le **code de parrainage** d'un parrain existant (ex `D1C1D776` pour `bidbuh22@gmail.com`)
- [ ] Confirmation email + login du filleul
- [ ] Vérifier : filleul a +5 (welcome) +5 (referral_bonus) = 10 crédits ; parrain a +10 crédits

### Hors-ligne (Phase 6)
- [ ] Active le **mode avion** sur le téléphone → bandeau rouge "Hors-ligne" en haut de l'app
- [ ] Désactive le mode avion → bandeau disparaît, données rechargées

### Anti-fraude
- [ ] Tente une inscription avec un email jetable (`test@yopmail.com`) → erreur affichée
- [ ] Tente avec un SIRET invalide (ex `00000000000000`) → erreur "SIRET invalide"

---

## 🆘 Si quelque chose plante

1. **Capture d'écran** du problème.
2. **Copie le message d'erreur** complet.
3. Dans Android Studio / Xcode, ouvre **Logcat** (Android) ou **Console** (Xcode) pour voir les logs détaillés.
4. Reviens me voir avec ces 3 éléments → je débogue.

Bon test ! 🚀
