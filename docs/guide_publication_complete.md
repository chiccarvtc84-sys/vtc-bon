# 🚀 Guide ultime de publication TrajetPro

> **De "j'ai le code" à "mon app est en ligne sur les stores et 100% opérationnelle"**
>
> Ce guide rassemble et détaille CHAQUE étape à réaliser, dans l'ordre chronologique, avec les vérifications de sécurité à chaque phase.
>
> **Durée totale réaliste :** 8 à 12 semaines
> **Budget total :** 124 € minimum (stores) + 0 à 6000 € (backend selon autonomie vs freelance)
> **Niveau requis :** patient et méthodique

---

## 📊 Vue d'ensemble des 10 phases

| Phase | Durée | Budget | Objectif |
|-------|-------|--------|----------|
| 1. Préparation administrative | 1 sem | 124 € | Comptes créés, entreprise OK |
| 2. Infrastructure backend | 2 sem | 0 € | Supabase opérationnel |
| 3. Sécurité & anti-fraude | 1 sem | 0 € | Toutes les couches actives |
| 4. Migration code frontend | 1 sem | 0 € | App branchée au backend |
| 5. Paiements | 1 sem | 0 € | Stripe intégré et testé |
| 6. Build mobile natif | 1 sem | 0 € | APK/IPA compilés |
| 7. Tests et corrections | 1 sem | 0 € | Beta réussie |
| 8. Soumission stores | 1 sem | 0 € | App approuvée |
| 9. Lancement officiel | 1 sem | 0 € | Première communication |
| 10. Maintenance & support | continu | variable | Utilisateurs satisfaits |

---

# PHASE 1 — Préparation administrative (1 semaine)

## 1.1 Ton entreprise doit être en règle

### ✅ Checklist entreprise
- [ ] **SIRET actif** : vérifie sur `annuaire-entreprises.data.gouv.fr`
- [ ] **Inscription VTC (EVTC)** : valide auprès du registre officiel
- [ ] **Carte professionnelle VTC** : en cours de validité
- [ ] **Assurance RC Pro** : indispensable pour éditer un logiciel professionnel
- [ ] **Compte bancaire professionnel** : obligatoire pour recevoir les paiements Stripe
- [ ] **Immatriculation au RCS** : pour une SASU ou EURL (auto-entrepreneur exempté)

### Si tu n'as pas encore de structure juridique
**Recommandation :** crée une **SASU** ou une **micro-entreprise** selon ton profil :
- **Micro-entreprise** (régime simplifié) : gratuit, créé en ligne via `autoentrepreneur.urssaf.fr`, limite CA 77 700 €/an, moins de charges
- **SASU** : environ 250 € de frais, plus de crédibilité, pas de limite CA, possible d'embaucher

**Pour commencer seul avec des revenus modestes, la micro-entreprise suffit parfaitement.**

## 1.2 Comptes à créer dans l'ordre

### 1.2.1 Apple Developer Program — 99 €/an

**Étapes détaillées :**
1. Va sur **`developer.apple.com`**
2. Clique sur **"Account"** en haut à droite
3. Crée un **Apple ID professionnel** avec l'email `contact@trajetpro.fr` (PAS ton Apple ID perso)
4. Clique **"Enroll"** dans le menu Apple Developer Program
5. Pour une personne physique : choisis **"Individual / Sole Proprietor"**
6. Pour une société : choisis **"Organization"** et prépare ton **numéro D-U-N-S** (gratuit, obtenu en 5-10 jours via Dun & Bradstreet)
7. Renseigne tes informations (adresse, téléphone)
8. Paye les **99 €/an**
9. **Attends la validation** : 24h à 10 jours selon les vérifications

⚠️ **Piège courant :** si tu choisis "Individual", ton nom personnel apparaîtra sur l'App Store. Pour afficher "TrajetPro" comme nom d'éditeur, il faut choisir "Organization".

### 1.2.2 Google Play Console — 25 $ une fois

**Étapes :**
1. Va sur **`play.google.com/console`**
2. Connecte-toi avec un **compte Google professionnel**
3. Paye les **25 $** (paiement unique à vie)
4. Remplis les informations entreprise
5. Pour être "Developer validé" (badge bleu obligatoire depuis 2024) : téléverse ta **pièce d'identité** + **justificatif professionnel**
6. Validation quasi instantanée pour le compte, 1-3 jours pour le badge vérifié

### 1.2.3 Supabase — Gratuit

**Étapes :**
1. Va sur **`supabase.com`**
2. Crée un compte avec `contact@trajetpro.fr`
3. Clique **"New project"**
4. **IMPORTANT** : choisis la région **Frankfurt (eu-central-1)** ou **Paris (eu-west-3)** pour la conformité RGPD
5. Mot de passe de base de données : génère un mot de passe fort (24+ caractères) via `1password.com` ou `bitwarden.com` et sauvegarde-le
6. Projet créé en 2 minutes

### 1.2.4 Stripe — Gratuit

**Étapes :**
1. Va sur **`stripe.com/fr`**
2. Crée un compte avec `contact@trajetpro.fr`
3. **Mode Test activé par défaut** — parfait pour développer
4. Pour passer en Live plus tard : activer ton compte en fournissant :
   - KBIS ou SIREN
   - Pièce d'identité
   - RIB professionnel
   - Informations sur l'activité (éditeur de logiciel SaaS)
5. Validation Live : 1-3 jours

### 1.2.5 Autres comptes à créer (gratuits)
- [ ] **GitHub** (`github.com`) — versionner le code
- [ ] **Sentry** (`sentry.io`) — monitoring erreurs, plan gratuit 5k événements/mois
- [ ] **Resend** (`resend.com`) OU **Mailgun** — emails transactionnels, 3000/mois gratuits
- [ ] **Domaine trajetpro.fr** — chez `ovh.com` ou `gandi.net`, environ 10 €/an

