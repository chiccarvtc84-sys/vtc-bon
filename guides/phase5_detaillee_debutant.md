# 💳 Phase 5 détaillée pour grand débutant — Paiements Stripe

> **Pour qui ?** Toi qui as terminé les Phases 2, 3, 4.
>
> **Durée réelle :** 3 à 5 heures étalées sur 2 jours
>
> **Niveau de difficulté :** ⚠️⚠️ (moyen : beaucoup de clics dans Stripe + 1 Edge Function)
>
> **Objectif :** permettre à tes utilisateurs d'acheter des crédits par carte bancaire automatiquement, sans que tu aies à intervenir manuellement.
>
> **À la fin :** tu auras ta première source de revenus réelle.

---

## 🎓 Avant de commencer : comprendre comment Stripe fonctionne

Imagine que Stripe est un **caissier professionnel** qui travaille pour toi 24h/24.

**Le flux complet d'un achat :**

1. L'utilisateur clique "Acheter 40 crédits à 3,50€" dans ton app
2. Ton app demande à Stripe "Prépare un paiement de 3,50€"
3. Stripe génère un **formulaire de paiement sécurisé** que ton app affiche
4. L'utilisateur entre sa carte → Stripe la vérifie → paiement accepté
5. Stripe t'envoie un **webhook** (un message) : "Paiement OK pour cet utilisateur"
6. Ton backend reçoit le webhook → ajoute 40 crédits au compte
7. L'utilisateur voit son solde mis à jour

**Ce qu'on doit construire :**
- ✅ Configurer Stripe (compte + produits)
- ✅ Edge Function pour créer un "Payment Intent"
- ✅ Edge Function pour recevoir le webhook
- ✅ Brancher côté app React

**Frais Stripe en France :** 1,4% + 0,25€ par transaction européenne. Sur un pack à 3,50€, Stripe prend 0,30€, il te reste **3,20€**.

---

## 📋 Prérequis

- [ ] Phases 2, 3, 4 terminées
- [ ] Ton entreprise est en règle (SIRET, RIB pro)
- [ ] Un compte Stripe (gratuit à créer, validation Live en 1-3 jours)
- [ ] Supabase CLI installée (Phase 3)

---

## 📅 Plan d'attaque en 2 jours

**Jour 1 (2h)** — Créer le compte Stripe + configurer les produits + clés API

**Jour 2 (3h)** — Créer les 2 Edge Functions + brancher dans l'app

---

# 📆 JOUR 1 — Compte Stripe + produits (2h)

## Étape 1 — Créer ton compte Stripe

