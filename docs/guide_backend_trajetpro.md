# 🏗️ Guide technique backend TrajetPro

> Ce guide te permet (ou à un développeur freelance) de **brancher un vrai backend** à l'app. Sans ça, comptes, crédits, synchronisation et anti-fraude ne fonctionnent pas réellement.
>
> **Budget réaliste :** 0-25 €/mois pour les 1000 premiers utilisateurs, puis environ 30-80 €/mois ensuite.
> **Temps de mise en œuvre :** 3 à 6 semaines pour un développeur junior, 1 à 2 semaines pour un senior.

---

## 1. 🎯 Choix de la stack

### Ma recommandation : **Supabase**

**Pourquoi Supabase plutôt que Firebase ?**
- Base de données PostgreSQL (standard, exportable, rien de propriétaire)
- Auth gérée nativement (email, SMS, magic link, OAuth)
- Edge Functions en TypeScript (moins d'apprentissage que Firebase)
- Gratuit jusqu'à 50 000 utilisateurs actifs mensuels
- Hébergement européen possible (RGPD)
- Dashboard simple, adapté aux non-développeurs
- Export SQL facile si tu changes un jour

**Alternative** : Firebase (Google) si tu préfères l'écosystème Google, ou un backend custom Node.js + PostgreSQL si tu veux tout contrôler.

### Services tiers nécessaires

| Service | Usage | Coût |
|---------|-------|------|
| **Supabase** | Base de données + Auth + Fonctions | Gratuit → 25 €/mois |
| **Stripe** | Paiements des jetons | 1,4% + 0,25 €/transaction (Europe) |
| **Twilio** ou **OVH SMS** | Vérification SMS à l'inscription | ~0,08 €/SMS |
| **api.insee.fr** | Validation SIRET | Gratuit |
| **Apple DeviceCheck** | Anti-fraude iOS | Gratuit (compte dev Apple) |
| **Google Play Integrity** | Anti-fraude Android | Gratuit |
| **Resend** ou **Mailgun** | Envoi d'emails transactionnels | Gratuit jusqu'à 3000/mois |
| **Sentry** | Monitoring erreurs | Gratuit jusqu'à 5k événements |

**Coût estimé par mois (1000 utilisateurs actifs) : 25-40 €**

---

## 2. 🗄️ Schéma de base de données

Voici le schéma PostgreSQL complet à créer dans Supabase. Copie ces requêtes dans l'éditeur SQL Supabase :

### Table `users` (complémentaire à `auth.users` de Supabase)

```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT UNIQUE,
  siret TEXT UNIQUE,
  evtc_number TEXT UNIQUE,
  company_name TEXT,
  vehicle_model TEXT,
  vehicle_plate TEXT,
  pro_card_number TEXT,
  iban TEXT,
  vat_intra TEXT,

  -- Système de parrainage
  referral_code TEXT UNIQUE NOT NULL,
  referred_by UUID REFERENCES public.users(id),

  -- Anti-fraude
  phone_verified BOOLEAN DEFAULT false,
  email_verified BOOLEAN DEFAULT false,
  siret_verified BOOLEAN DEFAULT false,
  evtc_verified BOOLEAN DEFAULT false,
  device_fingerprint TEXT,
  device_check_token TEXT, -- Apple DeviceCheck bits
  play_integrity_token TEXT, -- Android Play Integrity
  last_known_ip TEXT,
  risk_score INTEGER DEFAULT 0,
  flagged BOOLEAN DEFAULT false,
  flagged_reason TEXT,

  -- Crédits
  token_balance INTEGER DEFAULT 0,
  last_monthly_bonus DATE,

  -- Préférences
  preferences JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_phone ON public.users(phone);
CREATE INDEX idx_users_siret ON public.users(siret);
CREATE INDEX idx_users_referral_code ON public.users(referral_code);
CREATE INDEX idx_users_device_fingerprint ON public.users(device_fingerprint);
```

### Table `bookings` (bons de course)

```sql
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  pickup_address TEXT NOT NULL,
  dropoff_address TEXT NOT NULL,
  pickup_datetime TIMESTAMP WITH TIME ZONE NOT NULL,

  passengers INTEGER DEFAULT 1,
  has_luggage BOOLEAN DEFAULT false,
  distance_km DECIMAL(6,2),
  duration_min INTEGER,
  price_ttc DECIMAL(8,2) NOT NULL,
  notes TEXT,
  type TEXT DEFAULT 'forfait',
  status TEXT DEFAULT 'confirmed',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX idx_bookings_pickup_datetime ON public.bookings(pickup_datetime);
```

### Table `invoices` (factures VTC)

```sql
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id),

  invoice_number TEXT UNIQUE NOT NULL, -- FAC-2026-0001
  customer_name TEXT NOT NULL,
  amount_ht DECIMAL(8,2) NOT NULL,
  amount_vat DECIMAL(8,2) NOT NULL,
  amount_ttc DECIMAL(8,2) NOT NULL,
  vat_rate DECIMAL(4,2) NOT NULL,

  status TEXT DEFAULT 'pending', -- pending | paid | cancelled
  fingerprint TEXT NOT NULL, -- empreinte fiscale (obligatoire)
  paid_at TIMESTAMP WITH TIME ZONE,

  issued_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX idx_invoices_invoice_number ON public.invoices(invoice_number);
```

### Table `token_transactions` (historique crédits)

```sql
CREATE TABLE public.token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  kind TEXT NOT NULL, -- purchase | welcome | monthly_bonus | referral_bonus | consume_booking | consume_invoice | refund
  tokens_delta INTEGER NOT NULL, -- positif ou négatif

  -- Pour les achats
  package_id TEXT,
  invoice_number TEXT, -- TRP-2026-0001
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

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_token_transactions_user_id ON public.token_transactions(user_id);
CREATE INDEX idx_token_transactions_kind ON public.token_transactions(kind);
```

### Table `device_fingerprints` (appareils connus anti-fraude)

```sql
CREATE TABLE public.device_fingerprints (
  fingerprint TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  device_check_token TEXT, -- Apple DeviceCheck
  play_integrity_token TEXT, -- Google Play
  first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accounts_count INTEGER DEFAULT 1,
  blocked BOOLEAN DEFAULT false
);
```

### Table `verification_codes` (codes SMS/email temporaires)

```sql
CREATE TABLE public.verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target TEXT NOT NULL, -- numéro de téléphone ou email
  kind TEXT NOT NULL, -- sms | email
  code_hash TEXT NOT NULL, -- JAMAIS le code en clair, toujours hashé
  attempts INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_verif_target ON public.verification_codes(target);
```

### Row Level Security (RLS)

**C'est critique** : par défaut, chaque utilisateur ne doit voir que ses propres données.

```sql
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can CRUD their own bookings" ON public.bookings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD their own invoices" ON public.invoices
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can read their own transactions" ON public.token_transactions
  FOR SELECT USING (auth.uid() = user_id);
```

---

## 3. 🔐 Flux d'authentification

### Inscription (par étapes)

```
1. User → POST /auth/signup-start
   { email, password, name, siret, phone, device_fingerprint, referral_code? }
   → Serveur :
     - Vérifie que email/phone/siret/fingerprint ne sont pas déjà utilisés
     - Vérifie SIRET via API INSEE
     - Génère et envoie code SMS (Twilio)
     - Renvoie un verification_token temporaire
   ← { verification_token, masked_phone }

2. User → POST /auth/signup-verify-sms
   { verification_token, sms_code }
   → Serveur :
     - Vérifie que le code correspond (avec nb de tentatives)
   ← { ok: true }

3. User → POST /auth/signup-complete
   { verification_token, device_check_token, play_integrity_token }
   → Serveur :
     - Crée le compte auth.users + public.users
     - Valide DeviceCheck/Play Integrity côté Apple/Google
     - Crédite 5 crédits de bienvenue
     - Si referral_code valide : crédite +5 au filleul, +10 au parrain
     - Enregistre le fingerprint dans device_fingerprints
     - Envoie email de bienvenue
   ← { jwt_token, user }
```

### Connexion

```
User → POST /auth/login
  { email, password, device_fingerprint }
→ Serveur :
  - Vérifie password (bcrypt/argon2)
  - Vérifie que le fingerprint correspond au compte (sinon alerte + SMS)
  - Attribue le bonus mensuel si dû
← { jwt_token, user }
```

### Fichier `.env` à configurer

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ... (secret, jamais côté client)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+33...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
INSEE_API_KEY=... (optionnel si via data.gouv.fr)
APPLE_DEVICECHECK_KEY_ID=...
APPLE_TEAM_ID=...
GOOGLE_PLAY_INTEGRITY_DECODE_KEY=...
```

---

## 4. ⚡ Edge Functions à créer dans Supabase

Les Edge Functions sont des fonctions serveur écrites en TypeScript/Deno. À déployer via Supabase CLI.

### `verify-siret.ts` — Valide un SIRET via INSEE

```typescript
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  const { siret } = await req.json();

  // Nettoyer le SIRET
  const clean = siret.replace(/\s/g, "");
  if (!/^\d{14}$/.test(clean)) {
    return new Response(JSON.stringify({ valid: false, reason: "Format invalide" }));
  }

  // Appel à l'API gratuite recherche-entreprises.data.gouv.fr
  const response = await fetch(
    `https://recherche-entreprises.api.gouv.fr/search?q=${clean}&per_page=1`
  );
  const data = await response.json();

  if (data.total_results === 0) {
    return new Response(JSON.stringify({ valid: false, reason: "SIRET inconnu" }));
  }

  const entity = data.results[0];
  const matiere = entity?.activite_principale || "";

  // Vérifier que le code APE correspond à une activité VTC
  // 49.32Z = Transport de voyageurs par taxis (VTC inclus)
  const isVTC = matiere.startsWith("49.32") || matiere.startsWith("49.39");

  return new Response(JSON.stringify({
    valid: true,
    company_name: entity.nom_complet,
    is_vtc: isVTC,
    address: entity.siege?.adresse,
  }));
});
```

### `send-sms-code.ts` — Envoie code SMS via Twilio

```typescript
import { serve } from "https://deno.land/std/http/server.ts";
import { createHash } from "https://deno.land/std/crypto/mod.ts";