## 1.3 Préparation des documents légaux

Personnalise tes documents légaux (fichier `documents_legaux_trajetpro.md` déjà fourni) :

1. **Politique de confidentialité** — en ligne sur `trajetpro.fr/confidentialite.html`
2. **CGU** — en ligne sur `trajetpro.fr/cgu.html`
3. **Mentions légales** — en ligne sur `trajetpro.fr/mentions-legales.html`

**Hébergement gratuit recommandé :** GitHub Pages
- Crée un repo public `trajetpro/legal`
- Uploade tes 3 fichiers HTML
- Active GitHub Pages dans Settings → Pages
- Tes URLs seront `https://trajetpro.github.io/legal/confidentialite.html`

**Alternative :** héberge sur ton domaine `trajetpro.fr` directement via OVH (interface simple).

## 1.4 Déclaration CNIL

**Obligation légale :** tenir un **registre des traitements** (RGPD article 30).

Pas de déclaration préalable à faire (sauf cas particuliers), mais :
1. Télécharge le modèle officiel sur **`cnil.fr`** (recherche "registre traitements")
2. Remplis avec les 3-4 traitements de TrajetPro (inscription, paiement, facturation, support)
3. Conserve ce document dans tes archives, il peut être demandé en cas de contrôle

---

# PHASE 2 — Infrastructure backend (2 semaines)

## 2.1 Création des tables Supabase

**Dans Supabase Dashboard → SQL Editor, exécute ces scripts dans l'ordre :**

### Table users
```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  siret TEXT UNIQUE,
  evtc_number TEXT UNIQUE,
  company_name TEXT,
  vehicle_model TEXT,
  vehicle_plate TEXT,
  pro_card_number TEXT,
  iban TEXT,
  vat_intra TEXT,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by UUID REFERENCES public.users(id),
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
  token_balance INTEGER DEFAULT 0,
  last_monthly_bonus DATE,
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_siret ON public.users(siret);
CREATE INDEX idx_users_referral_code ON public.users(referral_code);
CREATE INDEX idx_users_device_fingerprint ON public.users(device_fingerprint);
```

### Autres tables

Exécute également les scripts des tables `bookings`, `invoices`, `token_transactions`, `device_fingerprints`, et `verification_codes` (détaillés dans le `guide_backend_trajetpro.md`).

## 2.2 Activation de la Row Level Security (RLS) — CRITIQUE

**Sans RLS, tes utilisateurs pourraient voir les données des autres. C'est la sécurité la plus importante.**

```sql
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "bookings_all_own" ON public.bookings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "invoices_read_own" ON public.invoices
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "invoices_insert_own" ON public.invoices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions_read_own" ON public.token_transactions
  FOR SELECT USING (auth.uid() = user_id);
```

## 2.3 Fonctions PostgreSQL pour les opérations critiques

Les fonctions RPC permettent d'effectuer des opérations complexes en une seule transaction. Essentiel pour éviter les abus.

### Consommation de crédits (atomique)
```sql
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
```

**Pourquoi SECURITY DEFINER ?** Parce que la fonction doit pouvoir décrémenter les tokens, ce qui n'est normalement pas autorisé par la RLS. On contourne via `SECURITY DEFINER` qui exécute avec les droits du propriétaire de la fonction.

### Crédit de bonus mensuel
```sql
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
```

## 2.4 Configuration de l'authentification Supabase

**Dans Supabase Dashboard → Authentication → Providers :**

1. **Email** : activé par défaut
2. **Cocher "Confirm email"** → obligatoire pour notre système anti-fraude
3. **Secure password change** : activé
4. **Password minimum length** : 8 caractères

**Dans Authentication → Email Templates :**

1. Personnalise le template "Confirm signup" avec ton branding TrajetPro
2. Personnalise "Magic Link", "Change Email Address", "Reset Password"
3. Change le "From" email pour `noreply@trajetpro.fr` (nécessite configuration DNS, voir §2.5)

## 2.5 Configuration DNS pour ton domaine

Pour avoir `noreply@trajetpro.fr` au lieu de `noreply@supabase.co` :

1. Va dans ton registrar (OVH, Gandi)
2. Ajoute ces enregistrements DNS (fournis par Supabase ou Resend) :

```
Type: TXT
Name: @
Value: v=spf1 include:_spf.google.com include:sendgrid.net ~all

Type: MX
Name: @
Value: 10 smtp.resend.com

Type: TXT (DKIM)
Name: resend._domainkey
Value: [fourni par Resend]

Type: TXT (DMARC)
Name: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:contact@trajetpro.fr
```

Propagation DNS : 1 à 48 heures selon le registrar.

## 2.6 Vérification rapide

À ce stade, teste :
- [ ] Je peux créer un utilisateur via Supabase Dashboard
- [ ] L'email de confirmation arrive bien dans une boîte mail de test
- [ ] Quand je clique le lien, l'utilisateur passe en `email_confirmed: true`
- [ ] La RLS fonctionne : un utilisateur A ne voit pas les données d'un utilisateur B

---

# PHASE 3 — Sécurité & anti-fraude (1 semaine)

## 3.1 Edge Function : validation SIRET via INSEE

**Dans Supabase Dashboard → Edge Functions → New function `verify-siret` :**

