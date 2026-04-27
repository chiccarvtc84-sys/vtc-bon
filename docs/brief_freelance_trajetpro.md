# 💼 Brief Freelance — Backend TrajetPro

> Document à envoyer aux freelances pour obtenir des devis précis et recruter le bon développeur pour connecter ton application TrajetPro à un vrai backend.

---

## 📋 Présentation du projet

### Qui suis-je ?

Je suis chauffeur VTC indépendant à Sorgues (84), et je développe **TrajetPro**, une application mobile pour les chauffeurs VTC français. L'application permet de créer des bons de course par dictée vocale, d'émettre des factures conformes au décret 2017-483, et de gérer l'activité au quotidien.

### État actuel du projet

✅ **Frontend React complet** (~3600 lignes) avec toutes les fonctionnalités UI :
- Authentification (login, signup, mode invité)
- Création de bons de course avec dictée vocale française
- Génération de factures VTC conformes
- Système de crédits (achat de packs)
- Parrainage avec code personnel
- Bonus mensuel de fidélité
- Préférences utilisateur
- Badges de vérification anti-fraude

🔨 **À développer (votre mission)** :
- Backend complet pour persister les données
- Vraie authentification sécurisée
- Intégration des paiements
- Anti-fraude multi-couches
- Déploiement en production

---

## 🎯 Mission

Brancher un backend fonctionnel et sécurisé à l'application React existante, puis préparer le déploiement sur iOS et Android via Capacitor.

### Livrables attendus

**1. Infrastructure backend**
- Base de données PostgreSQL (via Supabase) avec toutes les tables et relations
- Row Level Security (RLS) configurée sur toutes les tables
- Backups automatiques

**2. Authentification**
- Signup avec vérification email (obligatoire avant crédit des tokens de bienvenue)
- Login email + mot de passe
- Mot de passe oublié
- Sessions persistantes entre les appareils
- Mode invité sans compte

**3. CRUD complet**
- Courses : créer, lire, modifier, supprimer
- Factures : créer avec numérotation automatique + empreinte fiscale
- Clients : carnet d'adresses (fonctionnalité à prévoir)
- Transactions tokens : historique complet

**4. Système de crédits**
- Décrémentation automatique à chaque création (bon ou facture)
- Crédits de bienvenue après validation email
- Bonus mensuel automatique (cron le 1er du mois)
- Historique avec factures téléchargeables

**5. Parrainage**
- Codes personnalisés uniques
- Validation à l'inscription du filleul
- Anti-fraude : détection des parrainages fictifs (même device, etc.)
- Crédits distribués après validation email du filleul

**6. Paiements**
- Intégration Stripe pour les 4 packs (20/40/50/80 crédits)
- Support Apple Pay et Google Pay
- Gestion TVA intracommunautaire (auto-liquidation pour les non-FR)
- Webhooks pour crédit automatique après paiement
- Factures PDF générées et envoyées par email

**7. Anti-fraude (critique)**
- Vérification SIRET via API INSEE (gratuit)
- Blocage des emails jetables
- Device fingerprinting persistant : Apple DeviceCheck + Google Play Integrity
- Rate limiting par IP
- Score de risque calculé automatiquement
- Tableau de bord admin pour flagger les comptes suspects

**8. Emails transactionnels**
- Confirmation email à l'inscription
- Facture d'achat après paiement
- Mot de passe oublié
- Notification de nouveau parrainage

**9. Déploiement**
- Migration du code frontend de l'état actuel (données en mémoire) vers le backend
- Configuration Capacitor iOS + Android
- Documentation de l'infrastructure
- Transmission des accès (Supabase, Stripe, domaines)

**10. Documentation**
- Documentation technique des endpoints et de la base de données
- Procédures de déploiement et maintenance
- Guide de dépannage basique pour le non-développeur

---

## 🛠️ Stack technique imposée

| Composant | Technologie |
|-----------|-------------|
| Backend | **Supabase** (PostgreSQL + Auth + Edge Functions) |
| Paiements | **Stripe** + Apple Pay + Google Pay |
| Emails | Supabase Auth + **Resend** ou **Mailgun** |
| Frontend existant | **React 18** (à préserver, adapter uniquement) |
| Mobile | **Capacitor 6** (iOS + Android) |
| Monitoring | **Sentry** (plan gratuit) |
| Langage Edge Functions | **TypeScript / Deno** |

**Non négociable :** Supabase + Stripe (je ne veux pas de AWS, GCP, Firebase custom).

---

## 🧱 Contraintes techniques

### Compatibilité
- L'app doit fonctionner sur iOS 15+ et Android 10+
- Tous les écrans mobiles standards (375px à 430px de large)
- Langue : français uniquement pour le MVP

### Performance
- Chargement initial < 3 secondes
- Actions utilisateur < 500 ms (création de bon, facturation)
- Support hors-ligne basique pour consulter les bons existants

### Sécurité (obligatoire)
- Toutes les tables avec RLS activée
- Aucune clé `service_role` côté client
- Mots de passe hashés (bcrypt ou argon2)
- HTTPS partout
- Signature webhooks Stripe vérifiée
- Rate limiting sur endpoints critiques
- Conformité RGPD (suppression, export)

