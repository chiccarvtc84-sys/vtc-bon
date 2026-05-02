# ✅ Checklist finale — à cocher AVANT de cliquer "Submit"

> Imprime cette page (ou ouvre-la sur un 2e écran) et coche en faisant.

---

## 📋 PRÉPARATION GÉNÉRALE (avant tout)

- [ ] **Email pro** créé (`contact@trajetpro.fr` ou autre)
- [ ] **Compte Google dédié** créé (jamais ton perso)
- [ ] **Apple ID dédié** créé (`contact@trajetpro.fr`)
- [ ] **Carte bancaire** prête à être débitée (124 €)
- [ ] **Infos légales** rassemblées sur papier :
  - [ ] SIRET (14 chiffres)
  - [ ] Nom commercial / raison sociale
  - [ ] Adresse de domiciliation complète
  - [ ] Forme juridique (auto-entrepreneur / SASU / EURL…)
  - [ ] Ville du tribunal de commerce
  - [ ] N° TVA intracommunautaire (si applicable)

---

## 📜 SITE LÉGAL (commun aux 2 stores)

- [ ] **`git push`** effectué sur GitHub
- [ ] **GitHub Pages activé** (Settings → Pages → main `/docs`)
- [ ] **URL testée** : `https://chiccarvtc84-sys.github.io/vtc-bon/` s'affiche
- [ ] **Pages remplies** (plus aucun `[XXX]` rouge) :
  - [ ] `privacy.html` — toutes les mentions remplacées
  - [ ] `terms.html` — toutes les mentions remplacées
  - [ ] `legal.html` — toutes les mentions remplacées
- [ ] Page testée mobile (sur ton iPhone/Android) — affichage propre
- [ ] **Bonus** : avocat consulté pour relecture (200-400 €) — *optionnel mais recommandé*

---

## 🍎 APP STORE (iPhone)

### Étape 1 — Compte développeur
- [ ] Inscription Apple Developer Program (99 €/an) effectuée
- [ ] Email "Welcome to the Apple Developer Program" reçu
- [ ] Connexion à App Store Connect réussie

### Étape 2 — Build (sur Mac)
- [ ] Xcode installé (Mac App Store)
- [ ] Repo cloné sur le Mac
- [ ] `npm install` + `npx cap sync ios` effectués
- [ ] `pod install` effectué dans `ios/App`
- [ ] Bundle ID = `com.trajetpro.app` dans Xcode
- [ ] Team Apple sélectionnée
- [ ] App testée sur simulateur iPhone 16 Pro Max
- [ ] App testée sur **iPhone physique réel** (au moins 1)
- [ ] Permissions OK : micro, reconnaissance vocale, notifications

### Étape 3 — Screenshots (sur Mac)
- [ ] Compte démo créé dans l'app simulée (`demo@trajetpro.fr`)
- [ ] 5 fausses courses créées
- [ ] 2-3 factures émises
- [ ] **Status bar overridé** (heure 9:41, batterie 100%, signal max) :
  ```
  xcrun simctl status_bar booted override --time "9:41" \
    --batteryState charged --batteryLevel 100 \
    --cellularBars 4 --wifiBars 3
  ```
- [ ] 5 screenshots capturés en 1320×2868 :
  - [ ] 01 — Accueil avec solde tokens
  - [ ] 02 — Modal dictée vocale
  - [ ] 03 — Bon de course pré-rempli
  - [ ] 04 — Facture conforme générée
  - [ ] 05 — Liste des bons / dashboard