```typescript
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { siret } = await req.json();
  const clean = siret.replace(/\s/g, "");

  // Validation format
  if (!/^\d{14}$/.test(clean)) {
    return new Response(
      JSON.stringify({ valid: false, reason: "Format invalide (14 chiffres requis)" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Algorithme de Luhn pour SIRET
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let d = parseInt(clean[i], 10);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  if (sum % 10 !== 0) {
    return new Response(
      JSON.stringify({ valid: false, reason: "Clé de contrôle invalide" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Appel API INSEE (gratuite)
  try {
    const res = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${clean}&per_page=1`
    );
    const data = await res.json();

    if (data.total_results === 0) {
      return new Response(
        JSON.stringify({ valid: false, reason: "SIRET non trouvé" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const entity = data.results[0];
    const codeAPE = entity.activite_principale || "";
    const isVTC = codeAPE.startsWith("49.32") || codeAPE.startsWith("49.39");

    return new Response(
      JSON.stringify({
        valid: true,
        company_name: entity.nom_complet,
        is_vtc: isVTC,
        address: entity.siege?.adresse || "",
        city: entity.siege?.commune || "",
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ valid: false, reason: "Service INSEE indisponible" }),
      { headers: { "Content-Type": "application/json" }, status: 503 }
    );
  }
});
```

**Déploiement :**
```bash
supabase functions deploy verify-siret
```

## 3.2 Protection contre emails jetables

### Option A — Liste statique (simple)
Insère la liste des 3500 domaines bloqués dans une table Supabase :

```sql
CREATE TABLE public.blocked_email_domains (
  domain TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- Importer la liste depuis github.com/disposable-email-domains
-- Copier tous les domaines et les insérer en bulk via l'éditeur SQL
```

### Option B — API tierce (plus à jour)
Service `Kickbox` ou `ZeroBounce` (payant mais très précis, ~0,005 €/email).

## 3.3 Rate limiting

**Dans Supabase Dashboard → Authentication → Rate Limits :**
- Email signup : max **3 par heure par IP**
- Login attempts : max **5 par heure par email**
- Password reset : max **3 par jour par email**

## 3.4 Device fingerprinting

### Côté app mobile (iOS — Apple DeviceCheck)

Installation du plugin :
```bash
npm install @capacitor-community/devicecheck
npx cap sync ios
```

Utilisation à l'inscription :
```javascript
import { DeviceCheck } from '@capacitor-community/devicecheck';

async function getDeviceToken() {
  try {
    const { token } = await DeviceCheck.generateToken();
    return token;
  } catch (err) {
    return null;
  }
}

// À l'inscription, envoyer ce token au backend qui vérifie
// qu'il n'est pas déjà associé à un autre compte
```

### Côté app mobile (Android — Play Integrity)

```bash
npm install @capacitor-community/play-integrity
npx cap sync android
```

### Côté backend (Edge Function)

La fonction `verify-device.ts` appelle l'API Apple ou Google avec le token et vérifie :
1. Que l'appareil n'est pas déjà enregistré pour un autre compte
2. Que l'appareil n'a pas réinstallé l'app dans les 30 derniers jours

Code détaillé dans le `guide_backend_trajetpro.md`.

## 3.5 Score de risque et flagging automatique

Trigger PostgreSQL qui calcule le score de risque à chaque nouvelle inscription :

```sql
CREATE OR REPLACE FUNCTION calculate_risk_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  ip_count INTEGER;
  device_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO ip_count
  FROM public.users
  WHERE last_known_ip = NEW.last_known_ip AND id != NEW.id;

  SELECT COUNT(*) INTO device_count
  FROM public.users
  WHERE device_fingerprint = NEW.device_fingerprint AND id != NEW.id;

  NEW.risk_score := 0;
  IF NOT NEW.email_verified THEN NEW.risk_score := NEW.risk_score + 30; END IF;
  IF NOT NEW.siret_verified THEN NEW.risk_score := NEW.risk_score + 25; END IF;
  IF device_count > 0 THEN NEW.risk_score := NEW.risk_score + 35; END IF;
  IF ip_count > 3 THEN NEW.risk_score := NEW.risk_score + 20; END IF;

  IF NEW.risk_score >= 50 THEN
    NEW.flagged := TRUE;
    NEW.flagged_reason := 'Score risque automatique: ' || NEW.risk_score;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_risk_on_signup
  BEFORE INSERT OR UPDATE OF device_fingerprint, last_known_ip, email_verified, siret_verified
  ON public.users
  FOR EACH ROW EXECUTE FUNCTION calculate_risk_on_signup();
```

## 3.6 Checklist sécurité finale

- [ ] RLS activée sur toutes les tables
- [ ] Aucune clé `service_role` jamais côté client
- [ ] Vérification SIRET fonctionnelle
- [ ] Blacklist emails jetables active
- [ ] Rate limiting configuré
- [ ] DeviceCheck / Play Integrity intégrés
- [ ] Trigger de score de risque actif
- [ ] Logs d'audit activés (Supabase les active par défaut)

---

# PHASE 4 — Migration code frontend (1 semaine)

## 4.1 Installation des dépendances

```bash
cd trajetpro
npm install @supabase/supabase-js
npm install @capacitor/app @capacitor/preferences @capacitor/network
npm install @capacitor-community/devicecheck
```

## 4.2 Configuration du client Supabase

Crée `src/lib/supabase.js` :

```javascript
import { createClient } from '@supabase/supabase-js';
import { Preferences } from '@capacitor/preferences';

// Adapter pour Capacitor Preferences (stockage persistant)
const CapacitorStorage = {
  getItem: async (key) => {
    const { value } = await Preferences.get({ key });
    return value;
  },
  setItem: async (key, value) => {
    await Preferences.set({ key, value });
  },
  removeItem: async (key) => {
    await Preferences.remove({ key });
  },
};

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: CapacitorStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
```

Crée un fichier `.env` à la racine :
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

**IMPORTANT :** ajoute `.env` à ton `.gitignore` pour ne pas commiter les clés !

## 4.3 Migration des hooks et états

**Avant (prototype) :**
```javascript
const [bookings, setBookings] = useState(INITIAL_BOOKINGS);
```

**Après (production) :**
```javascript
const [bookings, setBookings] = useState([]);

useEffect(() => {
  if (!user) return;
  (async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('pickup_datetime');
    if (!error) setBookings(data);
  })();
}, [user]);
```

## 4.4 Tests de persistance

Sur 2 appareils différents (téléphone perso + simulateur) :
- [ ] Je crée un compte sur l'appareil A
- [ ] Je crée 3 bons de course sur l'appareil A
- [ ] Je me connecte avec le même email/mot de passe sur l'appareil B
- [ ] Je retrouve mes 3 bons
- [ ] Je modifie un bon sur l'appareil B
- [ ] Je retourne sur l'appareil A, je vois la modification

---

# PHASE 5 — Paiements Stripe (1 semaine)

## 5.1 Création des produits Stripe

**Dans Stripe Dashboard → Products :**

Crée 4 produits :
- `Pack Découverte` — 2,00 € TTC — 20 crédits (métadonnée `tokens: 20`)
- `Pack Essentiel` — 3,50 € TTC — 40 crédits (métadonnée `tokens: 40`)
- `Pack Confort` — 4,00 € TTC — 50 crédits (métadonnée `tokens: 50`)
- `Pack Pro` — 5,00 € TTC — 80 crédits (métadonnée `tokens: 80`)

## 5.2 Edge Function : création du Payment Intent

```typescript
import { serve } from "https://deno.land/std/http/server.ts";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-11-20.acacia",
});

