// ============================================================================
// EDGE FUNCTION : revenuecat-webhook
// ============================================================================
// Reçoit les événements RevenueCat (achats In-App Purchase Apple, natifs iOS).
// Quand un achat de pack de jetons est confirmé, on crédite les tokens du
// user concerné via la RPC `credit_token_purchase_iap` (idempotente — anti
// double crédit grâce à revenuecat_transaction_id) et on génère une facture
// conforme CGI, exactement comme pour les achats Stripe (stripe-webhook).
//
// Pourquoi RevenueCat plutôt qu'une vérification maison des reçus Apple :
// RevenueCat valide lui-même l'achat auprès d'Apple (App Store Server API)
// et ne nous notifie qu'une fois l'achat confirmé authentique — on évite
// d'avoir à gérer nous-mêmes les JWS/clé .p8 sur la partie la plus sensible
// (l'argent).
//
// Sécurité :
//   - Pas de JWT (RevenueCat appelle l'URL publique).
//   - RevenueCat n'utilise pas de signature HMAC comme Stripe : on vérifie
//     un simple header `Authorization: Bearer <secret>` configuré à
//     l'identique des deux côtés (dashboard RevenueCat + secret Supabase).
//   - Toute requête sans le bon header est rejetée 401.
//
// Variables d'env attendues :
//   - REVENUECAT_WEBHOOK_SECRET
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY (pour bypass RLS et écrire dans token_transactions)
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Catalogue figé côté serveur — mappe le product_id App Store (déclaré dans
// App Store Connect + RevenueCat) vers le nombre de jetons. Doit rester
// synchronisé avec TOKEN_PACKAGES côté React et PACKAGES dans
// create-payment-intent/create-checkout-session.
const PACKAGES: Record<string, { tokens: number; label: string }> = {
  "com.trajetpro.app.pack20": { tokens: 20, label: "Pack Découverte" },
  "com.trajetpro.app.pack40": { tokens: 40, label: "Pack Essentiel" },
  "com.trajetpro.app.pack50": { tokens: 50, label: "Pack Confort" },
  "com.trajetpro.app.pack80": { tokens: 80, label: "Pack Pro" },
};

// Types d'événements RevenueCat correspondant à un achat consommable unique
// (nos jetons ne sont pas un abonnement). RENEWAL/CANCELLATION/EXPIRATION/
// BILLING_ISSUE etc. ne s'appliquent pas et sont ignorés.
const PURCHASE_EVENT_TYPES = new Set(["INITIAL_PURCHASE", "NON_RENEWING_PURCHASE"]);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    console.error("Configuration manquante");
    return new Response("Configuration manquante", { status: 500 });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${webhookSecret}`) {
    console.error("Authorization header invalide ou manquant");
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { event?: RevenueCatEvent };
  try {
    body = await req.json();
  } catch {
    return new Response("JSON invalide", { status: 400 });
  }

  const event = body?.event;
  if (!event?.type) {
    return new Response("Événement invalide", { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    if (PURCHASE_EVENT_TYPES.has(event.type)) {
      await handlePurchaseEvent(supabase, event);
    } else if (event.type === "CANCELLATION" || event.type === "REFUND") {
      // Remboursement accordé par Apple (souvent automatique via
      // reportaproblem.apple.com, sans consultation de l'éditeur) : on
      // reprend les jetons et on marque la facture remboursée, sinon
      // l'utilisateur gardait ses crédits ET son argent.
      await handleRefundEvent(supabase, event);
    } else {
      console.log(`Événement RevenueCat ignoré : ${event.type}`);
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erreur traitement webhook RevenueCat:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Erreur interne",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});

// ----------------------------------------------------------------------------
// Traitement d'un achat de pack de jetons confirmé (In-App Purchase Apple)
// ----------------------------------------------------------------------------
// Identique dans l'esprit à handlePaymentIntentSucceeded (stripe-webhook) :
// crédit via RPC idempotente, puis génération de facture CGI (même
// numérotation TRP-YYYY-NNNN, même empreinte SHA-256).
async function handlePurchaseEvent(
  supabase: ReturnType<typeof createClient>,
  event: RevenueCatEvent,
) {
  const userId = event.app_user_id;
  const productId = event.product_id;
  const transactionId = event.transaction_id;
  const pack = productId ? PACKAGES[productId] : undefined;

  if (!userId || !productId || !transactionId || !pack) {
    throw new Error(
      `Événement RevenueCat incomplet ou product_id inconnu (product_id=${productId})`,
    );
  }

  // ⚠️ Audit 2026-07-29 : dans les webhooks RevenueCat, `price` est exprimé
  // en USD (converti) — le montant réellement payé dans la devise de
  // l'acheteur (EUR pour nos chauffeurs) est `price_in_purchased_currency`.
  // Facturer `price` aurait inscrit un montant USD sur une facture en euros.
  const amountTtc =
    typeof event.price_in_purchased_currency === "number" ? event.price_in_purchased_currency
    : typeof event.price === "number" ? event.price
    : 0;

  // 1. Crédit des tokens via RPC (idempotent grâce à revenuecat_transaction_id)
  const { data: credited, error: creditError } = await supabase.rpc(
    "credit_token_purchase_iap",
    {
      p_user_id: userId,
      p_tokens: pack.tokens,
      p_amount_ttc: amountTtc,
      p_package_id: productId,
      p_rc_transaction_id: transactionId,
    },
  );
  if (creditError) {
    throw new Error(`RPC credit_token_purchase_iap échouée : ${creditError.message}`);
  }
  if (credited !== true) {
    console.log(`Transaction ${transactionId} déjà créditée — événement ignoré`);
    return;
  }

  // 2. Facture d'achat — numéro TRP-YYYY-NNNN attribué et consommé dans la
  //    MÊME transaction SQL (advisory lock côté RPC). Avant, chaque webhook
  //    lisait le max puis insérait : deux achats simultanés de deux
  //    utilisateurs différents obtenaient le même numéro (la contrainte
  //    UNIQUE est par utilisateur, elle ne bloquait pas ce doublon).
  //    TVA 20 % : prestation de service numérique.
  const { data: invoiceNumber, error: invoiceError } = await supabase.rpc(
    "create_purchase_invoice",
    {
      p_user_id: userId,
      p_customer_name: pack.label,
      p_customer_email: null,
      p_amount_ttc: amountTtc,
      p_vat_rate: 20,
      p_payment_method: "apple_iap",
      p_external_id: transactionId,
    },
  );
  if (invoiceError || !invoiceNumber) {
    // On ne re-throw pas : les tokens sont crédités, l'utilisateur a déjà payé.
    console.error(
      `⚠️ Facture non créée pour transaction ${transactionId} : ${invoiceError?.message || "aucun numéro renvoyé"}`,
    );
    return; // pas de backfill d'un numéro qui n'existe pas
  }

  // 3. Backfill du numéro de facture sur la transaction
  await supabase
    .from("token_transactions")
    .update({ invoice_number: invoiceNumber })
    .eq("revenuecat_transaction_id", transactionId);

  console.log(
    `✅ [Apple IAP] Crédit ${pack.tokens} tokens pour user ${userId} (facture ${invoiceNumber}, transaction ${transactionId})`,
  );
}

// ----------------------------------------------------------------------------
// Remboursement Apple : reprise des jetons + facture marquée remboursée
// ----------------------------------------------------------------------------
async function handleRefundEvent(
  supabase: ReturnType<typeof createClient>,
  event: RevenueCatEvent,
) {
  const transactionId = event.transaction_id;
  if (!transactionId) {
    console.warn("Événement de remboursement sans transaction_id — ignoré");
    return;
  }

  const { data, error } = await supabase.rpc("refund_token_purchase", {
    p_external_id: transactionId,
  });
  if (error) {
    throw new Error(`RPC refund_token_purchase échouée : ${error.message}`);
  }
  console.log(
    data === true
      ? `↩️ Remboursement traité pour la transaction ${transactionId}`
      : `Remboursement ignoré (achat inconnu ou déjà remboursé) : ${transactionId}`,
  );
}

// ----------------------------------------------------------------------------
// Types (sous-ensemble minimal du payload RevenueCat utilisé ici)
// ----------------------------------------------------------------------------
interface RevenueCatEvent {
  type: string;
  app_user_id?: string;
  product_id?: string;
  transaction_id?: string;
  price?: number;                       // USD (converti par RevenueCat)
  price_in_purchased_currency?: number; // montant payé dans la devise réelle
  currency?: string;
  environment?: string;
}

// Note : l'empreinte fiscale SHA-256 est désormais calculée côté SQL, dans la
// RPC create_purchase_invoice — elle dépend du numéro de facture, qui n'est
// attribué qu'à l'intérieur de la transaction verrouillée.
