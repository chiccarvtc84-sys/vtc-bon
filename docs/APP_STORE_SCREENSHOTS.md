# 📸 Screenshots App Store — guide de capture

⚠️ **Pré-requis : un Mac avec Xcode 15+** (ou un service cloud type MacInCloud à 30 €/mois). Impossible de générer ces captures depuis Windows.

---

## 🎯 Tailles requises par Apple (2026)

Apple n'exige plus que **2 tailles** d'iPhone, plus une optionnelle iPad :

| Device | Résolution | Nb captures min | Nb captures max |
|---|---|---|---|
| iPhone 6.9" (16 Pro Max) | 1320 × 2868 px (portrait) | 3 | 10 |
| iPhone 6.5" (11 Pro Max, fallback) | 1242 × 2688 px (portrait) | 0 (ou 3-5) | 10 |
| iPad Pro 13" (optionnel) | 2064 × 2752 px | 0 | 10 |

> **Astuce** : si tu fais juste les screenshots iPhone 6.9", Apple les utilisera automatiquement comme fallback pour les iPhones 6.5" (tu peux laisser cette section vide). C'est le chemin le plus rapide.

---

## 🛠️ Méthode 1 — Captures depuis le simulateur iOS (RECOMMANDÉ)

C'est la méthode la plus simple et celle qu'Apple préfère. Sur ton Mac :

### Étape 1 — Lancer le simulateur dans la bonne taille

```bash
# Dans le dossier trajetpro/ sur le Mac
npm install
npx cap sync ios
cd ios/App
pod install     # première fois seulement
open App.xcworkspace
```

Dans Xcode :
1. En haut de la fenêtre, choisis le device cible : **iPhone 16 Pro Max** (résolution exacte 1320×2868)
2. **Cmd + R** pour lancer le simulateur

Une fois l'app lancée et stable :
3. Dans la barre Xcode → menu **Debug → Pause** quand l'app est sur l'écran que tu veux capturer
4. Dans le simulateur lui-même → menu **File → New Screen Shot** (`Cmd + S`)
5. La capture se sauvegarde sur le Bureau du Mac à la résolution exacte requise

### Étape 2 — Quels écrans capturer (5 captures recommandées)

Voici les 5 écrans à capturer dans l'ordre, qui racontent une histoire à l'utilisateur App Store :

#### 1️⃣ Écran d'accueil — "Premier coup d'œil"
- Login après inscription (5 crédits offerts visibles)
- Mets en avant le solde de tokens et le bouton "Nouveau bon"
- 📝 **Texte d'accroche** (ajouté en post-prod) : "Vos bons de course en 5 secondes"

#### 2️⃣ Dictée vocale — "Le wow moment"
- Modal de dictée ouverte, micro actif, mots qui défilent ("Je récupère monsieur Karim…")
- Capture pendant que la transcription se fait visible
- 📝 **Texte** : "Dictez votre course. L'IA s'occupe du reste."

#### 3️⃣ Bon de course pré-rempli — "Le résultat"
- Le formulaire `Nouveau bon` rempli automatiquement après dictée
- Bannière verte "Compris par l'IA"
- Tous les champs propres : prénom, nom, lieu, distance, prix
- 📝 **Texte** : "Vérifiez, validez, c'est fait."

#### 4️⃣ Facture conforme — "La conformité"
- Une facture générée avec QR code, empreinte fiscale, mentions VTC
- Beau design sombre avec doré
- 📝 **Texte** : "Factures conformes décret 2017-483 + CGI"

#### 5️⃣ Dashboard / liste — "La maîtrise"
- Liste des bons + total mensuel / chiffre d'affaires
- Sentiment de contrôle, professionnel
- 📝 **Texte** : "Toute votre activité en un coup d'œil"

### Étape 3 — Préparer un compte de démo "joli"

Avant de capturer, crée 5-10 fausses courses dans l'app pour que les listes ne soient pas vides :

```
Course 1 : M. Karim Benali — Avignon TGV → Marignane — 95 km — 130 €
Course 2 : Mme Sophie Martin — Hôtel Mercure → Aéroport Marseille — 32 km — 65 €
Course 3 : M. Yacine Diallo — Sorgues → Avignon centre — 12 km — 22 €
Course 4 : M. Jean Dubois — Gare TGV Avignon → Aix-en-Provence — 78 km — 95 €
Course 5 : Mme Aïcha Traoré — Vaucluse Hôtel → Avignon centre — 8 km — 18 €
```