const PACKAGES = {
  pack20: { tokens: 20, amount: 200 }, // en centimes
  pack40: { tokens: 40, amount: 350 },
  pack50: { tokens: 50, amount: 400 },
  pack80: { tokens: 80, amount: 500 },
};

serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { package_id, vat_intra } = await req.json();
  const pack = PACKAGES[package_id];
  if (!pack) return new Response("Invalid package", { status: 400 });

  // Auto-liquidation TVA si n° intracommunautaire non-FR
  const applyReverseCharge = vat_intra && !vat_intra.startsWith("FR");
  const finalAmount = applyReverseCharge
    ? Math.round(pack.amount / 1.2)  // Retire la TVA 20%
    : pack.amount;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: finalAmount,
    currency: "eur",
    metadata: {
      user_id: user.id,
      package_id,
      tokens: pack.tokens.toString(),
      vat_intra: vat_intra || "",
      reverse_charge: applyReverseCharge ? "true" : "false",
    },
  });

  return new Response(
    JSON.stringify({ client_secret: paymentIntent.client_secret }),
    { headers: { "Content-Type": "application/json" } }
  );
});
```

## 5.3 Edge Function : webhook Stripe

```typescript
serve(async (req) => {
  const signature = req.headers.get("stripe-signature")!;
  const body = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;
    const { user_id, tokens, package_id } = intent.metadata;

    // Créditer les tokens via RPC
    await supabaseAdmin.rpc("credit_token_purchase", {
      p_user_id: user_id,
      p_tokens: parseInt(tokens),
      p_amount_ttc: intent.amount / 100,
      p_package_id: package_id,
      p_stripe_intent_id: intent.id,
    });

    // Générer et envoyer la facture par email
    await sendInvoiceEmail(user_id, intent);
  }

  return new Response(JSON.stringify({ received: true }));
});
```

**Configuration du webhook dans Stripe :**
1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL : `https://xxxxx.supabase.co/functions/v1/stripe-webhook`
3. Événements à écouter : `payment_intent.succeeded`, `payment_intent.payment_failed`
4. Récupère le webhook signing secret et ajoute-le dans les secrets Supabase

## 5.4 Intégration côté client

```javascript
import { loadStripe } from '@stripe/stripe-js';

async function handlePurchase(packageId) {
  const { data } = await supabase.functions.invoke('create-payment-intent', {
    body: { package_id: packageId, vat_intra: user.vat_intra }
  });

  const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);
  const { error } = await stripe.confirmPayment({
    clientSecret: data.client_secret,
    confirmParams: { return_url: window.location.origin + '/purchase-success' }
  });

  if (!error) {
    // Attendre 2-3s que le webhook crédite les tokens, puis rafraîchir
    setTimeout(refreshUserData, 3000);
  }
}
```

## 5.5 Tests Stripe

**En mode Test :**
- Carte de test : `4242 4242 4242 4242` (expiration quelconque future, CVC quelconque)
- Simule un paiement réussi
- Vérifie que les tokens sont crédités
- Vérifie que la facture est bien envoyée par email

**Avant de passer en Live :**
- [ ] Au moins 10 paiements test réussis
- [ ] Tests de paiement échoué (carte `4000 0000 0000 9995`)
- [ ] Tests de 3D Secure (carte `4000 0025 0000 3155`)
- [ ] Webhook signature vérifiée
- [ ] Factures générées sans erreur

---

# PHASE 6 — Build mobile natif (1 semaine)

## 6.1 Préparation des assets visuels

### Icône de l'app
- **Dimensions obligatoires** : 1024 × 1024 px, PNG, sans coins arrondis, sans transparence
- **Outil recommandé** : Canva (modèle "App Icon" gratuit)
- **Design** : fond doré `#F4B942`, symbole voiture stylisée au centre, lettre "T" décorative