### Anti-fraude (obligatoire)
- Apple DeviceCheck intégré
- Google Play Integrity intégré
- Un seul compte par appareil (avec override support)
- Détection parrainages fictifs

---

## 📦 Schéma de base de données

**Le schéma complet est disponible dans un document annexe** (`guide_backend_trajetpro.md`). Les tables principales :

- `users` (profils utilisateurs + données anti-fraude)
- `bookings` (bons de course)
- `invoices` (factures VTC)
- `token_transactions` (historique crédits)
- `device_fingerprints` (anti-fraude)
- `verification_codes` (tokens temporaires)

Le candidat s'engage à respecter ce schéma ou à proposer des améliorations justifiées avant le début du développement.

---

## 📅 Planning souhaité

### Délai total : **6 à 8 semaines**

**Semaine 1 — Setup**
- Création des comptes Supabase / Stripe / Sentry
- Schéma de base de données déployé
- Configuration RLS
- Plan de travail détaillé validé ensemble

**Semaines 2-3 — Authentification**
- Signup avec vérification email
- Login + mot de passe oublié
- Mode invité
- Migration du code frontend existant vers Supabase Auth

**Semaines 3-4 — CRUD + Crédits**
- Migration des bons de course et factures vers la DB
- Système de crédits avec transactions
- Historique d'achats

**Semaine 5 — Paiements**
- Intégration Stripe
- 4 packs de crédits configurés
- Webhooks et factures PDF
- TVA intracommunautaire

**Semaine 6 — Anti-fraude**
- DeviceCheck / Play Integrity
- Rate limiting + score de risque
- Tests de contournement

**Semaine 7 — Parrainage + Finitions**
- Code parrain + bonus
- Bonus mensuel automatisé (cron)
- Emails transactionnels
- Tests end-to-end

**Semaine 8 — Déploiement**
- Build iOS + Android
- Tests sur vrais appareils
- Préparation pour soumission stores
- Documentation finale

---

## 💰 Budget

### Budget disponible : **3 500 € à 6 000 €** (selon profil)

**Cette fourchette correspond à :**
- Junior senior avec expérience Supabase : 3 500 - 4 500 €
- Senior avec expérience mobile + paiements : 5 000 - 6 000 €
- Expert / agence : au-delà du budget, pas d'intérêt pour ce projet

### Modalités de paiement proposées
- **30 % à la signature du contrat** (~1 000 à 1 800 €)
- **40 % à mi-parcours** après validation du CRUD + Auth
- **30 % à la livraison finale** après mise en production validée

### Ce qui est exclu du budget
- Frais récurrents Supabase / Stripe (à ma charge)
- Comptes développeurs Apple / Google (à ma charge)
- Services tiers (Resend, Sentry) (à ma charge)
- Maintenance post-livraison (peut faire l'objet d'un autre contrat)

---

## ✅ Critères de sélection

### Compétences techniques requises
- [ ] **React 18+** (hooks, context)
- [ ] **TypeScript** (intermédiaire minimum)
- [ ] **Supabase** (Auth, Postgres, RLS, Edge Functions) — expérience prouvée
- [ ] **Stripe** (Payment Intents, webhooks, Apple Pay) — expérience prouvée
- [ ] **Capacitor 6** pour publication mobile
- [ ] **PostgreSQL** (requêtes complexes, optimisation)
- [ ] Connaissance du RGPD

### Compétences appréciées (bonus)
- [ ] Expérience avec Apple DeviceCheck / Play Integrity
- [ ] Connaissance du secteur VTC ou de la facturation B2B française
- [ ] Expérience avec l'API INSEE
- [ ] Publication d'apps sur App Store / Google Play

### Soft skills attendus
- Communication claire en français
- Ponctualité sur les milestones
- Proactivité (suggérer des améliorations)
- Documentation propre
- Disponibilité pour 2-3 points hebdomadaires de 30 min en visio

### Non négociable
- **Références vérifiables** : au moins 2 projets similaires (app mobile + backend + paiements)
- **Code source versionné** sur GitHub tout au long du projet (accès invité pour moi)
- **Pas de sous-traitance** non déclarée
- **Engagement de confidentialité** sur mon code et ma base utilisateurs

---

## 📞 Processus de sélection

### Étape 1 — Candidatures (1 semaine)
Envoyez-moi un message contenant :
- Votre profil (LinkedIn, GitHub, portfolio)
- 2 références de projets similaires avec URLs ou screenshots
- Votre devis détaillé par phase
- Votre planning prévisionnel
- Votre tarif journalier ou forfait

### Étape 2 — Shortlist (3 candidats)
Entretien visio de 30 min pour évaluer :
- Compréhension du projet
- Questions techniques pertinentes de votre part
- Compatibilité humaine
- Clarification des zones d'ombre du brief

### Étape 3 — Sélection finale
- Demande de 2 références anciennes (ou courantes) par téléphone
- Signature du contrat avec clauses de propriété intellectuelle
- Acompte de 30 % pour démarrer

---

## 📝 Documents annexes fournis

