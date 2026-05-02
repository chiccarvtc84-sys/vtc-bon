# 📝 Copy marketing — Google Play Console

> Copier-coller direct dans Google Play Console lors de la création de la fiche.
> Google Play est plus permissif qu'Apple : la review est plus rapide (24-48h en moyenne) et les rejets moins fréquents.

---

## 🇫🇷 Version française (langue par défaut)

### Nom de l'application (max 30 caractères)

```
TrajetPro · Bons VTC
```
**(20 caractères ✅)**

### Description courte (max 80 caractères)

```
Bons de course VTC en 5s par dictée vocale. Factures conformes décret 2017-483.
```
**(80 caractères pile ✅)**

### Description complète (max 4000 caractères)

```
TrajetPro est l'application des chauffeurs VTC indépendants exigeants. Créez vos bons de course en 5 secondes par dictée vocale, émettez vos factures conformes au décret 2017-483, et gardez la maîtrise totale de votre activité — sans paperasse, sans abonnement, sans publicité.

✨ POURQUOI TRAJETPRO

🎯 Conformité 100 % française
Vos bons et factures incluent automatiquement votre SIRET, votre numéro VTC, votre carte professionnelle, votre immatriculation et le modèle de votre véhicule. Conforme décret n° 2017-483 et au Code général des impôts.

🎙️ Dictée vocale intelligente
Appuyez, parlez 5 secondes ("Je récupère monsieur Karim à la gare TGV d'Avignon, je le dépose à Marignane, 95 km, 130 euros") — l'IA remplit le bon. Comprend les accents et corrige les erreurs phonétiques courantes.

📋 Factures automatiques
Avec empreinte fiscale SHA-256 et QR code, numérotation chronologique sans rupture, archivage 10 ans conforme CGI. Génération PDF instantanée pour envoi à vos clients.

💸 Pas d'abonnement
Vous payez uniquement les crédits dont vous avez besoin. 5 crédits offerts à l'inscription, +1 crédit chaque mois, packs à partir de 2 €.


🎯 FONCTIONS PRINCIPALES

• Bons de course pré-remplis (client, lieu, distance, prix)
• Factures conformes avec mentions légales obligatoires
• Suivi mensuel de votre chiffre d'affaires
• Notifications de rappel avant chaque course (T-3h, T-1h, T-15min)
• Programme de parrainage : +10 crédits par filleul
• Mode invité pour tester sans inscription
• Mode hors ligne (bons synchronisés à la reconnexion)


🔒 SÉCURITÉ ET CONFIDENTIALITÉ

• Hébergement européen (région Paris) — RGPD strict
• Aucune publicité, aucune vente de données
• Mots de passe vérifiés contre les fuites HaveIBeenPwned
• Chiffrement SSL/TLS de bout en bout
• Anti-fraude par empreinte d'appareil (Google Play Integrity)


💼 POUR QUI ?

Chauffeurs VTC indépendants disposant d'un SIRET, d'une inscription EVTC et d'une carte professionnelle. Conçue pour les pros qui veulent un outil simple, rapide et conforme — pas une usine à gaz.


💬 SUPPORT

Pour toute question : contact@trajetpro.fr
Réponse sous 24-48 h ouvrées.


📜 INFORMATIONS LÉGALES

Politique de confidentialité : https://chiccarvtc84-sys.github.io/vtc-bon/privacy.html
Conditions d'utilisation : https://chiccarvtc84-sys.github.io/vtc-bon/terms.html

TrajetPro est un outil de gestion. Le chauffeur reste seul responsable de la conformité réglementaire et fiscale de son activité.
```
**(2 250 caractères environ ✅, sous la limite de 4000)**

---

## 🎯 Champs additionnels Google Play Console

### Catégorie de l'application
**Productivité** (catégorie principale)
**Économie et finance** (catégorie secondaire)

### Tags (5 max — Google les choisit dans une liste)
- `Productivité`
- `Voyage et navigation`
- `Économie et finance`
- `Outils`
- `Affaires`

### Email de contact (obligatoire, public)
```
contact@trajetpro.fr
```

### Site web (optionnel, public)
```
https://chiccarvtc84-sys.github.io/vtc-bon/
```

### Numéro de téléphone (optionnel, public — déconseillé pour ta vie privée)
*Laisser vide.*

### Politique de confidentialité (obligatoire)
```
https://chiccarvtc84-sys.github.io/vtc-bon/privacy.html
```

### Adresse de l'entreprise (obligatoire)
*À remplir avec ton adresse réelle de domiciliation.*

---

## 🎨 Visuels exigés par Google Play

| Asset | Dimensions | Fichier prêt |
|---|---|---|
| Icône haute résolution | 512 × 512 px | ✅ `submission/store-graphics/playstore-icon-512.png` |
| Feature graphic (bandeau) | 1024 × 500 px | ✅ `submission/store-graphics/playstore-feature-1024x500.png` |
| Screenshots téléphone | min 320 px, max 3840 px (ratio 16:9 ou 9:16) | ❌ À capturer (voir guide) |
| Vidéo promo (optionnelle) | YouTube link | — (optionnelle, pas pour la v1.0) |