Génération automatique des 30+ tailles nécessaires :
```bash
npm install -g @capacitor/assets
mkdir resources
# Place ton icone 1024x1024 dans resources/icon.png
# Place ton splash 2732x2732 dans resources/splash.png
npx capacitor-assets generate
```

### Captures d'écran (screenshots)

**iOS — 3 tailles obligatoires minimum :**
- iPhone 6.7" : **1290 × 2796 px** (iPhone 15 Pro Max)
- iPhone 6.5" : **1284 × 2778 px** (iPhone 14 Plus)
- iPad 12.9" : **2048 × 2732 px** (si tu supportes iPad)

**Android — 2 tailles :**
- Téléphone : **1080 × 2340 px**
- Tablette : **2048 × 2732 px** (facultatif)

**Comment les générer :**
1. Lance l'app sur le simulateur iOS avec l'iPhone 15 Pro Max
2. Menu File → Save Screen Shot (Cmd+S)
3. Répète pour chaque écran important (accueil, dictée, facture, profil, crédits)
4. Utilise **Screenshots Generator** (shotbot.io) ou Canva pour ajouter un titre percutant

**Titres accrocheurs suggérés :**
- "Dictez, on remplit tout pour vous"
- "Conforme décret 2017-483"
- "Facturation automatique"
- "5 crédits offerts à l'inscription"
- "Parrainez vos collègues"

## 6.2 Configuration Capacitor

Dans `capacitor.config.ts` :
```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trajetpro.app',  // Unique mondialement
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

## 6.3 Build iOS (sur Mac obligatoire)

```bash
npm run build
npx cap sync ios
npx cap open ios
```

**Dans Xcode :**
1. Sélectionne le projet **App** → onglet **Signing & Capabilities**
2. Coche **Automatically manage signing**
3. Team : choisis ton **Apple Developer Team**
4. Bundle ID : `com.trajetpro.app` (déjà configuré)

**Permissions à déclarer dans `Info.plist` :**
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

**Archive pour l'App Store :**
1. Choisis **"Any iOS Device (arm64)"** en haut
2. Menu **Product → Archive** (prend 5-15 min)
3. Fenêtre Organizer s'ouvre → **Distribute App** → **App Store Connect** → **Upload**
4. Suis les étapes, valide les options par défaut
5. Upload terminé en 5-10 min

## 6.4 Build Android

```bash
npm run build
npx cap sync android
npx cap open android
```

**Dans Android Studio :**

1. Menu **Build** → **Generate Signed Bundle / APK**
2. Choisis **Android App Bundle** (.aab)
3. **Première fois :** clique **Create new...** pour générer la clé de signature
   - **Keystore path** : `~/keystores/trajetpro.jks` (sauvegarde ailleurs aussi !)
   - **Password** : fort et sauvegardé dans un gestionnaire
   - **Alias** : `trajetpro`
   - **Validity** : 25 ans minimum
4. ⚠️ **CRITIQUE : sauvegarde cette clé sur 2 endroits différents** (cloud chiffré + disque externe). Si tu la perds, tu ne pourras **plus jamais** mettre à jour ton app.

5. Build Variant : **release**
6. Clique **Finish** (5-10 min de build)
7. Fichier généré dans `android/app/release/app-release.aab`

---

# PHASE 7 — Tests et corrections (1 semaine)

## 7.1 TestFlight (iOS)

1. **App Store Connect → TestFlight → iOS Builds** → sélectionne le build uploadé
2. Complète les infos obligatoires (quelles fonctionnalités tester)
3. **Internal Testing** : invite jusqu'à 100 testeurs internes (ton équipe)
4. **External Testing** : invite jusqu'à 10 000 testeurs externes par email (nécessite review Apple de 24h pour la première version)

**Liste de testeurs recommandée :**
- 2-3 personnes de confiance (amis, famille)
- 5-10 chauffeurs VTC qui ont répondu positivement au questionnaire
- 2-3 experts (ton comptable, un avocat si possible)

## 7.2 Test interne Google Play

1. **Play Console → Testing → Internal testing**
2. Upload du fichier .aab
3. Ajoute les emails Gmail des testeurs
4. Lien d'installation envoyé automatiquement

## 7.3 Scénarios de test à faire valider

**Parcours utilisateur critiques :**
- [ ] Inscription complète avec vérification email
- [ ] Inscription avec code de parrainage (vérifier que le parrain reçoit ses 10 crédits)
- [ ] Connexion sur un 2e téléphone et synchronisation des données
- [ ] Création d'un bon par dictée vocale (vérifier la précision de la reconnaissance)
- [ ] Création d'un bon manuel
- [ ] Édition d'un bon existant
- [ ] Émission d'une facture
- [ ] Achat d'un pack de crédits en mode test Stripe
- [ ] Vérification de la réception de la facture par email
- [ ] Tentative de création avec 0 crédit (vérifier le modal de recharge)
- [ ] Déconnexion puis reconnexion
- [ ] Parrainage : code copié, partagé, filleul inscrit

**Tests anti-fraude :**
- [ ] Inscription avec email jetable → bloqué
- [ ] SIRET invalide → bloqué
- [ ] Tentative d'inscription d'un 2e compte sur le même appareil → bloqué
- [ ] Désinstallation + réinstallation de l'app → bloquer la récupération de crédits offerts

**Tests de performance :**
- [ ] Chargement initial < 3 secondes sur 4G
- [ ] Actions utilisateur < 500ms
- [ ] Pas de crash sur 100 créations successives

## 7.4 Corrections et itérations

**Workflow de correction :**
```bash
# 1. Modifie le code
# 2. Incrémente le numéro de version :
#    - Dans package.json : "version": "1.0.1"
#    - Dans Xcode : Build number +1
#    - Dans android/app/build.gradle : versionCode +1

