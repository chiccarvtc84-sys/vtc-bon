-- ============================================================================
-- TRAJETPRO - SCHEMA COMPLET SUPABASE
-- ============================================================================
-- Version : 1.0.0
-- Date : 2026-04-27
-- Auteur : Conducteur (initial) + Claude (assistance)
--
-- Ce script crée TOUT le schéma de la base depuis zéro.
-- Si tu pars d'une base vide : exécute tout d'un coup.
-- Si tu as déjà des tables : les commandes DROP en début vont les nettoyer.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. NETTOYAGE (en cas de réinstallation)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_sync_token_balance ON public.token_transactions;
DROP TRIGGER IF EXISTS trg_risk_on_signup ON public.users;
DROP FUNCTION IF EXISTS sync_token_balance_on_transaction();
DROP FUNCTION IF EXISTS calculate_risk_on_signup();
DROP FUNCTION IF EXISTS consume_tokens(UUID, INTEGER, TEXT, UUID);
DROP FUNCTION IF EXISTS credit_token_purchase(UUID, INTEGER, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS credit_monthly_bonus(UUID);
DROP FUNCTION IF EXISTS credit_referral_bonus(UUID, UUID);
DROP FUNCTION IF EXISTS is_disposable_email(TEXT);

DROP TABLE IF EXISTS public.token_transactions CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.verification_codes CASCADE;
DROP TABLE IF EXISTS public.device_fingerprints CASCADE;
DROP TABLE IF EXISTS public.blocked_email_domains CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ----------------------------------------------------------------------------
-- 2. TABLE : users
-- ----------------------------------------------------------------------------
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  siret TEXT NOT NULL,
  company_name TEXT,
  vtc_number TEXT,
  pro_card_number TEXT,
  vehicle_plate TEXT,
  vehicle_model TEXT,
  base_city TEXT,
  vat_rate NUMERIC(5,2) DEFAULT 10.00,

  -- Système de tokens
  token_balance INTEGER DEFAULT 0 CHECK (token_balance >= 0),

  -- Parrainage
  referral_code TEXT UNIQUE NOT NULL,
  referred_by TEXT,
  referrals_count INTEGER DEFAULT 0,

  -- Bonus mensuel
  last_monthly_bonus_at TIMESTAMPTZ,

  -- Anti-fraude
  email_verified BOOLEAN DEFAULT FALSE,
  siret_verified BOOLEAN DEFAULT FALSE,
  device_fingerprint TEXT,
  last_known_ip INET,
  risk_score INTEGER DEFAULT 0,
  flagged BOOLEAN DEFAULT FALSE,
  flagged_reason TEXT,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_referral_code ON public.users(referral_code);
CREATE INDEX idx_users_siret ON public.users(siret);
CREATE INDEX idx_users_device_fingerprint ON public.users(device_fingerprint);
CREATE INDEX idx_users_flagged ON public.users(flagged) WHERE flagged = TRUE;

-- ----------------------------------------------------------------------------
-- 3. TABLE : bookings
-- ----------------------------------------------------------------------------
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,

  pickup_address TEXT NOT NULL,
  dropoff_address TEXT NOT NULL,
  pickup_datetime TIMESTAMPTZ NOT NULL,

  passengers INTEGER DEFAULT 1 CHECK (passengers > 0 AND passengers <= 8),
  has_luggage BOOLEAN DEFAULT FALSE,
  child_seat BOOLEAN DEFAULT FALSE,
  vehicle_category TEXT DEFAULT 'standard',

  distance_km NUMERIC(8,2),
  duration_min INTEGER,

  price_ht NUMERIC(10,2),
  price_vat NUMERIC(10,2),
  price_ttc NUMERIC(10,2) NOT NULL CHECK (price_ttc > 0),

  notes TEXT,
  type TEXT DEFAULT 'manual' CHECK (type IN ('manual', 'voice', 'platform', 'recurring')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),

  -- Si la course vient d'une plateforme externe (Uber, Bolt, etc.)
  platform_source TEXT,
  platform_booking_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX idx_bookings_pickup_datetime ON public.bookings(pickup_datetime);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_user_active ON public.bookings(user_id) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 4. TABLE : invoices
-- ----------------------------------------------------------------------------
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,

  invoice_number TEXT NOT NULL,

  customer_name TEXT NOT NULL,
  customer_address TEXT,
  customer_email TEXT,
  customer_vat_intra TEXT,

  amount_ht NUMERIC(10,2) NOT NULL,
  amount_vat NUMERIC(10,2) NOT NULL,
  amount_ttc NUMERIC(10,2) NOT NULL CHECK (amount_ttc > 0),
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  vat_reverse_charge BOOLEAN DEFAULT FALSE,

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded')),
  payment_method TEXT,

  -- Empreinte fiscale (immutabilité légale)
  fingerprint TEXT NOT NULL,
  fingerprint_algorithm TEXT DEFAULT 'sha256',

  -- Documents
  pdf_url TEXT,
  qr_code_data TEXT,

  issued_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (user_id, invoice_number)
);

