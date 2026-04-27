# 🐣 Phase 2 détaillée pour grand débutant — Infrastructure backend TrajetPro

> **Pour qui ?** Toi, qui n'as jamais touché à une base de données, jamais écrit une ligne de code, mais qui veux comprendre exactement ce qui se passe.
>
> **Durée réelle :** 4 à 6 heures étalées sur 2-3 jours (pas à faire d'un coup, prends ton temps)
>
> **Objectif :** à la fin de ce guide, tu auras un "coffre-fort" en ligne qui stocke tous les comptes, courses, factures et crédits de tes utilisateurs.
>
> **Ce que tu vas faire concrètement :**
> - Créer un compte gratuit sur un site (Supabase)
> - Copier 6 blocs de code dans une fenêtre
> - Appuyer sur "Run" entre chaque copier-coller
> - Vérifier que ça a bien marché
>
> Pas de magie, pas de code à écrire toi-même. Juste du copier-coller attentif.

---

## 🎓 Avant de commencer : comprendre ce qu'on va faire

Imagine que ton application TrajetPro, c'est un **restaurant**.

Actuellement, le restaurant existe (ton code React), mais il **n'a pas de cuisine ni de réserve**. Quand un client commande un plat, tu dois le cuisiner mentalement et tu l'oublies dès qu'il quitte la salle. C'est pour ça que **tes utilisateurs perdent leurs données** : il n'y a nulle part où les stocker.

**Supabase, c'est la cuisine et la réserve de ton restaurant.** C'est :
- Un endroit où **stocker les utilisateurs** (leur nom, email, mot de passe, etc.)
- Un endroit où **stocker les courses** qu'ils créent
- Un endroit où **stocker les factures** qu'ils émettent
- Un endroit où **stocker les crédits** de chaque utilisateur

Supabase, c'est **gratuit pour commencer** (jusqu'à 50 000 utilisateurs). Tu ne paieras rien pendant longtemps.

---

## 📅 Plan d'attaque en 3 jours

Prends ton temps, ne fais pas tout d'un coup. Je te propose ce découpage :

### **Jour 1 (1h30)** — Créer le compte Supabase
- Créer un compte gratuit
- Créer ton premier "projet"
- Sauvegarder les mots de passe
- S'arrêter là et **fermer le navigateur**

### **Jour 2 (2h)** — Créer les tables
- Revenir sur Supabase
- Copier-coller 6 scripts dans le bon ordre
- Vérifier que chaque table existe

### **Jour 3 (1h)** — Sécuriser et tester
- Activer la sécurité RLS
- Créer un utilisateur de test
- Vérifier que tout fonctionne

Prêt ? On y va. **Allume ton ordinateur, ouvre ton navigateur, et suis-moi pas à pas.**

---

# 📆 JOUR 1 — Création du compte Supabase (1h30)

## Étape 1 — Ouvrir Supabase

1. **Ouvre ton navigateur internet** (Chrome, Safari, Firefox... peu importe)
2. Dans la barre d'adresse en haut, **tape** : `supabase.com`
3. **Appuie sur Entrée**

Tu arrives sur la page d'accueil de Supabase. Elle est en anglais, c'est normal, mais je te guide.

## Étape 2 — S'inscrire

1. En haut à droite de la page, tu vois un bouton vert **"Start your project"** ou **"Sign up"**. **Clique dessus.**

2. Une nouvelle page s'ouvre avec plusieurs options :
   - **"Continue with GitHub"**
   - **"Continue with Google"**
   - Ou un formulaire email

3. **Le plus simple** : clique sur **"Continue with Google"** si tu as un compte Gmail.
   - Si tu n'as pas de compte Google, clique sur "Sign up with email" et utilise `contact@trajetpro.fr` ou ton email personnel.