# 3. Rebuild et reupload :
npm run build
npx cap sync
npx cap open ios
# → Archive → Distribute → Upload

# Puis :
npx cap open android
# → Generate Signed Bundle
```

**Attends retour des testeurs pendant 3-7 jours avant de publier officiellement.**

---

# PHASE 8 — Soumission officielle aux stores (1 semaine)

## 8.1 App Store Connect

### Fiche App Store complète

**Onglet "App Information" :**
- **Name** : TrajetPro (doit être unique mondialement, vérifie avant)
- **Subtitle** : "Bons de course VTC à la voix"
- **Category** : Primary = Business, Secondary = Productivity
- **Content Rights** : Does Not Contain, Use, or Access Third-Party Content

**Onglet "Pricing and Availability" :**
- **Price** : Free
- **Availability** : France (et optionnellement Belgique, Suisse, Luxembourg)

**Onglet "App Privacy" (obligatoire depuis 2021) :**
Remplis le questionnaire sur les données collectées :
- Contact Info (Email, Phone, Name) : "Used for: App Functionality, Account"
- Financial Info (Purchase History) : "Used for: App Functionality"
- Identifiers (Device ID) : "Used for: App Functionality, Analytics"
- Toutes les données sont **liées à l'utilisateur** et non utilisées pour le tracking

**Version 1.0 de l'app :**
- **Promotional Text** : "TrajetPro vous fait gagner 5h par semaine sur votre gestion admin. Dictez, on fait le reste." (170 caractères)
- **Description** (max 4000 caractères) :

```
TrajetPro est l'application de référence pour les chauffeurs VTC indépendants français qui veulent simplifier leur gestion quotidienne.

🎙️ DICTÉE VOCALE INTELLIGENTE
Dictez naturellement votre course : "Je récupère Jean Martin à la gare TGV à 14h pour l'aéroport". TrajetPro remplit automatiquement toutes les informations en 5 secondes.

📄 BONS DE COURSE CONFORMES
Tous vos bons sont automatiquement conformes au décret 2017-483. Finies les amendes en contrôle, toutes les mentions obligatoires sont ajoutées.

💰 FACTURATION AUTOMATIQUE
Générez une facture en un clic avec numérotation chronologique, empreinte fiscale et QR code. Conformité garantie en cas de contrôle fiscal.

🎁 5 CRÉDITS OFFERTS
À l'inscription, recevez 5 crédits gratuits. Parrainez un collègue : vous gagnez 10 crédits, il en gagne 5.

🗺️ ADRESSES INTELLIGENTES
TrajetPro reconnaît les gares, aéroports et lieux touristiques près de chez vous pour une saisie encore plus rapide.

💳 PAIEMENT À L'UNITÉ
Pas d'abonnement, pas d'engagement. Rechargez vos crédits quand vous en avez besoin (packs à partir de 2€).

🔒 SÉCURISÉ ET CONFORME RGPD
Vos données sont chiffrées et hébergées en Europe. Un seul compte par personne grâce à nos vérifications anti-fraude.

Rejoignez les chauffeurs VTC qui ont choisi la sérénité : TrajetPro.
```

- **Keywords** (max 100 caractères) : `VTC,chauffeur,course,facture,bon,réservation,conducteur,taxi,voiture`
- **Support URL** : `https://trajetpro.fr/support`
- **Marketing URL** : `https://trajetpro.fr` (facultatif)
- **Privacy Policy URL** : `https://trajetpro.fr/confidentialite.html`

**Version Information :**
- **Screenshots** : upload les captures 1290×2796 et 1284×2778
- **App Preview** (facultatif mais fortement recommandé) : vidéo 15-30 secondes
- **Copyright** : © 2026 TrajetPro
- **Age Rating** : remplir le questionnaire → 4+

### Soumission
1. Onglet **"Build"** → sélectionne le build TestFlight validé
2. **"App Review Information"** :
   - Sign-in required : **OUI**
   - Demo account : `demo@trajetpro.fr` / `Demo12345!`
   - Notes en anglais :
     ```
     Dear Reviewer,

     TrajetPro is a booking and invoicing application for French licensed private drivers (VTC - Véhicule de Transport avec Chauffeur).

     It helps them comply with French decree 2017-483 by generating compliant transport vouchers and tax-compliant invoices.

     To test:
     1. Sign in with demo@trajetpro.fr / Demo12345!
     2. Try the microphone button on home screen to test voice input
     3. Use the example phrase button if microphone is not available
     4. Navigate through bookings, invoices, and profile sections

     The app has anti-fraud measures including SIRET verification (French business ID) and device fingerprinting.

     Thank you for your review.
     ```
3. Clique **"Submit for Review"**
4. **Délai** : 24h à 3 jours habituellement

### Raisons fréquentes de rejet et comment les éviter

| Motif | Solution |
|-------|----------|
| Guideline 5.1.1 (Privacy) | URL politique de confidentialité accessible |
| Guideline 2.1 (Performance) | Pas de crash, fonctionnalités testables |
| Guideline 4.0 (Design) | Pas de texte tronqué, boutons cliquables, design soigné |
| Guideline 2.3 (Accurate Metadata) | Description fidèle aux fonctionnalités |
| Guideline 3.1.1 (In-App Purchase) | Attention : si tu vends des "crédits virtuels" utilisés dans l'app, Apple EXIGE l'utilisation de ses In-App Purchases (30% de commission). Alternative : les achats peuvent se faire via un site web externe (Stripe). **À clarifier en amont avec un expert Apple.** |