### Étape 4 — Fiche App Store Connect
- [ ] App créée (nom, langue, bundle ID, SKU)
- [ ] **Pricing** : Free
- [ ] **Subtitle** copié depuis `APP_STORE_MARKETING.md`
- [ ] **Promotional Text** copié
- [ ] **Description** copiée (≤ 4000 chars)
- [ ] **Keywords** copiés (≤ 100 chars, sans concurrents)
- [ ] **Category** : Business + Productivité
- [ ] **Support URL** : `https://chiccarvtc84-sys.github.io/vtc-bon/`
- [ ] **Marketing URL** : pareil
- [ ] **Privacy Policy URL** : `https://chiccarvtc84-sys.github.io/vtc-bon/privacy.html`
- [ ] **App Icon 1024×1024** uploadée (`submission/store-graphics/appstore-icon-1024.png`)
- [ ] **Screenshots iPhone 6.9"** (5 fichiers) uploadés dans l'ordre

### Étape 5 — App Privacy
- [ ] Tableau des données rempli (voir `APP_STORE_MARKETING.md` § "Data Types collected")
- [ ] Aucune fausse déclaration ("None of these apply" si tu ne collectes pas)

### Étape 6 — Build
- [ ] Dans Xcode : **Any iOS Device (arm64)** sélectionné
- [ ] **Product → Archive** lancé
- [ ] Archive **uploadée** vers App Store Connect
- [ ] Build apparaît dans App Store Connect → TestFlight (status "Ready to Submit")
- [ ] Build sélectionné dans la fiche

### Étape 7 — App Review Information
- [ ] **Compte de test** créé dans l'app et fonctionnel :
  - Email : `apple-review@trajetpro.fr`
  - Password : `____________________`
  - Token balance > 0 sur ce compte
- [ ] **Notes pour le reviewer** copiées depuis `APP_STORE_MARKETING.md`
- [ ] **Demo account credentials** renseignés
- [ ] Téléphone de contact joignable (le reviewer peut appeler)

### Étape 8 — Submit
- [ ] Tout est en ✅ vert dans App Store Connect
- [ ] Cliqué **"Add for Review"**
- [ ] Cliqué **"Submit to App Review"**
- [ ] Email de confirmation reçu

⏳ **Attendre 1-7 jours**. Email "In Review", puis "Approved" ou "Rejected".

---

## 🤖 GOOGLE PLAY (Android)

### Étape 1 — Compte développeur
- [ ] Inscription Google Play Console (25 € one-shot) effectuée
- [ ] Vérification d'identité validée (1-3 jours)
- [ ] Connexion à Play Console réussie

### Étape 2 — Keystore (UNE SEULE FOIS DANS TA VIE)
- [ ] Keystore généré : `keytool -genkey -v -keystore trajetpro-release.keystore …`
- [ ] **Mot de passe noté** (au moins 12 chars)
- [ ] **Sauvegarde 1 — Cloud chiffré** (OneDrive / GDrive / Dropbox)
- [ ] **Sauvegarde 2 — Clé USB** dans un tiroir sûr
- [ ] **Sauvegarde 3 — Email à toi-même**
- [ ] Note avec mot de passe sauvegardée séparément (pas dans le même endroit que le fichier keystore !)
- [ ] `android/keystore.properties` créé et **dans `.gitignore`** (vérifie : `git status` ne doit pas le voir)

### Étape 3 — Build .aab (sur Windows)
- [ ] `npm run build` réussi
- [ ] `npx cap sync android` réussi
- [ ] `cd android; .\gradlew.bat bundleRelease` réussi
- [ ] Fichier `android/app/build/outputs/bundle/release/app-release.aab` existe (~5-15 MB)

### Étape 4 — Screenshots Android (sur Windows)
- [ ] Android Studio installé
- [ ] Émulateur Pixel 8 Pro créé
- [ ] App lancée sur émulateur
- [ ] 3-5 screenshots capturés (1080×2400 portrait)
- [ ] Idéalement : screenshots embellis avec previewed.app ou Figma (optionnel)