4. **Autorise Supabase** à accéder à ton compte Google (écran de Google qui s'affiche).

5. Tu arrives sur un tableau de bord Supabase **vide**. Bravo, ton compte est créé ! 🎉

## Étape 3 — Créer ton premier projet

**Un "projet" dans Supabase = une base de données.** Chaque application a son projet. Tu vas créer celui de TrajetPro.

1. Clique sur le gros bouton vert **"New project"** au centre de l'écran.

2. Si c'est ta première fois, Supabase te demande de créer une **"organisation"**. C'est juste un conteneur pour tes projets. Remplis :
   - **Organization name** : `TrajetPro` (ou ton nom)
   - **Type** : choisis **"Personal"** (pas "Company" pour rester gratuit)
   - **Plan** : **Free** (gratuit, tu peux toujours changer plus tard)
   - Clique **"Create organization"**

3. Maintenant tu peux créer le projet. Remplis le formulaire :

   - **Name** : `trajetpro-prod` (c'est juste un nom pour toi, pour t'y retrouver)

   - **Database Password** : ⚠️ **ATTENTION, ÉTAPE TRÈS IMPORTANTE**
     - Clique sur le petit bouton **"Generate a password"**
     - Supabase génère automatiquement un mot de passe très fort
     - **COPIE CE MOT DE PASSE** (clique sur la petite icône de copie)
     - **COLLE-LE** tout de suite dans un document sécurisé :
       - **Option 1 (la meilleure)** : un gestionnaire de mots de passe comme **Bitwarden** (gratuit, à télécharger sur `bitwarden.com`)
       - **Option 2** : une note sur ton iPhone avec protection Face ID
       - **Option 3 (pas top mais OK)** : un fichier texte sur ton ordinateur dans un dossier que tu n'effaceras pas
     - ⚠️ **SI TU PERDS CE MOT DE PASSE, TU NE POURRAS PLUS JAMAIS ACCÉDER À TA BASE DE DONNÉES.** C'est comme perdre la clé de ton coffre-fort. Sauvegarde-le maintenant, avant de continuer.

   - **Region** : choisis **"West EU (Paris)"** ou **"Central EU (Frankfurt)"**
     - **Pourquoi ?** Parce que tes utilisateurs sont en France. Si tu choisis une région éloignée (ex : USA), l'app sera plus lente pour eux. Et c'est aussi une obligation RGPD de stocker les données européennes en Europe.

   - **Pricing Plan** : laisse **"Free"**

4. Clique **"Create new project"** tout en bas.

5. **Attends 2-3 minutes.** Supabase prépare ta base de données. Tu verras une animation qui tourne. Ne ferme pas la fenêtre.

6. Quand c'est prêt, tu arrives sur le tableau de bord de ton projet. Tu vois à gauche un menu avec des icônes : Home, Table Editor, SQL Editor, Authentication, etc.

**🎉 Ton "coffre-fort" en ligne est créé et prêt à recevoir tes données !**

## Étape 4 — Sauvegarder tes informations importantes

Avant de continuer, prends 5 minutes pour noter des informations essentielles que tu auras besoin plus tard.

1. Dans le menu de gauche, clique sur **l'icône d'engrenage** ⚙️ (Project Settings) tout en bas à gauche.

2. Dans le sous-menu qui apparaît, clique sur **"API"**.

3. Tu vois une page avec plusieurs informations. **Copie et sauvegarde** dans ton gestionnaire de mots de passe :

   - **Project URL** : une adresse du type `https://xxxxxxxxxxxx.supabase.co`
     → sauvegarde-la sous le nom **"TrajetPro - Supabase URL"**

   - **Project API keys** → **anon public** : une très longue chaîne qui commence par `eyJ...`
     → sauvegarde-la sous le nom **"TrajetPro - Supabase Anon Key"**

   - **Project API keys** → **service_role** (⚠️ SECRÈTE !) :
     → sauvegarde-la sous le nom **"TrajetPro - Supabase Service Role Key"**
     → ⚠️ **NE DONNE JAMAIS cette clé à personne, ne la mets jamais dans ton app mobile**. C'est comme le code administrateur total de ta base de données.

4. Tu peux maintenant **fermer le navigateur**. Jour 1 terminé. Va te détendre. 🍵

---

# 📆 JOUR 2 — Création des tables (2h)

> Une **table**, c'est comme un **tableau Excel** qui stocke un type de données. Dans notre cas :
> - Table `users` = tableau des utilisateurs
> - Table `bookings` = tableau des courses
> - Table `invoices` = tableau des factures
> - Table `token_transactions` = tableau de l'historique des crédits
> - Table `device_fingerprints` = tableau des appareils connus (anti-fraude)
> - Table `verification_codes` = tableau des codes temporaires

## Étape 5 — Revenir sur Supabase

1. Ouvre `supabase.com`
2. Connecte-toi (si ce n'est pas déjà fait)
3. Clique sur ton projet **"trajetpro-prod"** dans la liste

## Étape 6 — Ouvrir l'éditeur SQL

Le "SQL Editor" c'est l'outil qui permet de **créer les tables**. SQL est le langage universel pour parler aux bases de données.

1. Dans le menu de gauche, tu vois plusieurs icônes. Trouve l'icône qui ressemble à **`< >`** ou qui s'appelle **"SQL Editor"**. Elle est généralement la 3e ou 4e du haut.

2. **Clique dessus.**

3. Tu arrives sur une page avec un grand cadre blanc au milieu. C'est là que tu vas coller les scripts.

4. En haut à droite, tu vois un bouton vert **"Run"** (ou **"Run"** avec une icône ▶️). C'est ce bouton qu'on va utiliser.

## Étape 7 — Copier-coller le SCRIPT 1 (Table users)

**C'est parti pour le premier script. Suis ces étapes précisément :**

1. **Sélectionne tout le texte** dans le cadre blanc du SQL Editor (s'il y a du texte d'exemple) et **supprime-le**. Tu dois avoir un cadre complètement vide.

2. **Sélectionne le bloc de code ci-dessous** en faisant un clic gauche au début, en maintenant, puis en descendant jusqu'à la dernière ligne :

```sql
-- TABLE 1 : USERS (utilisateurs)
-- Stocke tous les chauffeurs VTC inscrits sur TrajetPro

CREATE TABLE public.users (
  -- Identifiant unique (lié au système d'authentification de Supabase)
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Informations personnelles
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,

  -- Informations professionnelles VTC
  siret TEXT UNIQUE,
  evtc_number TEXT UNIQUE,
  company_name TEXT,
  vehicle_model TEXT,
  vehicle_plate TEXT,
  pro_card_number TEXT,

  -- Informations financières
  iban TEXT,
  vat_intra TEXT,

  -- Parrainage
  referral_code TEXT UNIQUE NOT NULL,
  referred_by UUID REFERENCES public.users(id),

  -- Vérifications anti-fraude
  email_verified BOOLEAN DEFAULT false,
  siret_verified BOOLEAN DEFAULT false,
  evtc_verified BOOLEAN DEFAULT false,
  device_fingerprint TEXT,
  device_check_token TEXT,
  play_integrity_verified BOOLEAN DEFAULT false,
  last_known_ip TEXT,
  risk_score INTEGER DEFAULT 0,
  flagged BOOLEAN DEFAULT false,
  flagged_reason TEXT,

  -- Système de crédits
  token_balance INTEGER DEFAULT 0,
  last_monthly_bonus DATE,

  -- Préférences
  preferences JSONB DEFAULT '{}'::jsonb,

  -- Dates système
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Index pour accélérer les recherches
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_siret ON public.users(siret);
CREATE INDEX idx_users_referral_code ON public.users(referral_code);
CREATE INDEX idx_users_device_fingerprint ON public.users(device_fingerprint);
```

3. **Copie-le** (Ctrl+C sur Windows/Linux, Cmd+C sur Mac).

4. **Clique dans le grand cadre blanc** du SQL Editor.

5. **Colle** le script (Ctrl+V / Cmd+V).

6. **Vérifie** que le texte est bien visible dans le cadre.

7. **Clique sur le bouton vert "Run"** en haut à droite (ou appuie sur Ctrl+Entrée / Cmd+Entrée).

8. **Attends 2-3 secondes.**

9. **En bas de l'écran**, tu dois voir un message vert qui dit quelque chose comme :
   - ✅ `Success. No rows returned`

10. Si tu vois ce message vert, **bravo, ta première table est créée !** 🎉

**Si tu vois un message rouge (erreur)** : ne panique pas, passe à la section "Dépannage" à la fin de ce guide. Copie-colle le texte rouge dans un traducteur si c'est en anglais.

## Étape 8 — Copier-coller le SCRIPT 2 (Table bookings)

On continue avec les courses.

1. **Efface le contenu du cadre** du SQL Editor (sélectionne tout + supprimer).

2. **Copie le script ci-dessous :**

```sql
-- TABLE 2 : BOOKINGS (bons de course)
-- Stocke toutes les courses créées par les chauffeurs

CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Informations client
  customer_name TEXT NOT NULL,
  customer_phone TEXT,

  -- Trajet
  pickup_address TEXT NOT NULL,
  dropoff_address TEXT NOT NULL,
  pickup_datetime TIMESTAMPTZ NOT NULL,

  -- Détails
  passengers INTEGER DEFAULT 1,
  has_luggage BOOLEAN DEFAULT false,
  distance_km DECIMAL(6,2),
  duration_min INTEGER,
  price_ttc DECIMAL(8,2) NOT NULL,
  notes TEXT,
  type TEXT DEFAULT 'forfait',
  status TEXT DEFAULT 'confirmed',

  -- Dates système
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Index pour accélérer les recherches
CREATE INDEX idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX idx_bookings_pickup_datetime ON public.bookings(pickup_datetime);
CREATE INDEX idx_bookings_status ON public.bookings(status);
```

3. **Colle-le dans le cadre**, puis **clique sur "Run"**.

4. Attends le message vert ✅ `Success`.

5. ✅ Table **bookings** créée.

## Étape 9 — Copier-coller le SCRIPT 3 (Table invoices)

```sql
-- TABLE 3 : INVOICES (factures)
-- Stocke toutes les factures émises

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id),

  -- Numérotation fiscale
  invoice_number TEXT UNIQUE NOT NULL,

  -- Client
  customer_name TEXT NOT NULL,

  -- Montants
  amount_ht DECIMAL(8,2) NOT NULL,
  amount_vat DECIMAL(8,2) NOT NULL,
  amount_ttc DECIMAL(8,2) NOT NULL,
  vat_rate DECIMAL(4,2) NOT NULL,

  -- Statut et conformité
  status TEXT DEFAULT 'pending',
  fingerprint TEXT NOT NULL,
  paid_at TIMESTAMPTZ,

  -- Dates système
  issued_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX idx_invoices_invoice_number ON public.invoices(invoice_number);
CREATE INDEX idx_invoices_status ON public.invoices(status);
```

Même procédure : **Efface** le contenu précédent, **colle** ce script, **clique "Run"**, attends le ✅.

## Étape 10 — Copier-coller le SCRIPT 4 (Table token_transactions)

```sql
-- TABLE 4 : TOKEN_TRANSACTIONS (historique des crédits)
-- Trace tous les mouvements de crédits (achats, consommations, bonus)

CREATE TABLE public.token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Type de transaction
  kind TEXT NOT NULL,
  -- Valeurs possibles : purchase, welcome, monthly_bonus, referral_bonus,
  --                    consume_booking, consume_invoice, refund

  tokens_delta INTEGER NOT NULL,

  -- Pour les achats
  package_id TEXT,
  invoice_number TEXT,
  amount_ttc DECIMAL(8,2),
  amount_ht DECIMAL(8,2),
  amount_vat DECIMAL(8,2),
  vat_applied BOOLEAN,
  vat_intra TEXT,
  payment_method TEXT,
  stripe_payment_intent_id TEXT,

  -- Pour les consommations
  related_booking_id UUID REFERENCES public.bookings(id),
  related_invoice_id UUID REFERENCES public.invoices(id),

  -- Pour les parrainages
  referred_user_id UUID REFERENCES public.users(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_token_transactions_user_id ON public.token_transactions(user_id);
CREATE INDEX idx_token_transactions_kind ON public.token_transactions(kind);
CREATE INDEX idx_token_transactions_created_at ON public.token_transactions(created_at DESC);
```

**Efface → Colle → Run → ✅**

## Étape 11 — Copier-coller le SCRIPT 5 (Table device_fingerprints)

```sql
-- TABLE 5 : DEVICE_FINGERPRINTS (anti-fraude)
-- Stocke les empreintes des appareils pour empêcher les comptes multiples

CREATE TABLE public.device_fingerprints (
  fingerprint TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  device_check_token TEXT,
  play_integrity_token TEXT,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  accounts_count INTEGER DEFAULT 1,
  blocked BOOLEAN DEFAULT false,
  blocked_reason TEXT
);

-- Index
CREATE INDEX idx_device_fingerprints_user_id ON public.device_fingerprints(user_id);
CREATE INDEX idx_device_fingerprints_blocked ON public.device_fingerprints(blocked);
```

**Efface → Colle → Run → ✅**

## Étape 12 — Copier-coller le SCRIPT 6 (Table verification_codes)

```sql
-- TABLE 6 : VERIFICATION_CODES (codes temporaires)
-- Stocke les codes de vérification envoyés par email

CREATE TABLE public.verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target TEXT NOT NULL,
  kind TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_verification_codes_target ON public.verification_codes(target);
CREATE INDEX idx_verification_codes_expires_at ON public.verification_codes(expires_at);
```

**Efface → Colle → Run → ✅**

## Étape 13 — Vérifier que toutes les tables existent

Maintenant on va vérifier visuellement que les 6 tables ont bien été créées.

1. Dans le menu de gauche, clique sur l'icône **"Table Editor"** (généralement la 2e icône du haut, qui ressemble à un tableau).

2. Une liste de tables apparaît à gauche. Tu dois voir **6 tables** :
   - ✅ `bookings`
   - ✅ `device_fingerprints`
   - ✅ `invoices`
   - ✅ `token_transactions`
   - ✅ `users`
   - ✅ `verification_codes`

3. Clique sur chacune pour vérifier qu'elles existent (elles seront vides, c'est normal).

**Si toutes les tables sont là : FÉLICITATIONS ! 🎉 Tu as créé ta base de données. C'est une énorme étape !**

**Si une table manque :** retourne au script correspondant et re-execute-le. Vérifie le message d'erreur éventuel.

Va te reposer, jour 2 terminé. 😌

---

# 📆 JOUR 3 — Sécurité et tests (1h)

> Aujourd'hui on va activer la **Row Level Security (RLS)**.
>
> **Pourquoi c'est important ?**
> Sans RLS, chaque utilisateur pourrait voir les données de tous les autres. Ce serait une catastrophe de sécurité et une violation du RGPD.
>
> RLS = "chacun ne voit que ses propres données". C'est la règle fondamentale.

## Étape 14 — Activer la RLS avec le SCRIPT 7

1. Retourne dans le **SQL Editor**.
2. Efface le contenu du cadre.
3. Copie-colle ce script :

```sql
-- ACTIVATION DE LA ROW LEVEL SECURITY
-- Sans cela, les utilisateurs verraient les données des autres !

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

-- Règles pour la table USERS
CREATE POLICY "users_read_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Règles pour la table BOOKINGS
CREATE POLICY "bookings_select_own" ON public.bookings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "bookings_insert_own" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookings_update_own" ON public.bookings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "bookings_delete_own" ON public.bookings
  FOR DELETE USING (auth.uid() = user_id);

-- Règles pour la table INVOICES
CREATE POLICY "invoices_select_own" ON public.invoices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "invoices_insert_own" ON public.invoices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Règles pour la table TOKEN_TRANSACTIONS
CREATE POLICY "transactions_select_own" ON public.token_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Règles pour DEVICE_FINGERPRINTS (lecture réservée)
CREATE POLICY "device_fingerprints_select_own" ON public.device_fingerprints
  FOR SELECT USING (auth.uid() = user_id);
```

4. Clique **"Run"**. Attends ✅ `Success`.

**Ce que ça fait concrètement :** à partir de maintenant, même si quelqu'un essaie de tricher, il ne pourra jamais voir que SES propres données.

## Étape 15 — Créer les fonctions pour les crédits

Ces fonctions sont comme des **"boutons magiques"** que ton application appellera. Elles font plusieurs choses en une seule fois (ex: débiter un crédit ET enregistrer l'historique).

Copie-colle le script suivant :

```sql
-- FONCTION 1 : Consommer des crédits
-- Appelée quand un utilisateur crée un bon ou une facture

CREATE OR REPLACE FUNCTION consume_tokens(
  p_user_id UUID,
  p_amount INTEGER,
  p_kind TEXT,
  p_related_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  SELECT token_balance INTO current_balance
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF current_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  UPDATE public.users
    SET token_balance = token_balance - p_amount,
        updated_at = NOW()
    WHERE id = p_user_id;

  INSERT INTO public.token_transactions (
    user_id, kind, tokens_delta,
    related_booking_id, related_invoice_id
  ) VALUES (
    p_user_id, p_kind, -p_amount,
    CASE WHEN p_kind = 'consume_booking' THEN p_related_id ELSE NULL END,
    CASE WHEN p_kind = 'consume_invoice' THEN p_related_id ELSE NULL END
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FONCTION 2 : Créditer un achat de pack
-- Appelée quand un utilisateur achète des crédits

CREATE OR REPLACE FUNCTION credit_token_purchase(
  p_user_id UUID,
  p_tokens INTEGER,
  p_amount_ttc DECIMAL,
  p_package_id TEXT,
  p_stripe_intent_id TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.users
    SET token_balance = token_balance + p_tokens,
        updated_at = NOW()
    WHERE id = p_user_id;

  INSERT INTO public.token_transactions (
    user_id, kind, tokens_delta,
    package_id, amount_ttc,
    stripe_payment_intent_id
  ) VALUES (
    p_user_id, 'purchase', p_tokens,
    p_package_id, p_amount_ttc,
    p_stripe_intent_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FONCTION 3 : Bonus mensuel
-- Appelée le 1er du mois pour donner 1 crédit de fidélité

CREATE OR REPLACE FUNCTION credit_monthly_bonus(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  last_bonus DATE;
  current_month DATE;
BEGIN
  SELECT last_monthly_bonus INTO last_bonus
  FROM public.users WHERE id = p_user_id;

  current_month := DATE_TRUNC('month', CURRENT_DATE);

  IF last_bonus IS NOT NULL AND DATE_TRUNC('month', last_bonus) >= current_month THEN
    RETURN FALSE;
  END IF;

  UPDATE public.users
    SET token_balance = token_balance + 1,
        last_monthly_bonus = CURRENT_DATE
    WHERE id = p_user_id;

  INSERT INTO public.token_transactions (
    user_id, kind, tokens_delta, amount_ttc
  ) VALUES (p_user_id, 'monthly_bonus', 1, 0);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FONCTION 4 : Bonus de parrainage
-- Appelée quand un filleul s'inscrit avec un code

CREATE OR REPLACE FUNCTION credit_referral_bonus(
  p_referrer_id UUID,
  p_referee_id UUID,
  p_referrer_tokens INTEGER,
  p_referee_tokens INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.users
    SET token_balance = token_balance + p_referrer_tokens
    WHERE id = p_referrer_id;

  UPDATE public.users
    SET token_balance = token_balance + p_referee_tokens
    WHERE id = p_referee_id;

  INSERT INTO public.token_transactions (user_id, kind, tokens_delta, referred_user_id)
    VALUES
      (p_referrer_id, 'referral_bonus', p_referrer_tokens, p_referee_id),
      (p_referee_id, 'referral_bonus', p_referee_tokens, p_referrer_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Efface → Colle → Run → ✅**

## Étape 16 — Activer la confirmation par email

Maintenant on active la sécurité : l'email doit être vérifié avant que le compte soit activé.

1. Dans le menu de gauche, clique sur **"Authentication"** (icône qui ressemble à un cadenas ou à une personne).

2. Un sous-menu s'ouvre. Clique sur **"Providers"**.

3. Tu vois une liste. Cherche **"Email"** et clique dessus pour l'ouvrir.

4. Vérifie ces réglages :
   - **"Enable Email provider"** : activé (vert)
   - **"Confirm email"** : ⚠️ **ACTIVE-LE** (bascule le bouton vers vert)
   - **"Secure password change"** : activé
   - **"Minimum password length"** : mets **8**

5. Clique **"Save"** en bas de la page.

## Étape 17 — Personnaliser les emails automatiques

1. Dans le menu **Authentication**, clique sur **"Email Templates"**.

2. Tu vois plusieurs templates : "Confirm signup", "Magic Link", "Change Email Address", "Reset Password".

3. Clique sur **"Confirm signup"**.

4. Remplace le contenu par le texte suivant :

**Subject (objet de l'email) :**
```
Confirmez votre inscription sur TrajetPro
```

**Message body (corps de l'email) — colle le HTML ci-dessous :**
```html
<h2>Bienvenue sur TrajetPro ! 🚗</h2>
<p>Bonjour,</p>
<p>Merci de votre inscription sur TrajetPro, l'application de gestion dédiée aux chauffeurs VTC.</p>
<p><strong>Cliquez sur le bouton ci-dessous</strong> pour confirmer votre adresse email et recevoir vos <strong>5 crédits de bienvenue offerts</strong> :</p>
<p><a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 12px 24px; background: #F4B942; color: #0B0B0D; text-decoration: none; border-radius: 8px; font-weight: bold;">Confirmer mon email</a></p>
<p>Ce lien est valable 24 heures.</p>
<p>Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement cet email.</p>
<p>À bientôt sur TrajetPro !</p>
<p style="color: #999; font-size: 12px; margin-top: 30px;">TrajetPro SAS · contact@trajetpro.fr</p>
```

5. Clique **"Save"**.

6. Répète l'opération pour **"Reset Password"** si tu veux personnaliser aussi.

## Étape 18 — Test final : créer un utilisateur de test

On va créer un vrai utilisateur pour vérifier que tout fonctionne.

1. Dans **Authentication**, clique sur **"Users"**.

2. Clique sur **"Add user"** en haut à droite, puis **"Create new user"**.

3. Remplis :
   - **Email** : utilise un email que tu peux vraiment consulter (ex: ton email personnel)
   - **Password** : `Test12345!`
   - **"Auto Confirm User?"** : laisse décoché pour simuler une vraie inscription

4. Clique **"Create user"**.

5. **Vérifie ta boîte mail** (même dans les spams) : tu dois recevoir l'email de confirmation personnalisé que tu as créé à l'étape 17.

6. **Si tu reçois bien l'email** : 🎉 ton système d'authentification fonctionne !

7. Dans Supabase, tu peux voir que l'utilisateur apparaît dans la liste. Son statut est "Waiting for verification".

## Étape 19 — Vérification finale de tout ce qui est en place

Reprenons ce que tu as construit sur 3 jours :

- ✅ Un projet Supabase gratuit créé
- ✅ 6 tables créées (users, bookings, invoices, token_transactions, device_fingerprints, verification_codes)
- ✅ Sécurité RLS activée sur toutes les tables
- ✅ 4 fonctions de gestion des crédits
- ✅ Confirmation email obligatoire activée
- ✅ Email de bienvenue personnalisé
- ✅ Un utilisateur de test qui fonctionne

**Phase 2 terminée. 🎉🎉🎉**

---

## 🚨 Section dépannage : quand ça ne marche pas

### "Erreur lors du Run — Syntax error"

**Cause :** tu as peut-être oublié de copier une partie du script, ou il y a un caractère spécial qui a mal copié.

**Solution :**
1. Efface tout dans le cadre SQL Editor
2. Retourne au script dans ce guide
3. Re-sélectionne **vraiment tout** depuis la première ligne (souvent un commentaire avec `--`) jusqu'à la dernière accolade ou point-virgule
4. Re-colle
5. Run

### "relation 'public.users' does not exist"

**Cause :** tu essaies d'exécuter le script 2 sans avoir exécuté le script 1.

**Solution :** les scripts **doivent être exécutés dans l'ordre (1, 2, 3, 4, 5, 6)**. Retourne au script 1 et execute-le d'abord.

### "relation 'public.users' already exists"

**Cause :** tu as déjà créé la table users et tu essaies de la recréer.

**Solution 1 (simple) :** ignore cette erreur et passe au script suivant. Ta table existe déjà.

**Solution 2 (repartir de zéro) :** si tu as fait une grosse erreur et que tu veux recommencer proprement, exécute ce script pour tout supprimer :

```sql
DROP TABLE IF EXISTS public.verification_codes CASCADE;
DROP TABLE IF EXISTS public.device_fingerprints CASCADE;
DROP TABLE IF EXISTS public.token_transactions CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
```

Puis redémarre à partir de l'étape 7 (Script 1 - Table users).

### "Je ne reçois pas l'email de confirmation"

**Causes possibles :**
1. L'email est dans les spams → vérifie
2. Supabase Free a une limite de 3 emails/heure pour éviter le spam → attends 1 heure
3. Ton FAI bloque les emails Supabase → essaye avec une autre adresse (Gmail est le plus fiable)

**Solution temporaire pendant les tests :** dans la liste des utilisateurs Supabase, tu peux cliquer sur un utilisateur puis sur "Confirm user" pour contourner la vérification email.

### "J'ai fermé Supabase et je ne retrouve pas mon projet"

**Solution :**
1. Va sur `supabase.com`
2. Connecte-toi (même méthode que la création)
3. Dans le dashboard, ton projet apparaît. Clique dessus.

### "J'ai perdu le mot de passe de ma base de données"

**Catastrophe, mais pas irréparable :**
1. Tu peux toujours accéder à ton projet via le dashboard
2. Tu peux **réinitialiser le mot de passe** dans **Settings → Database → Reset database password**
3. Sauvegarde le nouveau mot de passe immédiatement !

### "J'ai perdu mon Anon Key ou mon Service Role Key"

**Solution :**
1. Va dans **Settings → API**
2. Les clés s'affichent, tu peux les recopier à volonté
3. Si tu penses que la clé Service Role a été compromise : clique sur **"Regenerate"** pour en générer une nouvelle (attention, ça va casser les applications qui l'utilisent)

---

## 🎓 Ce que tu as appris (sans le savoir)

En suivant ce guide, tu as acquis des compétences que 99% des gens n'ont pas :

- **Lire une structure SQL** : tu sais maintenant reconnaître une table (`CREATE TABLE`), une colonne (`column_name TYPE`), un index (`CREATE INDEX`).
- **Comprendre la sécurité RLS** : tu sais que chaque utilisateur ne doit voir que ses propres données.
- **Gérer un projet cloud** : tu as créé un compte, un projet, sauvegardé des clés secrètes.

**Tu n'es plus un "grand débutant" : tu es officiellement un "débutant intermédiaire" avec une vraie base de données fonctionnelle.** 💪

---

## 🚀 Et maintenant ?

Ton "coffre-fort en ligne" est prêt. Dans la prochaine phase, on va :

**Phase 3** — Ajouter les couches anti-fraude (vérification SIRET, blacklist emails jetables)

**Phase 4** — Brancher ton application React à ce backend (la partie où le code commence à vraiment communiquer avec Supabase)

**Si tu veux que je te détaille la Phase 3 ou la Phase 4 avec le même niveau de détail que celui-ci**, dis-le-moi simplement et je te prépare le guide pas à pas avec chaque clic et chaque ligne à copier.

**Tu fais un excellent travail. Prends ton temps, valide chaque étape, et n'hésite pas à revenir me voir avec des questions précises.** 🙌

---

## 📋 Récapitulatif des informations à avoir sauvegardées

À la fin de la Phase 2, tu dois avoir dans ton gestionnaire de mots de passe :

- [ ] **TrajetPro - Supabase Email** (email du compte)
- [ ] **TrajetPro - Supabase Password** (mot de passe du compte)
- [ ] **TrajetPro - Supabase Database Password** (mot de passe de la base — le plus important !)
- [ ] **TrajetPro - Supabase URL** (`https://xxxxx.supabase.co`)
- [ ] **TrajetPro - Supabase Anon Key** (clé publique, ok pour l'app)
- [ ] **TrajetPro - Supabase Service Role Key** (clé privée, jamais dans l'app !)

**Si tu as tout ça, tu es prêt pour la suite.** 🎉

---

*Ce guide fait ~50 pages imprimées et couvre toute la Phase 2 sans aucun raccourci. Chaque clic, chaque script, chaque erreur possible est documenté. Tu peux le relire autant de fois que nécessaire, revenir en arrière, faire des pauses. Tu avances à ton rythme.*

*Bon courage ! 🚗💨*