En signant le contrat, vous recevrez :
- Le code source complet du frontend React (~3600 lignes)
- Le schéma de base de données détaillé
- Les maquettes et captures d'écran existantes
- Le guide technique backend complet
- Un accès lecture à mon Figma (maquettes complémentaires)
- Les documents légaux (CGU, politique de confidentialité)

---

## 🤝 Clauses importantes du contrat

### Propriété intellectuelle
- **100 % du code est cédé** au commanditaire à la fin du projet
- Le freelance ne peut réutiliser ni les designs, ni le code, ni les données
- Autorisation de citer le projet dans le portfolio freelance après mise en ligne

### Confidentialité
- NDA obligatoire couvrant toute information métier (fonctionnalités, utilisateurs, stratégie)
- Données utilisateurs strictement confidentielles même en environnement de test

### Garantie
- **Garantie de 30 jours** après livraison pour corriger les bugs majeurs sans surcoût
- Au-delà, tarif journalier à négocier pour la maintenance

### Pénalités
- Retard de plus de 2 semaines sur un milestone = 5 % de pénalité par semaine de retard
- Abandon du projet sans justification = remboursement intégral des acomptes

---

## 🔍 Où me trouver

**Projet visible dans son état actuel** :
- Je peux vous partager en entretien un lien vers le prototype React déployé
- Screenshots et descriptif disponibles sur demande

**Me contacter** :
- Email : [VOTRE EMAIL]
- WhatsApp : [VOTRE NUMÉRO]

**Disponibilités pour entretiens** : en soirée (19h-22h) ou week-end, mon activité VTC me prenant la journée

---

## 💡 Questions fréquentes des freelances

**Q : Puis-je proposer une stack alternative à Supabase ?**
R : Non, c'est imposé pour faciliter ma maintenance future et éviter le vendor lock-in plus sophistiqué.

**Q : Peut-on réduire le scope pour entrer dans le budget ?**
R : Oui, l'anti-fraude DeviceCheck peut être reporté à la v2 si nécessaire. Les paiements Stripe et l'auth sont non-négociables.

**Q : Fournissez-vous les maquettes ?**
R : Les écrans sont déjà codés et fonctionnels dans le frontend React. Pas de nouvelles maquettes à créer, juste du code à brancher.

**Q : Y a-t-il une App Store Connect / Google Play Console déjà créée ?**
R : Oui, à ma charge. Je fournirai les accès invités développeur pour les soumissions.

**Q : Qui gère les soumissions finales aux stores ?**
R : Vous préparez le build, je gère la soumission administrative. Disponibilité attendue pendant les 2-3 jours de review pour corrections éventuelles.

**Q : Pouvez-vous garantir un volume d'utilisateurs minimal ?**
R : Non. Le projet est en phase de lancement, volume initial attendu : 50-200 utilisateurs les 3 premiers mois.

**Q : Que faire si je détecte des failles anti-fraude après livraison ?**
R : Garantie de 30 jours pour les bugs critiques. Au-delà, contrat de maintenance mensuel possible à 200-400 € / mois.

---

## 📌 Où trouver des freelances qualifiés

### Plateformes recommandées

**1. Malt.fr** (France) — **mon choix n°1**
- Filtre "Supabase" + "Stripe" + "React Native"
- Budget moyen : 400-700 €/jour pour un senior
- Contrat sécurisé via la plateforme
- Recommandations vérifiables
- Commission de 10 % incluse dans le tarif affiché

**2. Upwork** (international)
- Filtre "Supabase expert" + "Stripe integration"
- Budget : 30-80 $/heure selon le pays
- Attention à la barrière de la langue
- Prévoir 20-30 % de temps en plus pour les échanges

**3. Collective.work** (France)
- Plateforme de freelances certifiés
- Contact direct sans commission
- Budget équivalent à Malt

**4. LinkedIn**
- Rechercher "freelance Supabase" + "Stripe" + "Paris/Lyon/Marseille"
- Demander directement en message privé
- Voir les recommandations publiques

### Ce qu'il faut éviter
- ❌ Fiverr (qualité variable, pas de suivi)
- ❌ Les freelances sans profil public vérifiable
- ❌ Tarifs trop bas (< 300 €/jour) = risque de qualité
- ❌ Les prestataires qui veulent 100 % d'acompte

---

## 🎯 Prochaine étape

1. **Copier ce brief dans un document Google Docs**
2. **Remplacer les placeholders** `[VOTRE EMAIL]`, `[VOTRE NUMÉRO]` etc.
3. **Publier l'offre sur Malt** (compter 30 min)
4. **Attendre 3-7 jours** pour recevoir 10-20 candidatures
5. **Shortlister 3 candidats** et lancer les entretiens
6. **Signer le contrat** sous 2-3 semaines
7. **Démarrer le projet** !

**Temps total du processus de recrutement : 3 à 4 semaines**
**Temps total du projet avec le freelance : 6 à 8 semaines**
**Délai total avant mise en ligne : environ 3 mois**

Bonne chance ! 🚀

Un bon freelance peut transformer ton prototype en vrai business rentable. Investis le temps nécessaire pour bien le choisir — c'est le facteur de succès numéro un à cette étape.
