# 🚗 TrajetPro

> Application VTC pour chauffeurs indépendants français
> Bons de course conformes au décret 2017-483 + facturation automatique

[![License](https://img.shields.io/badge/license-Proprietary-red)]() [![Stack](https://img.shields.io/badge/stack-React%20%2B%20Supabase-green)]()

## 📖 Description

TrajetPro est une application mobile (iOS + Android) qui permet aux chauffeurs VTC indépendants français de :

- 🎙️ **Créer des bons de course par dictée vocale** (5 secondes)
- 📄 **Générer des factures conformes** au CGI (numérotation, empreinte fiscale, QR code)
- 💰 **Gérer leur facturation** sans abonnement, avec un système de crédits
- 🤝 **Parrainer leurs collègues** pour gagner des crédits
- 🔒 **Conformité légale** : décret 2017-483, RGPD, TVA intracommunautaire

## 🏗️ Stack technique

- **Frontend** : React 19 + Vite
- **Mobile** : Capacitor (iOS + Android)
- **Backend** : Supabase (PostgreSQL + Auth + Edge Functions)
- **Paiements** : Stripe
- **Hébergement** : Région UE (Paris)

## 🚀 Démarrage rapide

### Prérequis

- Node.js 20+
- Compte Supabase (gratuit)
- Compte Stripe (gratuit, Live nécessite validation)
- Pour iOS : Mac avec Xcode 15+
- Pour Android : Android Studio

### Installation

```bash
# Cloner le repo
git clone <ton-repo-git>
cd trajetpro

# Installer les dépendances
npm install

# Copier les variables d'environnement
cp .env.example .env
# Éditer .env avec tes vraies clés Supabase + Stripe

# Lancer en dev
npm run dev
```

### Setup Supabase

```bash
# 1. Créer un projet sur supabase.com (région : West EU - Paris)
# 2. Récupérer URL + Anon Key dans Settings > API
# 3. Exécuter le schéma SQL
psql -h db.XXX.supabase.co -U postgres -d postgres -f supabase/SUPABASE_SCHEMA.sql

# 4. Déployer les Edge Functions
supabase login
supabase link --project-ref XXX
supabase functions deploy verify-siret --no-verify-jwt
supabase functions deploy create-payment-intent
supabase functions deploy stripe-webhook --no-verify-jwt
```

### Setup Stripe

1. Créer compte sur stripe.com
2. Ajouter les 4 produits dans le catalogue (pack20, pack40, pack50, pack80)
3. Configurer le webhook : `https://XXX.supabase.co/functions/v1/stripe-webhook`
4. Ajouter les secrets dans Supabase :
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`

### Build mobile

```bash
# iOS (Mac requis)
npm run cap:ios
# Puis dans Xcode : Product → Archive → Upload

# Android
npm run cap:android
# Puis dans Android Studio : Build → Generate Signed Bundle
```

## 📂 Structure du projet

```
trajetpro/
├── src/                  # Code React
│   ├── App.jsx          # Composant principal
│   ├── main.jsx         # Point d'entrée
│   └── lib/             # Helpers (Supabase, Stripe, utils)
├── supabase/
│   ├── functions/       # Edge Functions
│   └── SUPABASE_SCHEMA.sql
├── ios/                  # Projet iOS Capacitor
├── android/              # Projet Android Capacitor
└── docs/                 # Documentation
```

## 🔐 Sécurité

- ✅ RLS activée sur toutes les tables
- ✅ Clés sensibles côté serveur uniquement
- ✅ Anti-fraude : email vérifié + SIRET INSEE + device fingerprint
- ✅ Rate limiting configuré
- ✅ Hébergement EU (RGPD)

## 📜 Conformité légale

- **Décret 2017-483** : tous les bons comportent SIRET, n° VTC, carte pro, immatriculation, modèle véhicule
- **Code Général des Impôts** : factures avec numérotation chronologique, empreinte fiscale immutable, QR code
- **TVA** : 10% pour transport de personnes, auto-liquidation pour clients UE hors France
- **RGPD** : politique de confidentialité, droit à l'effacement

## 📞 Support

contact@trajetpro.fr

## 📄 Licence

Propriétaire — Tous droits réservés.
