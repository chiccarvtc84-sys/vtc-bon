// ============================================================================
// EDGE FUNCTION : stripe-webhook
// ============================================================================
// Reçoit les événements Stripe (signés). Quand un paiement Checkout est
// confirmé, on crédite les tokens du user concerné via la RPC
// `credit_token_purchase` (idempotente — anti double crédit grâce à
// stripe_payment_intent_id) et on génère une facture conforme CGI.
//
// Sécurité :
//   - Pas de JWT (Stripe appelle l'URL publique).
//   - La signature `stripe-signature` est vérifiée avec STRIPE_WEBHOOK_SECRET.
//   - Toute requête sans signature valide est rejetée 400.
//
// Variables d'env attendues :
//   - STRIPE_SECRET_KEY
//   - STRIPE_WEBHOOK_SECRET
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY (pour bypass RLS et écrire dans token_transactions)
// ============================================================================

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    console.error("Configuration manquante");
    return new Response("Configuration manquante", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Signature manquante", { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch (err) {
    console.error("Vérification signature échouée:", err);
    return new Response(
      `Webhook signature verification failed: ${
        err instanceof Error ? err.message : err
      }`,
      { status: 400 },
    );
  }

  // Client Supabase avec service role : bypass RLS pour écrire les transactions
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(stripe, supabase, session);
    } else if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as Stripe.PaymentIntent;
      console.warn(`Paiement échoué : ${intent.id}`, intent.last_payment_error);
    } else {
      // Autres événements ignorés silencieusement (charge.succeeded, etc.)
      console.log(`Événement ignoré : ${event.type}`);
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erreur traitement webhook:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Erreur interne",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});

// ----------------------------------------------------------------------------
// Traitement d'un paiement réussi
// ----------------------------------------------------------------------------
async function handleCheckoutCompleted(
  stripe: Stripe,
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session,
) {
  const meta = session.metadata ?? {};
  const userId = meta.user_id;
  const packageId = meta.package_id;
  const tokens = parseInt(meta.tokens || "0", 10);
  const packLabel = meta.pack_label || packageId;

  if (!userId || !packageId || !tokens) {
    throw new Error("Métadonnées Checkout manquantes");
  }
  if (session.payment_status !== "paid") {
    console.log(`Session ${session.id} pas encore payée (${session.payment_status})`);
    return;
  }

  // Récupérer l'intent réel pour stocker l'ID dans token_transactions
  const intentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id;
  if (!intentId) throw new Error("payment_intent introuvable");

  const amountTtc = (session.amount_total ?? 0) / 100;

  // 1. Crédit des tokens via RPC (idempotent grâce à stripe_payment_intent_id)
  const { data: credited, error: creditError } = await supabase.rpc(
    "credit_token_purchase",
    {
      p_user_id: userId,
      p_tokens: tokens,
      p_amount_ttc: amountTtc,
      p_package_id: packageId,
      p_stripe_intent_id: intentId,
    },
  );
  if (creditError) {
    throw new Error(`RPC credit_token_purchase échouée : ${creditError.message}`);
  }
  if (credited !== true) {
    // Déjà crédité (rejeu webhook) — on ne génère pas une 2e facture
    console.log(`Intent ${intentId} déjà crédité — événement ignoré`);
    return;
  }

  // 2. Génération de la facture (numéro chronologique TRP-YYYY-XXXX)
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

  // TVA 20% standard sur prestation de service numérique (vente de crédits)
  // (En cas d'auto-liquidation UE B2B, à adapter via vat_intra du customer.)
  const vatRate = 20;
  const amountHt = +(amountTtc / (1 + vatRate / 100)).toFixed(2);
  const amountVat = +(amountTtc - amountHt).toFixed(2);

  // Empreinte fiscale : SHA-256 des données invariantes
  const fingerprintRaw = [
    invoiceNumber,
    userId,
    packageId,
    String(amountTtc),
    intentId,
    new Date().toISOString(),
  ].join("|");
  const fingerprint = await sha256(fingerprintRaw);

  const customerEmail = session.customer_details?.email ||
    session.customer_email || null;
  const customerName = session.customer_details?.name || packLabel;

  const { error: invoiceError } = await supabase.from("invoices").insert({
    user_id: userId,
    booking_id: null,
    invoice_number: invoiceNumber,
    customer_name: customerName,
    customer_email: customerEmail,
    amount_ht: amountHt,
    amount_vat: amountVat,
    amount_ttc: amountTtc,
    vat_rate: vatRate,
    vat_reverse_charge: false,
    status: "paid",
    payment_method: "card",
    fingerprint,
    fingerprint_algorithm: "sha256",
    qr_code_data:
      `INV:${invoiceNumber}|TTC:${amountTtc}|VAT:${vatRate}|FP:${fingerprint.slice(0, 16)}`,
    paid_at: new Date().toISOString(),
  });
  if (invoiceError) {
    // On ne re-throw pas : les tokens sont crédités, l'utilisateur a déjà payé.
    // L'absence de facture sera détectable via une requête de cohérence.
    console.error(
      `⚠️ Facture non créée pour intent ${intentId} : ${invoiceError.message}`,
    );
  }

  // 3. Backfill du numéro de facture sur la transaction de purchase
  await supabase
    .from("token_transactions")
    .update({ invoice_number: invoiceNumber })
    .eq("stripe_payment_intent_id", intentId);

  console.log(
    `✅ Crédit ${tokens} tokens pour user ${userId} (facture ${invoiceNumber}, intent ${intentId})`,
  );
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