CREATE INDEX idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX idx_invoices_booking_id ON public.invoices(booking_id);
CREATE INDEX idx_invoices_issued_at ON public.invoices(issued_at);
CREATE INDEX idx_invoices_status ON public.invoices(status);

-- ----------------------------------------------------------------------------
-- 5. TABLE : token_transactions
-- ----------------------------------------------------------------------------
CREATE TABLE public.token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  kind TEXT NOT NULL CHECK (kind IN (
    'welcome',           -- crédits bienvenue à l'inscription (+5)
    'purchase',          -- achat d'un pack
    'monthly_bonus',     -- bonus mensuel de fidélité (+1)
    'referral_bonus',    -- bonus parrainage (+10 ou +5)
    'admin_credit',      -- ajout manuel par admin
    'consume_booking',   -- consommation pour un bon (-1)
    'consume_invoice',   -- consommation pour une facture (-1)
    'refund',            -- remboursement
    'expiration'         -- expiration de crédits (jamais utilisé pour l'instant)
  )),

  tokens_delta INTEGER NOT NULL,

  -- Pour les achats
  package_id TEXT,
  amount_ht NUMERIC(10,2),
  amount_vat NUMERIC(10,2),
  amount_ttc NUMERIC(10,2),
  vat_applied BOOLEAN DEFAULT FALSE,
  vat_intra TEXT,
  payment_method TEXT,
  invoice_number TEXT,
  stripe_payment_intent_id TEXT,

  -- Liens
  related_booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  related_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  related_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_token_tx_user_id ON public.token_transactions(user_id);
CREATE INDEX idx_token_tx_created_at ON public.token_transactions(created_at DESC);
CREATE INDEX idx_token_tx_kind ON public.token_transactions(kind);
CREATE INDEX idx_token_tx_stripe ON public.token_transactions(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 6. TABLE : device_fingerprints
-- ----------------------------------------------------------------------------
CREATE TABLE public.device_fingerprints (
  fingerprint TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  accounts_count INTEGER DEFAULT 1,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  flagged BOOLEAN DEFAULT FALSE,
  notes TEXT
);

CREATE INDEX idx_device_fingerprints_user_id ON public.device_fingerprints(user_id);
CREATE INDEX idx_device_fingerprints_flagged ON public.device_fingerprints(flagged) WHERE flagged = TRUE;

-- ----------------------------------------------------------------------------
-- 7. TABLE : verification_codes
-- ----------------------------------------------------------------------------
CREATE TABLE public.verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('email_confirm', 'password_reset', 'phone_verify')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_verification_codes_email ON public.verification_codes(email);
CREATE INDEX idx_verification_codes_expires ON public.verification_codes(expires_at);

-- ----------------------------------------------------------------------------
-- 8. TABLE : blocked_email_domains
-- ----------------------------------------------------------------------------
CREATE TABLE public.blocked_email_domains (
  domain TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'manual'
);

-- (Importer la liste des 400+ domaines depuis le guide phase3)

-- ============================================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- USERS : un utilisateur peut voir/modifier uniquement son propre profil
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- BOOKINGS : un utilisateur peut voir/modifier uniquement ses bons
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings_select_own" ON public.bookings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "bookings_insert_own" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookings_update_own" ON public.bookings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "bookings_delete_own" ON public.bookings
  FOR DELETE USING (auth.uid() = user_id);

-- INVOICES : un utilisateur peut voir uniquement ses factures
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select_own" ON public.invoices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "invoices_insert_own" ON public.invoices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ⚠️ Les factures NE PEUVENT PAS être modifiées (immutabilité fiscale)
-- Pas de policy UPDATE/DELETE

-- TOKEN_TRANSACTIONS : un utilisateur peut voir uniquement ses transactions
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "token_tx_select_own" ON public.token_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- ⚠️ Les INSERTs se font UNIQUEMENT via les fonctions SECURITY DEFINER (pas via API)

-- DEVICE_FINGERPRINTS : lecture publique pour les besoins de signup
ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "device_fingerprints_select_all" ON public.device_fingerprints
  FOR SELECT USING (TRUE);

CREATE POLICY "device_fingerprints_insert_own" ON public.device_fingerprints
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- BLOCKED_EMAIL_DOMAINS : lecture seule pour tout le monde
ALTER TABLE public.blocked_email_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocked_domains_select_all" ON public.blocked_email_domains
  FOR SELECT USING (TRUE);

-- ============================================================================
-- 10. FONCTIONS RPC
-- ============================================================================

-- ----------------------------------------------------------------------------
-- is_disposable_email : vérifie si un email est jetable
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_disposable_email(p_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  email_domain TEXT;
  is_blocked BOOLEAN;
BEGIN
  email_domain := LOWER(SPLIT_PART(p_email, '@', 2));

  SELECT EXISTS(
    SELECT 1 FROM public.blocked_email_domains
    WHERE domain = email_domain
  ) INTO is_blocked;

  RETURN is_blocked;
END;
$$ LANGUAGE plpgsql STABLE;

-- ----------------------------------------------------------------------------
-- consume_tokens : décrémente les crédits de manière atomique
-- ----------------------------------------------------------------------------
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
  -- Lire le solde et verrouiller la ligne
  SELECT token_balance INTO current_balance
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF current_balance IS NULL OR current_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  -- Le trigger trg_sync_token_balance va décrémenter automatiquement
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

-- ----------------------------------------------------------------------------
-- credit_token_purchase : crédite un achat de pack
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION credit_token_purchase(
  p_user_id UUID,
  p_tokens INTEGER,
  p_amount_ttc NUMERIC,
  p_package_id TEXT,
  p_stripe_intent_id TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Vérifier l'unicité du payment_intent (anti-double-crédit)
  IF EXISTS(
    SELECT 1 FROM public.token_transactions
    WHERE stripe_payment_intent_id = p_stripe_intent_id
  ) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.token_transactions (
    user_id, kind, tokens_delta,
    package_id, amount_ttc, payment_method, stripe_payment_intent_id
  ) VALUES (
    p_user_id, 'purchase', p_tokens,
    p_package_id, p_amount_ttc, 'Carte bancaire', p_stripe_intent_id
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- credit_monthly_bonus : donne le bonus mensuel (max 1/mois)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION credit_monthly_bonus(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  already_received_this_month BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.token_transactions
    WHERE user_id = p_user_id
      AND kind = 'monthly_bonus'
      AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
  ) INTO already_received_this_month;

  IF already_received_this_month THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.token_transactions (user_id, kind, tokens_delta)
  VALUES (p_user_id, 'monthly_bonus', 1);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- credit_referral_bonus : crédite le parrain et le filleul
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION credit_referral_bonus(
  p_referrer_id UUID,
  p_referee_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Vérifier qu'on n'a pas déjà donné le bonus
  IF EXISTS(
    SELECT 1 FROM public.token_transactions
    WHERE related_user_id = p_referee_id
      AND user_id = p_referrer_id
      AND kind = 'referral_bonus'
  ) THEN
    RETURN FALSE;
  END IF;

  -- Crédit parrain (+10)
  INSERT INTO public.token_transactions (user_id, kind, tokens_delta, related_user_id)
  VALUES (p_referrer_id, 'referral_bonus', 10, p_referee_id);

  -- Crédit filleul (+5)
  INSERT INTO public.token_transactions (user_id, kind, tokens_delta, related_user_id)
  VALUES (p_referee_id, 'referral_bonus', 5, p_referrer_id);

  -- Incrémenter le compteur de parrainages
  UPDATE public.users
    SET referrals_count = COALESCE(referrals_count, 0) + 1
    WHERE id = p_referrer_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 11. TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- sync_token_balance_on_transaction : sync auto solde ↔ transactions
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_token_balance_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
    SET token_balance = COALESCE(token_balance, 0) + NEW.tokens_delta,
        updated_at = NOW()
    WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_token_balance
  AFTER INSERT ON public.token_transactions
  FOR EACH ROW
  EXECUTE FUNCTION sync_token_balance_on_transaction();

-- ----------------------------------------------------------------------------
-- calculate_risk_on_signup : score de risque automatique
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_risk_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  ip_count INTEGER;
  device_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO ip_count
  FROM public.users
  WHERE last_known_ip = NEW.last_known_ip
    AND id != NEW.id
    AND last_known_ip IS NOT NULL;

  SELECT COUNT(*) INTO device_count
  FROM public.users
  WHERE device_fingerprint = NEW.device_fingerprint
    AND id != NEW.id
    AND device_fingerprint IS NOT NULL;

  NEW.risk_score := 0;

  IF NOT NEW.email_verified THEN
    NEW.risk_score := NEW.risk_score + 30;
  END IF;

  IF NOT NEW.siret_verified THEN
    NEW.risk_score := NEW.risk_score + 25;
  END IF;

  IF device_count > 0 THEN
    NEW.risk_score := NEW.risk_score + 35;
  END IF;

  IF ip_count > 3 THEN
    NEW.risk_score := NEW.risk_score + 20;
  END IF;

  IF NEW.risk_score >= 50 THEN
    NEW.flagged := TRUE;
    NEW.flagged_reason := 'Score risque automatique : ' || NEW.risk_score;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_risk_on_signup
  BEFORE INSERT OR UPDATE OF
    device_fingerprint, last_known_ip,
    email_verified, siret_verified
  ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION calculate_risk_on_signup();

-- ----------------------------------------------------------------------------
-- handle_new_auth_user : crée auto le profil dans public.users à l'inscription
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  user_metadata JSONB;
  new_referral_code TEXT;
BEGIN
  user_metadata := NEW.raw_user_meta_data;

  -- Générer un code parrainage unique
  new_referral_code := UPPER(SUBSTRING(MD5(NEW.id::text || NOW()::text), 1, 8));

  -- Créer le profil dans public.users
  INSERT INTO public.users (
    id, email, name, phone, siret,
    referral_code, referred_by,
    email_verified, siret_verified,
    token_balance
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(user_metadata->>'name', 'Utilisateur'),
    user_metadata->>'phone',
    COALESCE(user_metadata->>'siret', '00000000000000'),
    new_referral_code,
    user_metadata->>'referred_by',
    NEW.email_confirmed_at IS NOT NULL,
    FALSE,
    0
  );

  -- Donner les 5 crédits de bienvenue (via transaction → trigger sync auto)
  INSERT INTO public.token_transactions (user_id, kind, tokens_delta)
  VALUES (NEW.id, 'welcome', 5);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_auth_user();

-- ============================================================================
-- 12. DONNÉES INITIALES (à compléter avec les 400+ domaines)
-- ============================================================================

-- Note : la liste complète des emails jetables est dans
-- guides/phase3_detaillee_debutant.md étape 2

INSERT INTO public.blocked_email_domains (domain) VALUES
('10minutemail.com'), ('mailinator.com'), ('guerrillamail.com'),
('yopmail.com'), ('temp-mail.org'), ('throwaway.email'),
('disposable.email'), ('tempmail.net'), ('fakemail.com'),
('trashmail.com'), ('emailondeck.com'), ('33mail.com'),
('sharklasers.com'), ('grr.la'), ('guerrillamailblock.com')
ON CONFLICT (domain) DO NOTHING;

-- ============================================================================
-- FIN DU SCRIPT
-- ============================================================================

-- Vérifications post-exécution :
-- 1. SELECT COUNT(*) FROM public.users; -- doit être 0
-- 2. SELECT COUNT(*) FROM public.blocked_email_domains; -- doit être >= 15
-- 3. SELECT proname FROM pg_proc WHERE proname IN (
--      'is_disposable_email', 'consume_tokens', 'credit_token_purchase',
--      'credit_monthly_bonus', 'credit_referral_bonus',
--      'sync_token_balance_on_transaction', 'calculate_risk_on_signup',
--      'handle_new_auth_user'
--    );
--    -- doit retourner 8 lignes
-- 4. SELECT trigger_name FROM information_schema.triggers
--    WHERE trigger_schema IN ('public', 'auth');
--    -- doit inclure trg_sync_token_balance, trg_risk_on_signup, on_auth_user_created