### Screenshots Play Store (au moins 2, max 8)

Recommandé : 4-6 captures en orientation **portrait**, taille `1080 × 1920` (ratio 9:16).

Les mêmes captures qu'iOS conviennent — il suffit de les recadrer à 1080×1920 si elles font 1290×2796 (ratio iOS plus haut). Voir `submission/SCREENSHOTS_GUIDE.md`.


---

## 🎬 Classification du contenu (questionnaire IARC)

Lors de la soumission, Google Play te fait remplir un **questionnaire IARC** (International Age Rating Coalition) qui détermine la classification d'âge automatiquement.

Réponses pour TrajetPro (toutes en "Non") :
- Violence ? → **Non**
- Contenu sexuel ? → **Non**
- Langage vulgaire ? → **Non**
- Substances réglementées (alcool, tabac, drogues) ? → **Non**
- Jeux d'argent ? → **Non**
- Échanges entre utilisateurs (chat, partage) ? → **Non**
- Localisation partagée ? → **Non** (la geolocalisation n'est pas active)
- Achats intégrés ? → **Oui** (achat de crédits via Stripe)
- Publicité ? → **Non**

**Résultat attendu** : classification **PEGI 3** ("Tous publics").


---

## 🔐 Section "Sécurité des données" (équivalent App Privacy d'Apple)

À déclarer dans Play Console → "App content" → "Data safety" :

| Type | Collecté ? | Partagé ? | Optionnel ? | Finalité |
|---|---|---|---|---|
| **Email** | ✅ | ❌ | ❌ Obligatoire | Authentification, comm. compte |
| **Nom** | ✅ | ❌ | ✅ Optionnel | Personnalisation |
| **Numéro de téléphone** | ⚠️ | ❌ | ✅ Optionnel | Support client |
| **Adresse postale** | ⚠️ | ❌ | ✅ Optionnel | Facturation |
| **Identifiants utilisateur** | ✅ | ❌ | ❌ Obligatoire | Authentification, anti-fraude |
| **Mot de passe** | ✅ (chiffré) | ❌ | ❌ Obligatoire | Authentification |
| **Achats / historique** | ✅ | ❌ | ❌ Obligatoire | Fournir le service, comptabilité |
| **Données diagnostic / crash** | ✅ | ❌ | ❌ Auto | Stabilité de l'app |
| **Performances de l'app** | ✅ | ❌ | ❌ Auto | Stabilité de l'app |
| Localisation (précise ou approx.) | ❌ | — | — | Non collectée |
| Photos / vidéos | ❌ | — | — | Non collectée |
| Audio | ❌ | — | — | (la dictée est traitée localement et envoyée à Gemini sans stockage côté Google) |
| Contacts | ❌ | — | — | Non collectée |
| Calendrier | ❌ | — | — | Non collectée |
| Activité de l'app | ✅ | ❌ | ❌ Obligatoire | Fournir le service |
| **Données financières (IBAN, infos bancaires)** | ❌ Non | — | — | Stripe gère, on ne les voit pas |
| **Numéro de carte bancaire** | ❌ Non | — | — | Stripe gère, on ne les voit pas |

**Toutes les données sont chiffrées en transit (HTTPS/TLS) et au repos** — coche les 2 cases correspondantes.

**Suppression des données** : oui, l'utilisateur peut demander la suppression depuis l'app (Paramètres → Supprimer mon compte) ou par email à contact@trajetpro.fr.


---

## 🇬🇧 Version anglaise (optionnelle, recommandée pour scope international)

### Title (max 30 chars)
```
TrajetPro · French VTC Pro
```

### Short description (max 80 chars)
```
French VTC trip records & invoices in 5 seconds via voice dictation.
```
**(67 chars ✅)**

### Full description (max 4000 chars)
*(version EN équivalente disponible dans `APP_STORE_MARKETING.md`, à recopier ici)*

---

## 📋 Checklist finale avant publish Play Store

- [ ] APK / AAB signé uploadé sur le track "Production"
- [ ] Icône haute résolution 512×512 uploadée
- [ ] Feature graphic 1024×500 uploadée
- [ ] Au moins 2 screenshots téléphone uploadés
- [ ] Description courte ≤ 80 chars
- [ ] Description complète ≤ 4000 chars
- [ ] Catégorie sélectionnée : Productivité
- [ ] Tags choisis (5 max)
- [ ] URL politique de confidentialité valide et publique
- [ ] Email de contact public renseigné
- [ ] Adresse de l'entreprise renseignée (obligatoire)
- [ ] Questionnaire IARC complété → PEGI 3 obtenu
- [ ] Section "Data safety" complétée
- [ ] Section "App content" : déclarations cibles → 18+, ads → no, etc.
- [ ] **Submit for review**

Délai moyen Google Play : **24-48 h** (parfois quelques heures, parfois jusqu'à 7 jours pour les nouveaux comptes développeur).