## 8.2 Google Play Console

### Fiche Google Play complète

**Onglet "Store listing" :**
- **App name** : TrajetPro
- **Short description** (80 car.) : "Bons de course VTC à la voix, conformes au décret 2017-483"
- **Full description** (4000 car.) : même contenu qu'App Store
- **Screenshots** : upload 1080×2340 ou 1080×1920
- **High-res icon** : 512×512 px
- **Feature graphic** : 1024×500 px (image horizontale pour la page Play Store)
- **Category** : Business
- **Email** : contact@trajetpro.fr
- **Website** : https://trajetpro.fr
- **Privacy Policy** : https://trajetpro.fr/confidentialite.html

**Onglet "Content rating" :**
Remplis le questionnaire → PEGI 3 ou IARC équivalent

**Onglet "Target audience and content" :**
- Age : 18+ (application professionnelle)
- Children content : Non

**Onglet "Data safety" :**
Déclare honnêtement les données collectées (email, nom, téléphone, SIRET, etc.) et leur usage. Google est **très strict** sur cette section — toute incohérence entraîne un rejet.

### Soumission
1. Onglet **Production** → **Create new release**
2. Upload le fichier .aab
3. Notes de version : "Lancement initial de TrajetPro"
4. **Review release** → **Start rollout to Production**
5. **Délai** : 1 à 7 jours pour la première version

### Raisons fréquentes de rejet Google Play
- **Data safety** mal remplie ou incohérente avec le code
- **Permissions** non justifiées dans la description
- **Icône ou screenshots** non conformes aux guidelines
- **Copie d'une app existante**

---

# PHASE 9 — Lancement officiel (1 semaine)

## 9.1 Préparation de la communication

### Site web (trajetpro.fr)

Crée une **landing page simple** via Carrd (gratuit) ou Notion :
- Hero : "L'application VTC qui vous fait gagner 5h par semaine"
- Démo : GIF ou vidéo de la dictée vocale
- 3-4 features clés
- Badges "Disponible sur App Store" et "Disponible sur Google Play"
- Formulaire de contact
- Liens vers les documents légaux

### Pages réseaux sociaux
- [ ] **Facebook** : page business "TrajetPro"
- [ ] **Instagram** : compte trajetpro.officiel
- [ ] **LinkedIn** : page entreprise
- [ ] **TikTok** : compte trajetpro (pour atteindre les jeunes chauffeurs)

### Contenu de lancement
Prépare à l'avance :
- **Post d'annonce** : "Aujourd'hui, TrajetPro est officiellement disponible sur App Store et Google Play..."
- **Vidéo démo de 60 secondes** : créée avec Screen Recording + voix off
- **3 posts d'usage** pour les 3 semaines suivantes
- **Email à ta base** : aux 20-30 répondants du questionnaire

## 9.2 Jour J — Check-list de lancement

**Matin (9h-11h) :**
- [ ] Vérifier que l'app est bien disponible sur App Store et Google Play
- [ ] Télécharger l'app sur ton téléphone personnel pour valider
- [ ] Faire un achat de crédits test en mode Live Stripe (avec remboursement immédiat)
- [ ] Vérifier que tous les emails transactionnels arrivent

**Midi (12h-14h) :**
- [ ] Publier sur les réseaux sociaux (Facebook, LinkedIn, Instagram)
- [ ] Envoyer l'email aux répondants du questionnaire
- [ ] Publier dans les groupes Facebook VTC (10-15 groupes ciblés)
- [ ] Poster sur les forums VTC (VTC-Network, Reddit r/France_VTC)

