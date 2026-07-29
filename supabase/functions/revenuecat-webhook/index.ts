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
    } else {
      // Autres événements ignorés silencieusement (RENEWAL, CANCELLATION,
      // EXPIRATION, BILLING_ISSUE, TRANSFER, TEST, ... ne concernent pas
      // les jetons consommables).
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

  // 2. Génération de la facture (numérotation chronologique TRP-YYYY-XXXX,
  //    partagée avec le flux Stripe pour ne jamais avoir de rupture de suite)
  const year = new Date().getUTCFullYear();
  const { data: lastInvoice } = await supabase
    .from("invoices")
    .select("invoice_number")
    .like("invoice_number", `TRP-${year}-%`)
    .order("invoice_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNum = 1;
  if (lastInvoice?.invoice_number) {
    const match = lastInvoice.invoice_number.match(/-(\d+)$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  const invoiceNumber = `TRP-${year}-${String(nextNum).padStart(4, "0")}`;

  // TVA 20% standard sur prestation de service numérique. Apple gère sa
  // propre TVA/taxe locale sur le prix affiché à l'acheteur ; on documente
  // ici la ventilation HT/TVA pour la facture française, cohérente avec le
  // reste du système (le montant TTC, lui, vient de RevenueCat/Apple).
  const vatRate = 20;
  const amountHt = +(amountTtc / (1 + vatRate / 100)).toFixed(2);
  const amountVat = +(amountTtc - amountHt).toFixed(2);

  const fingerprintRaw = [
    invoiceNumber, userId, productId,
    String(amountTtc), transactionId, new Date().toISOString(),
  ].join("|");
  const fingerprint = await sha256(fingerprintRaw);

  const { error: invoiceError } = await supabase.from("invoices").insert({
    user_id: userId,
    booking_id: null,
    invoice_number: invoiceNumber,
    customer_name: pack.label,
    customer_email: null,
    amount_ht: amountHt,
    amount_vat: amountVat,
    amount_ttc: amountTtc,
    vat_rate: vatRate,
    vat_reverse_charge: false,
    status: "paid",
    payment_method: "apple_iap",
    fingerprint,
    fingerprint_algorithm: "sha256",
    qr_code_data:
      `INV:${invoiceNumber}|TTC:${amountTtc}|VAT:${vatRate}|FP:${fingerprint.slice(0, 16)}`,
    paid_at: new Date().toISOString(),
  });
  if (invoiceError) {
    // On ne re-throw pas : les tokens sont crédités, l'utilisateur a déjà payé.
    console.error(
      `⚠️ Facture non créée pour transaction ${transactionId} : ${invoiceError.message}`,
    );
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

// ----------------------------------------------------------------------------
// Utils
// ----------------------------------------------------------------------------
async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