### Étape 5 — Fiche Play Console
- [ ] App créée (nom, langue, gratuite)
- [ ] **App name** : `TrajetPro · Bons VTC`
- [ ] **Short description** copiée (≤ 80 chars)
- [ ] **Full description** copiée (≤ 4000 chars)
- [ ] **App icon 512×512** uploadée (`submission/store-graphics/playstore-icon-512.png`)
- [ ] **Feature graphic 1024×500** uploadée (`submission/store-graphics/playstore-feature-1024x500.png`)
- [ ] **Screenshots téléphone** uploadés (3-5 minimum)
- [ ] **Catégorie** : Productivity
- [ ] **Tags** : Voyage, Économie, Outils
- [ ] **Email de contact** : `contact@trajetpro.fr`
- [ ] **Site web** : `https://chiccarvtc84-sys.github.io/vtc-bon/`
- [ ] **Privacy policy URL** : `https://chiccarvtc84-sys.github.io/vtc-bon/privacy.html`
- [ ] **Adresse pro** renseignée

### Étape 6 — App content
- [ ] **App access** : test login fourni si l'app n'est pas accessible sans compte
- [ ] **Ads** : No
- [ ] **Content rating** : questionnaire IARC complété → PEGI 3 obtenu
- [ ] **Target audience** : 18+
- [ ] **News app** : No
- [ ] **COVID-19 contact tracing** : No
- [ ] **Data safety** : tableau rempli (voir `GOOGLE_PLAY_MARKETING.md`)
- [ ] **Government app** : No

### Étape 7 — Production release
- [ ] **Production → Create new release**
- [ ] `app-release.aab` uploadé
- [ ] **Play App Signing** activé (Google garde une copie de la clé — sécurité)
- [ ] **Release name** : `1.0.0`
- [ ] **Release notes** : "Première version. Bons de course VTC, factures conformes, dictée vocale, parrainage."
- [ ] Tous les ✅ verts dans le menu de gauche
- [ ] **Review release** → **Start rollout to Production**

⏳ **Attendre 24-48h**. Email "App reviewed".

---

## 🎯 APRÈS LA PUBLICATION

### Si Apple ou Google rejette
- [ ] Lis le message de rejet attentivement
- [ ] Identifie la cause précise
- [ ] Corrige (souvent : permissions Info.plist, compte démo, IAP)
- [ ] Re-soumets (gratuit)

### Si tout passe ✅
- [ ] **Annonce sur tes réseaux** : LinkedIn, Facebook chauffeurs VTC, forums VTC
- [ ] **Programme de parrainage activé** : utilise ton propre code de parrainage à toi
- [ ] **Stripe en mode Live** vérifié (devrait déjà l'être, voir `MEMORY.md`)
- [ ] **Backup keystore vérifié** (test : peux-tu rebuild en cas de besoin ?)
- [ ] **Monitoring** : check logs Supabase 1× par jour les 7 premiers jours
- [ ] **Support actif** : check `contact@trajetpro.fr` 2× par jour

---

## 💰 Suivi du budget

- [ ] Apple Developer : 99 €/an (à renouveler chaque année !)
- [ ] Google Play : 25 € (une seule fois, à vie)
- [ ] Domaine `trajetpro.fr` (optionnel) : 12 €/an
- [ ] Mac (si achat) : 500-1000 €
- [ ] Mac (si MacInCloud) : 30 €/mois
- [ ] **Total minimum** : 124 € (Apple + Google)
- [ ] **Total avec Mac cloud + domaine** : ~166 € (1er mois)

---

## 📞 En cas de blocage

| Problème | Solution |
|---|---|
| Apple Developer pas validé en 48h | Email à `enrollment@apple.com` avec ton numéro de demande |
| Google Play vérification d'identité bloquée | Re-soumets les docs, parfois faut 3 essais |
| Build Xcode échoue | Demande à Claude (moi) de regarder l'erreur |
| Build Gradle échoue | Demande à Claude, souvent un chemin de keystore mal configuré |
| Apple rejette IAP / Stripe | Voir `PUBLICATION_GUIDE.md` § "Q1. Apple va-t-il rejeter…" |
| Compte démo Apple ne marche pas | Re-tester le login en simulateur AVANT de soumettre |

---

**Quand tu auras coché toutes les cases, ton app sera dans les 2 stores. 🎉**