1. Va sur **`stripe.com/fr`**
2. Clique **"Commencer"** en haut à droite
3. Crée un compte avec `contact@trajetpro.fr` (PAS ton email perso)
4. Confirme ton email en cliquant sur le lien reçu
5. **Tu arrives sur le Dashboard Stripe.** Il est en **mode Test** par défaut (c'est bien pour développer).

## Étape 2 — Activer ton compte en mode Live

**En mode Test**, tu peux tout faire, mais avec des **fausses cartes**. Pour encaisser de vrai argent, il faut passer en mode **Live**.

1. En haut à droite du Dashboard Stripe, tu vois un switch **"Test mode"** (orange). Laisse-le en Test pour l'instant.

2. Clique sur **"Activer le compte"** (dans le menu de gauche ou en haut)

3. Tu vas remplir un long formulaire. Prépare :
   - **Type d'entreprise** : "Personne morale" si tu as une société, sinon "Individuel"
   - **Nom légal** : exactement comme sur ton KBIS / immatriculation
   - **Adresse** : siège social
   - **Numéro SIREN** (9 chiffres, pas le SIRET complet)
   - **RIB professionnel** (IBAN + BIC)
   - **Pièce d'identité** du représentant légal (toi) : CNI ou passeport
   - **Description de l'activité** : "Édition de logiciel de gestion pour chauffeurs VTC indépendants"
   - **Estimation de CA mensuel** : sois honnête, ex: "0-500€" au démarrage
   - **Ton site web** : `https://trajetpro.fr` (même s'il n'existe pas encore, mets l'URL prévue)

4. Envoie le formulaire. **Validation Stripe : 1-3 jours ouvrés.**

5. **En attendant**, continue en mode Test pour tout configurer.

## Étape 3 — Récupérer les clés API Test

1. Dans Stripe Dashboard, clique sur **"Développeurs"** (menu de gauche, en bas)
2. Clique sur **"Clés API"**
3. Tu vois 2 clés :
   - **Clé publique** : commence par `pk_test_...`
   - **Clé secrète** : commence par `sk_test_...` (cliquer "Révéler")
4. **Copie et sauvegarde ces 2 clés** dans ton gestionnaire de mots de passe :
   - `TrajetPro - Stripe Test Public Key`
   - `TrajetPro - Stripe Test Secret Key`

⚠️ **La Secret Key ne doit JAMAIS être dans ton code client (app).** Seulement côté backend (Edge Functions).

## Étape 4 — Créer les 4 produits dans Stripe

On va créer les 4 packs de crédits comme produits Stripe.

1. Dans Stripe Dashboard, clique **"Catalogue de produits"** (menu de gauche)
2. Clique **"+ Ajouter un produit"**

**Produit 1 : Pack Découverte**
- **Nom** : `Pack Découverte TrajetPro`
- **Description** : `20 crédits TrajetPro pour créer bons de course et factures`
- **Tarification** :
  - Modèle : **"Forfait unique"** (pas récurrent)
  - Prix : **2,00 €**
  - Devise : **EUR**
- **Métadonnées** (en bas du formulaire, clique "Ajouter une métadonnée") :
  - Key : `tokens`, Value : `20`
  - Key : `package_id`, Value : `pack20`
- Clique **"Enregistrer le produit"**

**Produit 2 : Pack Essentiel**
- Nom : `Pack Essentiel TrajetPro`
- Prix : **3,50 €**
- Métadonnées : `tokens: 40`, `package_id: pack40`

**Produit 3 : Pack Confort**
- Nom : `Pack Confort TrajetPro`
- Prix : **4,00 €**
- Métadonnées : `tokens: 50`, `package_id: pack50`

**Produit 4 : Pack Pro**
- Nom : `Pack Pro TrajetPro`
- Prix : **5,00 €**
- Métadonnées : `tokens: 80`, `package_id: pack80`

Après avoir créé les 4 produits, **note les "Price IDs"** (commencent par `price_...`). Tu peux les voir en cliquant sur chaque produit.

## Étape 5 — Ajouter les clés Stripe dans les secrets Supabase

Pour que les Edge Functions puissent utiliser Stripe, il faut leur donner accès aux clés de façon sécurisée.

1. Retourne sur **supabase.com → ton projet**
2. Menu de gauche → **"Project Settings"** (⚙️)
3. **"Edge Functions"** → **"Secrets"**
4. Clique **"Add new secret"** et ajoute :
   - **Name** : `STRIPE_SECRET_KEY`
   - **Value** : ta clé `sk_test_...` (copiée à l'étape 3)
5. Clique **"Add secret"**

Plus tard, quand ton compte passe en Live, tu remplaceras par `sk_live_...`.

**Fin du Jour 1.** 😌

---

# 📆 JOUR 2 — Edge Functions + intégration app (3h)

## Étape 6 — Créer l'Edge Function `create-payment-intent`

Cette fonction prépare le paiement côté Stripe et renvoie un "client_secret" à ton app.

1. Ouvre le Terminal, va dans `trajetpro-backend` (créé en Phase 3) :
   ```bash
   cd trajetpro-backend
   ```

2. Crée la nouvelle fonction :
   ```bash
   supabase functions new create-payment-intent
   ```

3. Ouvre VS Code → `supabase/functions/create-payment-intent/index.ts`

4. Efface tout et colle :

```typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-11-20.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const PACKAGES: Record<string, { tokens: number; amount: number; label: string }> = {
  pack20: { tokens: 20, amount: 200, label: "Pack Découverte" },
  pack40: { tokens: 40, amount: 350, label: "Pack Essentiel" },
  pack50: { tokens: 50, amount: 400, label: "Pack Confort" },
  pack80: { tokens: 80, amount: 500, label: "Pack Pro" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Vérifier l'authentification de l'utilisateur
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (!user || userError) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const { package_id, vat_intra } = await req.json();
    const pack = PACKAGES[package_id];
    if (!pack) {
      return new Response(
        JSON.stringify({ error: "Invalid package" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Calcul TVA
    const applyReverseCharge = vat_intra && !vat_intra.toUpperCase().startsWith("FR");
    const finalAmount = applyReverseCharge
      ? Math.round(pack.amount / 1.2) // HT pour intra-EU hors FR
      : pack.amount;

    // Créer le Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmount,
      currency: "eur",
      automatic_payment_methods: { enabled: true },
      metadata: {
        user_id: user.id,
        package_id,
        tokens: pack.tokens.toString(),
        vat_intra: vat_intra || "",
        reverse_charge: applyReverseCharge ? "true" : "false",
      },
      description: `${pack.label} - ${pack.tokens} crédits TrajetPro`,
    });

    return new Response(
      JSON.stringify({
        client_secret: paymentIntent.client_secret,
        amount: finalAmount,
        tokens: pack.tokens,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
```

5. Sauvegarde (Ctrl+S).

6. Déploie :
   ```bash
   supabase functions deploy create-payment-intent
   ```

7. ✅ Tu dois voir "Deployed Functions on project XXXXX: create-payment-intent"

## Étape 7 — Créer l'Edge Function `stripe-webhook`

Cette fonction reçoit les notifications de Stripe quand un paiement réussit.

1. Dans le Terminal :
   ```bash
   supabase functions new stripe-webhook
   ```

2. VS Code → `supabase/functions/stripe-webhook/index.ts`

3. Efface et colle :

```typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-11-20.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  const body = await req.text();
  let event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
      undefined,
      cryptoProvider
    );
  } catch (err) {
    console.error("Invalid signature:", err.message);
    return new Response(`Webhook error: ${err.message}`, { status: 400 });
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const userId = intent.metadata.user_id;
      const tokens = parseInt(intent.metadata.tokens);
      const packageId = intent.metadata.package_id;
      const vatIntra = intent.metadata.vat_intra;
      const reverseCharge = intent.metadata.reverse_charge === "true";

      if (!userId || !tokens) {
        console.error("Missing metadata");
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // Générer le numéro de facture
      const { data: count } = await supabase
        .from('token_transactions')
        .select('id', { count: 'exact' })
        .eq('kind', 'purchase');

      const invoiceNum = `TRP-2026-${String((count?.length || 0) + 1).padStart(4, '0')}`;
      const amountTTC = intent.amount / 100;
      const amountHT = reverseCharge ? amountTTC : +(amountTTC / 1.2).toFixed(2);
      const amountVAT = reverseCharge ? 0 : +(amountTTC - amountHT).toFixed(2);

      // Créditer les tokens via RPC
      await supabase.rpc("credit_token_purchase", {
        p_user_id: userId,
        p_tokens: tokens,
        p_amount_ttc: amountTTC,
        p_package_id: packageId,
        p_stripe_intent_id: intent.id,
      });

      // Mettre à jour la transaction avec plus d'infos
      await supabase
        .from('token_transactions')
        .update({
          invoice_number: invoiceNum,
          amount_ht: amountHT,
          amount_vat: amountVAT,
          vat_applied: !reverseCharge,
          vat_intra: vatIntra,
          payment_method: "Carte bancaire",
        })
        .eq('stripe_payment_intent_id', intent.id);

      console.log(`Credited ${tokens} tokens to user ${userId}`);
    } else if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as Stripe.PaymentIntent;
      console.log(`Payment failed for user ${intent.metadata.user_id}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Error processing webhook:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
```

4. Sauvegarde et déploie **sans vérification JWT** (car le webhook vient de Stripe, pas d'un utilisateur connecté) :
   ```bash
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```

## Étape 8 — Configurer le webhook dans Stripe

1. Dans Stripe Dashboard → **Développeurs** → **Webhooks**
2. Clique **"+ Ajouter un endpoint"**
3. **URL du endpoint** : `https://XXXXX.supabase.co/functions/v1/stripe-webhook`
   - Remplace `XXXXX` par l'identifiant de ton projet Supabase
4. **Événements à écouter** : coche :
   - ✅ `payment_intent.succeeded`
   - ✅ `payment_intent.payment_failed`
5. Clique **"Ajouter l'endpoint"**
6. Sur la page qui s'ouvre, tu vois **"Secret de signature"** : clique "Révéler" et copie
7. Retourne sur Supabase → Project Settings → Edge Functions → Secrets → Ajoute :
   - Name : `STRIPE_WEBHOOK_SECRET`
   - Value : le secret `whsec_...`
8. Clique **"Add secret"**

## Étape 9 — Installer Stripe dans l'app React

1. Retourne dans le dossier de ton app React (`trajetpro-app`)
2. Installe Stripe :
   ```bash
   npm install @stripe/stripe-js
   ```

3. Ajoute la clé publique Stripe dans `.env` :
   ```
   VITE_STRIPE_PUBLIC_KEY=pk_test_...
   ```
   (Ta clé publique, PAS la secrète !)

## Étape 10 — Modifier la fonction d'achat de crédits dans App.jsx

1. Ouvre `src/App.jsx` dans VS Code
2. En haut, ajoute l'import :
   ```javascript
   import { loadStripe } from '@stripe/stripe-js';
   ```

3. Après les imports, ajoute :
   ```javascript
   const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);
   ```

4. Cherche le composant `PurchaseModal` (autour de la ligne 1540)

5. Dans ce composant, cherche la fonction `handleConfirm` et **remplace-la** par :

```javascript
const handleConfirm = async () => {
  setLoading(true);
  try {
    // 1. Demander à Supabase de créer un Payment Intent
    const { data, error } = await supabase.functions.invoke('create-payment-intent', {
      body: {
        package_id: pack.id,
        vat_intra: showVatField ? vatIntra : null,
      },
    });

    if (error) {
      alert("Erreur : " + error.message);
      setLoading(false);
      return;
    }

    const { client_secret } = data;
    const stripe = await stripePromise;

    // 2. Ouvrir le formulaire de paiement Stripe
    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      clientSecret: client_secret,
      confirmParams: {
        return_url: window.location.origin + '/purchase-success',
      },
      redirect: 'if_required',
    });

    if (stripeError) {
      alert("Paiement échoué : " + stripeError.message);
      setLoading(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === 'succeeded') {
      // 3. Attendre 2-3 secondes que le webhook crédite les tokens
      setTimeout(async () => {
        // Rafraîchir le solde
        const profile = await getCurrentUser();
        if (profile) {
          setResult({
            tokens: pack.tokens,
            priceTTC: paymentIntent.amount / 100,
            invoiceNumber: `TRP-2026-XXXX`,
            paymentMethod: "Carte bancaire",
            package: pack.label,
          });
          setStep("success");
          onConfirm({
            tokens: pack.tokens,
            newBalance: profile.token_balance,
          });
        }
        setLoading(false);
      }, 3000);
    }
  } catch (err) {
    alert("Erreur technique : " + err.message);
    setLoading(false);
  }
};
```

## Étape 11 — Tester en mode Test

1. Sauvegarde tous les fichiers
2. Relance ton app :
   ```bash
   npm run dev
   ```

3. Connecte-toi à ton app avec un compte de test
4. Va dans Profil → Gérer mes jetons → Acheter des jetons
5. Choisis le Pack Essentiel à 3,50€
6. Clique "Payer"
7. Stripe affiche un formulaire de paiement

8. **Utilise la carte de test Stripe** :
   - Numéro : `4242 4242 4242 4242`
   - Date : n'importe quelle date future (ex : 12/30)
   - CVC : n'importe quel 3 chiffres (ex : 123)
   - Code postal : `75001`

9. Clique "Payer"

10. **Attends 3-5 secondes.** Le paiement se traite.

11. **Vérifications :**
    - [ ] Tu reçois l'écran de confirmation
    - [ ] Ton solde a augmenté de +40 crédits
    - [ ] Dans Stripe Dashboard → Paiements, tu vois le paiement à 3,50€
    - [ ] Dans Supabase → table `token_transactions`, tu vois une entrée avec `kind: purchase`

**Si tout ça marche : tu as un système de paiement fonctionnel !** 💰🎉

## Étape 12 — Tester les cas d'échec

Pour être sûr que ton app gère bien les problèmes, teste aussi :

**Paiement refusé :**
- Carte : `4000 0000 0000 0002`
- Doit afficher "Votre carte a été refusée"

**3D Secure requis (authentification forte) :**
- Carte : `4000 0025 0000 3155`
- Stripe demande une authentification 3DS → l'utilisateur doit valider

**Fonds insuffisants :**
- Carte : `4000 0000 0000 9995`
- Doit afficher une erreur appropriée

---

## Étape 13 — Passer en mode Live (quand tu es prêt)

**À faire SEULEMENT quand tu es prêt à encaisser de vraies cartes :**

1. **Attendre la validation de ton compte Stripe** (étape 2, peut prendre 1-3 jours)

2. Dans Stripe Dashboard, bascule le switch **"Test mode"** en **"Live mode"** (orange → blanc)

3. Dans Développeurs → Clés API, **récupère les clés Live** (commencent par `sk_live_...` et `pk_live_...`)

4. **Recrée les 4 produits en mode Live** (étape 4)

5. **Recrée le webhook en mode Live** (étape 8) avec la même URL

6. **Mets à jour les secrets Supabase** :
   - `STRIPE_SECRET_KEY` → nouvelle clé `sk_live_...`
   - `STRIPE_WEBHOOK_SECRET` → nouveau secret `whsec_...`

7. **Mets à jour le fichier `.env` de l'app** :
   ```
   VITE_STRIPE_PUBLIC_KEY=pk_live_...
   ```

8. Fais un paiement test avec ta vraie carte, 2€, pour valider que tout marche.

9. **Rembourse-toi** depuis Stripe Dashboard (paiement → Rembourser).

**Ton système de paiement est LIVE.** Quand un utilisateur paie, tu touches l'argent sur ton compte bancaire sous 7 jours ouvrés.

---

## 🚨 Dépannage

### "Le webhook ne se déclenche pas"

1. Dans Stripe Dashboard → Webhooks → ton endpoint → onglet **"Tentatives"**
2. Tu vois les tentatives, avec succès ou échec
3. Clique sur une tentative pour voir la réponse du serveur

**Erreurs courantes :**
- **401 Unauthorized** : tu as oublié `--no-verify-jwt` au déploiement. Redéploie avec cette option.
- **400 Bad Request - Signature** : le `STRIPE_WEBHOOK_SECRET` est mauvais. Retourne à l'étape 8 et copie le bon secret.

### "L'utilisateur paie mais ne reçoit pas les crédits"

1. Va sur Supabase → Edge Functions → stripe-webhook → **Logs**
2. Cherche les erreurs dans le log
3. Vérifie que la fonction SQL `credit_token_purchase` existe (elle a été créée en Phase 2)

### "Le formulaire de paiement ne s'affiche pas"

- Vérifie ta `VITE_STRIPE_PUBLIC_KEY` dans `.env`
- Ouvre la console du navigateur (F12) → onglet Console → regarde les erreurs

---

## 🎓 Ce que tu as appris

- **Comprendre comment fonctionne un système de paiement en ligne**
- **Créer et gérer un compte Stripe professionnel**
- **Utiliser les webhooks** (concept fondamental du développement)
- **Sécuriser des clés API** avec les secrets Supabase
- **Tester des paiements en mode Test**

**Phase 5 terminée. Tu peux maintenant encaisser des paiements automatiquement !** 💰

**Prochaine étape : la Phase 6, le build mobile — l'étape la plus technique du projet.**