Émets aussi 2-3 factures sur ces courses pour que l'écran "Factures" soit rempli.

---

## 🎨 Méthode 2 — Mockups stylisés avec previewed.app (RECOMMANDÉ pour la v1.1)

Pour la v1.0 les screenshots simulateur suffisent. Pour la v1.1 et au-delà, tu peux upgrader :

1. Va sur https://previewed.app (gratuit jusqu'à 3 export par mois)
2. Choisis "iPhone 16 Pro Max — Portrait"
3. Upload tes screenshots simulateur
4. Ajoute par dessus :
   - Un fond dégradé (or → noir) aux couleurs TrajetPro
   - Un titre marketing en haut ("Vos bons en 5 secondes")
   - Un sous-titre ("Dictée vocale intelligente")
   - Le device frame iPhone autour du screenshot
5. Export en 1320 × 2868
6. Upload dans App Store Connect

Résultat : screenshots qui ressemblent à ceux des grandes apps premium (Notion, Linear, Stripe). Conversion x2 vs screenshots simulateur bruts.

Alternatives à previewed.app :
- https://app.shotbot.io (60 €/an, plus de templates)
- https://screenshot.rocks (gratuit, plus basique)
- Figma (gratuit) avec un template Apple Mockup

---

## 🚀 Méthode 3 — fastlane snapshot (avancé, automatisable)

Pour les versions futures où tu mets à jour l'app souvent :

```bash
# Sur le Mac
sudo gem install fastlane
cd ios/App
fastlane snapshot init
# Édite Snapfile avec les langues et devices
# Édite SnapfileUITests avec les écrans à capturer
fastlane snapshot
```

fastlane lance le simulateur dans plusieurs tailles, navigue automatiquement dans l'app via tests UI, capture chaque écran, et génère les fichiers nommés correctement.

**Investissement** : 2-4 h de setup la première fois, puis 1 commande à chaque release. Recommandé seulement si tu prévois de releaser souvent (mensuel ou plus).

---

## 📐 Règles de design App Store qui font rejeter

❌ **Ne pas faire** :
- Texte illisible (trop petit, contraste faible)
- Fonctions qui n'existent pas dans l'app
- Comparaisons avec des concurrents nommés (Uber, Bolt, …)
- Logos Apple / iOS
- Captures de simulateur avec le **statusbar simulator** (heure 9:41 par défaut OK, mais pas de "iPhone Simulator" en haut)
- Captures qui montrent du Lorem ipsum
- Filigranes "DEMO" / "TEST"

✅ **À faire** :
- Vraies données qui ressemblent à un usage réel (les 5 fausses courses ci-dessus)
- Status bar avec batterie pleine, signal max, heure 9:41 (Apple le fait sur ses propres screenshots)
- Texte d'accroche en français clair
- Cohérence visuelle entre les 5 captures (même style de mockup, mêmes couleurs)

Pour figer le statusbar à 9:41, batterie 100%, signal max dans le simulateur :
```bash
xcrun simctl status_bar booted override --time "9:41" --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3
```

---

## 🇬🇧 Versions multilingues

Si tu listes l'app en français + anglais (recommandé pour scope international) :

1. Capture une fois en simulateur français (langue système iOS = FR)
2. Change la langue système iOS du simulateur en EN
3. Re-capture les mêmes écrans
4. Upload les 2 jeux dans App Store Connect (onglet par langue)

Pour changer la langue dans le simulateur :
```
Réglages → Général → Langue et région → iPhone Language → English
```

---

## 📦 Livrable attendu pour la soumission

Dossier sur ton Mac, prêt à uploader dans App Store Connect :
```
screenshots/
├── fr-FR/
│   ├── 6.9-iphone/
│   │   ├── 01-accueil.png       (1320 × 2868)
│   │   ├── 02-dictee-vocale.png (1320 × 2868)
│   │   ├── 03-bon-rempli.png    (1320 × 2868)
│   │   ├── 04-facture.png       (1320 × 2868)
│   │   └── 05-dashboard.png     (1320 × 2868)
│   └── 6.5-iphone/  (optionnel — Apple peut utiliser le 6.9 en fallback)
└── en-US/  (si listing international)
    └── 6.9-iphone/
        └── ...
```

Une fois prêt, ouvre App Store Connect → ton app → "iOS App 1.0" → "iPhone Screenshots" → drag-and-drop des 5 fichiers dans l'ordre.