const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER")!;

serve(async (req) => {
  const { phone } = await req.json();

  // Rate limit : max 3 SMS/heure par numéro
  // (À implémenter via table supabase rate_limits)

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await hashString(code);

  // Enregistrer dans DB
  await supabase.from("verification_codes").insert({
    target: phone,
    kind: "sms",
    code_hash: codeHash,
    expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 min
  });

  // Envoyer SMS via Twilio
  const twilioRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phone,
        From: TWILIO_FROM,
        Body: `Votre code TrajetPro : ${code}. Valable 10 minutes.`,
      }),
    }
  );

  return new Response(JSON.stringify({ ok: twilioRes.ok }));
});
```

### `grant-monthly-bonus.ts` — Cron mensuel

À déclencher automatiquement le 1er de chaque mois via Supabase Scheduled Functions ou un cron GitHub Actions.

```typescript
import { serve } from "https://deno.land/std/http/server.ts";

serve(async () => {
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Récupérer tous les users qui n'ont pas encore eu leur bonus ce mois-ci
  const { data: users } = await supabase
    .from("users")
    .select("id")
    .lt("last_monthly_bonus", `${currentMonth}-01`);

  for (const user of users) {
    await supabase.rpc("credit_monthly_bonus", { user_id: user.id });
  }

  return new Response(JSON.stringify({ granted: users.length }));
});
```

Le RPC `credit_monthly_bonus` est une fonction SQL à créer :

```sql
CREATE OR REPLACE FUNCTION credit_monthly_bonus(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.users
    SET token_balance = token_balance + 1,
        last_monthly_bonus = CURRENT_DATE
    WHERE id = user_id;

  INSERT INTO public.token_transactions (user_id, kind, tokens_delta, amount_ttc)
    VALUES (user_id, 'monthly_bonus', 1, 0);
END;
$$ LANGUAGE plpgsql;
```

### `process-referral.ts` — Crédite parrain + filleul

Déclenché après inscription validée avec code parrainage.

```typescript
serve(async (req) => {
  const { new_user_id, referral_code } = await req.json();

  // Trouver le parrain
  const { data: referrer } = await supabase
    .from("users")
    .select("id, flagged")
    .eq("referral_code", referral_code)
    .single();

  if (!referrer || referrer.flagged) {
    return new Response(JSON.stringify({ ok: false }));
  }

  // Vérif anti-fraude : parrain != filleul, pas déjà parrainé, pas le même device
  const { data: sameDevice } = await supabase
    .from("users")
    .select("id")
    .eq("device_fingerprint", newUserDevice)
    .eq("id", referrer.id);

  if (sameDevice.length > 0) {
    // Même appareil → fraude probable
    await supabase.from("users").update({ flagged: true, flagged_reason: "Referral same device" })
      .eq("id", new_user_id);
    return new Response(JSON.stringify({ ok: false, reason: "fraud_detected" }));
  }

  // Créditer
  await supabase.rpc("credit_referral_bonus", {
    referrer_id: referrer.id,
    referee_id: new_user_id,
    referrer_tokens: 10,
    referee_tokens: 5,
  });

  return new Response(JSON.stringify({ ok: true }));
});
```

### `stripe-webhook.ts` — Confirmation de paiement

Déclenché automatiquement par Stripe après paiement réussi.

```typescript
import Stripe from "https://esm.sh/stripe";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

serve(async (req) => {
  const signature = req.headers.get("stripe-signature")!;
  const body = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return new Response("Webhook signature invalid", { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;
    const userId = intent.metadata.user_id;
    const tokens = parseInt(intent.metadata.tokens);
    const packageId = intent.metadata.package_id;

    // Créditer les tokens
    await supabase.rpc("credit_token_purchase", {
      user_id: userId,
      tokens,
      amount_ttc: intent.amount / 100,
      package_id: packageId,
      stripe_intent_id: intent.id,
    });

    // Générer facture
    await generateInvoicePDF(userId, intent);
  }

  return new Response(JSON.stringify({ received: true }));
});
```

---

## 5. 💳 Intégration Stripe pour les paiements

### Étape 1 — Créer un compte Stripe

- Inscription sur stripe.com (gratuit, sans abonnement)
- Activer l'entreprise (RIB, pièce d'identité, SIRET)
- Récupérer les clés API (test + live)

### Étape 2 — Créer les produits Stripe

```
4 produits à créer dans le dashboard Stripe :
- Pack Découverte : 2,00 € pour 20 crédits
- Pack Essentiel  : 3,50 € pour 40 crédits
- Pack Confort    : 4,00 € pour 50 crédits
- Pack Pro        : 5,00 € pour 80 crédits
```

### Étape 3 — Côté client (app mobile)

```javascript
// Dans le PurchaseModal
const response = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-intent`, {
  method: "POST",
  headers: { Authorization: `Bearer ${jwt}` },
  body: JSON.stringify({ package_id: "pack40" }),
});
const { client_secret } = await response.json();

// Utiliser @stripe/stripe-react-native pour afficher le Payment Sheet
const { error } = await presentPaymentSheet({ clientSecret: client_secret });
if (!error) {
  // Le webhook créditera les tokens automatiquement
  // On rafraîchit le solde
  await refreshTokenBalance();
}
```

### Frais Stripe réalistes

**Europe (carte française) :** 1,4% + 0,25 €
- Pack 2 € : Stripe garde 0,28 € → tu touches **1,72 €** (soit **0,086 €/crédit** encaissé)
- Pack 3,50 € : Stripe garde 0,30 € → tu touches **3,20 €**
- Pack 5 € : Stripe garde 0,32 € → tu touches **4,68 €**

**Attention :** pour les achats in-app iOS/Android, **Apple et Google prennent 15-30%** de commission. Si tu vends en In-App Purchase, tes 5 € deviennent 3,50 € (hors TVA). Pour garder Stripe sans commission Apple/Google, les achats doivent passer **via un site web externe** (pas via l'app iOS/Android directement).

---

## 6. 🛡️ Anti-fraude — Implémentation détaillée

### Apple DeviceCheck (iOS)

DeviceCheck donne 2 bits de state par appareil qui persistent même après désinstallation. C'est **la** pièce maîtresse pour empêcher la réinstallation abusive.

**Setup :**
1. Générer une clé DeviceCheck dans Apple Developer Portal
2. Dans ton Edge Function, faire un appel à l'API Apple :

```typescript
// À l'inscription, stocker un "bit" = cet appareil a déjà reçu son bonus
await fetch("https://api.devicecheck.apple.com/v1/update_two_bits", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${appleJwt}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    device_token: clientDeviceToken,
    bit0: true, // bit personnalisé : déjà reçu crédits bienvenue
    bit1: false,
    timestamp: Date.now(),
  }),
});

// À la prochaine inscription, vérifier si bit0 = true → rejeter
```

### Google Play Integrity (Android)

Similaire côté Android. Plus complexe à intégrer mais incontournable.

### Limitations IP

```typescript
// Avant de créer un compte, vérifier que l'IP n'a pas déjà 3 comptes
const { count } = await supabase.from("users")
  .select("id", { count: "exact" })
  .eq("last_known_ip", clientIP);

if (count >= 3) {
  return new Response(JSON.stringify({ error: "Too many accounts from this network" }));
}
```

### Blacklist emails jetables

Utiliser la liste de https://github.com/disposable-email-domains/disposable-email-domains (mise à jour régulièrement). À synchroniser mensuellement dans une table Supabase.

---

## 7. 📱 Connexion côté app React/Capacitor

### Installation des SDK

```bash
npm install @supabase/supabase-js
npm install @capacitor/device # pour device fingerprint
npm install @stripe/stripe-react-native
```

### Client Supabase

```javascript
// src/lib/supabase.js
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://xxxx.supabase.co",
  "eyJ...", // anon key (pas service_role !)
  {
    auth: {
      persistSession: true, // garde la session entre ouvertures d'app
      storage: localStorage, // ou Capacitor Preferences
    },
  }
);
```

### Hook useAuth

```javascript
// src/hooks/useAuth.js
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useAuth() {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadUserProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadUserProfile(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId) => {
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();
    setUser(data);
  };

  return { session, user, loading };
}
```

### Remplacer `useState` par la DB

Dans l'app actuelle, les données sont en React state. À remplacer par Supabase :

```javascript
// AVANT (prototype)
const [bookings, setBookings] = useState(INITIAL_BOOKINGS);

// APRÈS (production)
const [bookings, setBookings] = useState([]);

useEffect(() => {
  supabase.from("bookings").select("*")
    .eq("user_id", user.id)
    .order("pickup_datetime")
    .then(({ data }) => setBookings(data));
}, [user]);

// Insertion
const onSaveBooking = async (b) => {
  const { data } = await supabase.from("bookings").insert(b).select();
  setBookings(prev => [data[0], ...prev]);
  // Décrémenter tokens via RPC
  await supabase.rpc("consume_tokens", { user_id: user.id, amount: 1, kind: "booking" });
};
```

---

## 8. 🚀 Déploiement étape par étape

### Semaine 1 — Setup
- [ ] Créer compte Supabase, projet EU (Paris recommandé)
- [ ] Exécuter les scripts SQL du schéma
- [ ] Configurer RLS
- [ ] Créer compte Stripe (activation entreprise)
- [ ] Créer compte Twilio (numéro français ~1 €/mois)

### Semaine 2 — Auth et CRUD de base
- [ ] Brancher auth Supabase dans SignupScreen
- [ ] Connecter BookingsScreen/InvoicesScreen à la DB
- [ ] Tester création/modification/suppression

### Semaine 3 — Anti-fraude
- [ ] Edge function verify-siret
- [ ] Edge function send-sms-code
- [ ] Intégration Apple DeviceCheck
- [ ] Intégration Google Play Integrity
- [ ] Tests de contournement

### Semaine 4 — Paiements
- [ ] Edge function create-payment-intent
- [ ] Edge function stripe-webhook
- [ ] Branchement Stripe Payment Sheet
- [ ] Tests en mode test Stripe puis live

### Semaine 5 — Parrainage + bonus mensuel
- [ ] Edge function process-referral
- [ ] Scheduled function grant-monthly-bonus
- [ ] Tests end-to-end

### Semaine 6 — Finitions
- [ ] Emails transactionnels (Resend)
- [ ] Monitoring Sentry
- [ ] Tests sur vrais appareils iOS + Android
- [ ] Recette générale

---

## 9. ✅ Checklist de sécurité avant lancement

- [ ] Toutes les tables ont RLS activée
- [ ] Les clés `service_role` ne sont JAMAIS côté client
- [ ] Les mots de passe sont hashés (bcrypt via Supabase Auth, pas en clair)
- [ ] Les codes SMS sont hashés en DB (pas le code brut)
- [ ] Les webhooks Stripe vérifient la signature
- [ ] Rate limiting en place sur auth/signup (max 5 tentatives/heure par IP)
- [ ] Les JWT ont une durée de vie limitée (1h) avec refresh tokens
- [ ] Les données personnelles sensibles (téléphone, SIRET) sont accessibles en lecture uniquement au propriétaire
- [ ] Déclaration CNIL si nécessaire (à vérifier selon volume)
- [ ] Export et suppression de données implémentés (droits RGPD)
- [ ] Backups automatiques activés dans Supabase (inclus en plan payant)

---

## 10. 💰 Budget annuel réaliste

### Pour 1000 utilisateurs actifs

| Poste | Mensuel | Annuel |
|-------|---------|--------|
| Supabase Pro | 25 € | 300 € |
| Apple Developer | - | 99 € |
| Google Play Developer | - | 25 € (paiement unique) |
| Twilio (3000 SMS) | 24 € | 288 € |
| Stripe (sur 2000 € CA) | 28 € | 336 € |
| Resend (emails) | 0 € | 0 € |
| Sentry | 0 € | 0 € |
| Domaine + site vitrine | 1 € | 12 € |
| **TOTAL** | **~78 €** | **~1 060 €** |

### Revenus potentiels

Si 1000 utilisateurs actifs achètent en moyenne 3 packs de 40 crédits par an :
- **Chiffre d'affaires : 10 500 € / an**
- **Frais : 1 060 €**
- **Marge brute : 9 440 €**

Ça devient vraiment rentable à partir de 500 utilisateurs actifs.

---

## 11. 🤝 Brief pour un développeur freelance

Si tu délègues, envoie-lui ce document + les exigences suivantes :

```
BRIEF : Backend TrajetPro
Tech requise : Supabase, Stripe, Twilio, TypeScript (Deno Edge Functions)
Durée : 4-6 semaines
Livrables :
  - Toutes les tables et RLS déployées
  - 6 Edge Functions fonctionnelles (voir §4)
  - Intégration client React/Capacitor dans l'app existante
  - Documentation des endpoints
  - Tests unitaires sur les fonctions critiques
  - Déploiement en production avec monitoring
Budget cible : 4 000 € à 8 000 € selon séniorité
Où chercher : Malt.fr (France), Upwork (international)
Profils à chercher : "Supabase" + "Stripe" + "React Native"
```

---

## 📞 Pour aller plus loin

**Documentation à lire absolument :**
- Supabase : https://supabase.com/docs
- Stripe : https://stripe.com/docs/payments
- Twilio Verify : https://www.twilio.com/docs/verify
- Apple DeviceCheck : https://developer.apple.com/documentation/devicecheck
- Play Integrity : https://developer.android.com/google/play/integrity

**Communautés pour obtenir de l'aide :**
- Discord Supabase (très actif)
- Stack Overflow (tag supabase)
- r/Supabase sur Reddit

**En dernier recours :** ping les supports Supabase et Stripe — ils répondent bien, même sur les plans gratuits.

---

**Bonne chance pour le lancement ! 🚀**

Ce guide représente environ **3 à 6 semaines** de travail technique. C'est l'investissement le plus rentable que tu puisses faire sur l'app : sans backend, pas de comptes, pas de crédits, pas de paiements, pas d'anti-fraude. Avec, ton prototype devient un vrai produit commercialisable.