**Après-midi (14h-18h) :**
- [ ] Répondre aux premiers messages et questions
- [ ] Surveiller Sentry pour détecter d'éventuels crashes
- [ ] Vérifier les métriques Supabase (nb d'inscriptions)

## 9.3 Objectifs de lancement (premier mois)

| Indicateur | Objectif min | Objectif ambitieux |
|------------|--------------|---------------------|
| Téléchargements | 100 | 500 |
| Comptes créés | 50 | 250 |
| Utilisateurs actifs | 20 | 100 |
| Achats de crédits | 10 (20 €) | 50 (150 €) |
| Note moyenne | 4.0/5 | 4.5/5 |
| Nombre d'avis | 5 | 30 |

Si tu atteins les objectifs minimum, continue d'investir. Si tu es en-dessous, réévalue ta stratégie marketing avant le produit.

---

# PHASE 10 — Maintenance et support (continu)

## 10.1 Routine quotidienne (15-30 min/jour)

**Chaque matin :**
- [ ] Check Sentry : y a-t-il eu des crashes nouveaux ?
- [ ] Check Supabase : combien de nouvelles inscriptions ?
- [ ] Check les emails de support
- [ ] Check les avis App Store et Google Play

**Chaque soir :**
- [ ] Répondre à tous les messages support (max 24h)
- [ ] Répondre à tous les nouveaux avis (même positifs)

## 10.2 Routine hebdomadaire (2h/semaine)

- [ ] Vérifier les métriques clés (rétention, MAU, conversion)
- [ ] Analyser les comptes flaggués (risk_score > 50) → décider de valider ou bloquer
- [ ] Examiner les discussions dans les groupes VTC → détecter des demandes de features
- [ ] Publier un post sur les réseaux sociaux

## 10.3 Routine mensuelle (1 jour/mois)

- [ ] Vérifier que le cron de bonus mensuel a bien tourné le 1er du mois
- [ ] Audit de sécurité : consulter les logs Supabase pour détecter des anomalies
- [ ] Backup manuel de la base de données (en plus des backups automatiques)
- [ ] Publier une mise à jour mineure de l'app (améliorations, corrections)

## 10.4 Critères pour ajouter de nouvelles features

Avant d'ajouter une feature, pose-toi ces questions :
- [ ] Au moins 5 utilisateurs l'ont explicitement demandée ?
- [ ] Est-ce compatible avec le modèle de monétisation par crédits ?
- [ ] Peut-on la construire en moins de 3 jours ?
- [ ] Va-t-elle améliorer la rétention des utilisateurs existants ou recruter de nouveaux ?

Si 3 réponses sur 4 sont "oui", ajoute-la. Sinon, note-la dans un backlog et réévalue plus tard.

## 10.5 Roadmap suggérée pour les 6 premiers mois

| Mois | Priorité |
|------|----------|
| M+1 | Stabilisation, correction des bugs remontés, amélioration du parcours d'inscription |
| M+2 | Tableau de bord CA avec graphiques mensuels |
| M+3 | Carnet de clients (auto-complétion des habitués) |
| M+4 | Export FEC pour comptables, relances de factures impayées |
| M+5 | Abonnement Pro (illimité à 9,90€/mois) pour les gros utilisateurs |
| M+6 | Intégration Google Maps pour optimisation de trajet, signature client sur écran |

---

# 📋 CHECKLIST FINALE COMPLÈTE

## Avant de publier — Sécurité

- [ ] RLS activée sur toutes les tables Supabase
- [ ] Clés `service_role` jamais exposées côté client
- [ ] HTTPS partout
- [ ] Webhooks Stripe avec signature vérifiée
- [ ] Rate limiting actif (auth, signup, password reset)
- [ ] Sessions JWT avec durée de vie limitée (1h + refresh token)
- [ ] Passwords hashés (bcrypt/argon2) — géré par Supabase Auth
- [ ] Vérification email obligatoire
- [ ] Vérification SIRET via INSEE
- [ ] Device fingerprinting (DeviceCheck / Play Integrity)
- [ ] Score de risque automatique
- [ ] Backups Supabase activés
- [ ] Monitoring Sentry configuré

## Avant de publier — Contenu

- [ ] Icône 1024×1024 de qualité professionnelle
- [ ] Screenshots iOS (3 tailles minimum)
- [ ] Screenshots Android
- [ ] Description Apple + Google prête
- [ ] Vidéo de démo (optionnel mais recommandé)
- [ ] 3 documents légaux en ligne et accessibles
- [ ] Site vitrine trajetpro.fr en ligne
- [ ] Email contact@trajetpro.fr fonctionnel

## Avant de publier — Comptes

- [ ] Apple Developer Program payé et validé
- [ ] Google Play Console payé et validé
- [ ] Entreprise VTC en règle (SIRET, EVTC, assurance)
- [ ] Compte Stripe en mode Live
- [ ] Clés de signature Android sauvegardées en 2 endroits
- [ ] Registre CNIL des traitements rédigé

## Après publication — Suivi

- [ ] Première semaine : présence quotidienne pour répondre aux messages
- [ ] Premier mois : rapport hebdomadaire sur les métriques clés
- [ ] Premier trimestre : bilan financier pour décider des investissements suivants

---

# 🆘 EN CAS DE PROBLÈME

**Mon app crashe à l'ouverture :**
- Check Sentry pour l'erreur exacte
- Vérifie que les variables d'environnement sont bien injectées dans le build
- Teste avec `npx cap run ios --livereload` pour voir en temps réel

**Un utilisateur se plaint qu'il ne reçoit pas ses crédits après paiement :**
- Vérifie le webhook Stripe : est-il bien reçu ?
- Regarde la table `token_transactions` : y a-t-il une entrée ?
- Si bug : crédite manuellement via SQL, contacte l'utilisateur

**Mon app est rejetée par Apple :**
- Lis attentivement le motif
- 90% des rejets sont pour une raison simple (privacy policy inaccessible, crash, permissions)
- Répond au reviewer avec des explications claires
- Resoumets après correction, 24h de review habituellement

**Quelqu'un a trouvé une faille de sécurité :**
- Corrige immédiatement
- Force la déconnexion de tous les utilisateurs si nécessaire
- Notifie les utilisateurs concernés (RGPD : obligation de notification sous 72h si fuite de données personnelles)

---

# 🎯 CONCLUSION

Ce guide représente **environ 100 à 200 heures de travail** pour une personne autonome, ou **4000 à 8000 €** si délégué à un freelance.

**Les 3 erreurs classiques à éviter absolument :**

1. **Vouloir tout perfectionner avant de publier** — Lance avec une V1 imparfaite, itère ensuite. Les retours utilisateurs valent 100 fois tes suppositions.

2. **Négliger la sécurité** — Une faille découverte après 500 utilisateurs coûte 10x plus cher qu'une prévenue. RLS, anti-fraude, backups : ce sont les fondations.

3. **Ne pas avoir de budget communication** — Même la meilleure app au monde ne décolle pas sans effort marketing. Prévois au moins 50h/mois la première année pour publier, communiquer, répondre.

**L'étape la plus critique : PHASE 1.** Si ton entreprise n'est pas en règle ou si tu ne valides pas le marché en amont, tout le reste est inutile.

**L'étape la plus technique : PHASE 3 (anti-fraude).** Ne la saute pas, elle détermine si ton modèle économique tiendra ou pas.

**L'étape la plus gratifiante : PHASE 9 (lancement).** Savoure-la, tu l'as méritée !

Bonne chance pour ton lancement TrajetPro ! 🚀

Si tu as besoin d'aide sur une étape précise, reviens me voir avec tes questions : je suis là pour t'accompagner à chaque phase.
