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
    } else if (event.type === "payment_intent.succeeded") {
      // Flow Apple Pay natif : pas de Checkout Session, on traite l'intent direct.
      // ⚠️ Pour éviter le double-crédit, on ne traite QUE les intents marqués
      // `flow === 'native_apple_pay'` dans leurs métadonnées. Les intents
      // créés par un Checkout Session classique sont traités par le handler
      // `checkout.session.completed` ci-dessus (Stripe envoie les 2 events).
      const intent = event.data.object as Stripe.PaymentIntent;
      if (intent.metadata?.flow === "native_apple_pay") {
        await handlePaymentIntentSucceeded(supabase, intent);
      } else {
        console.log(`PaymentIntent ${intent.id} ignoré (flow=${intent.metadata?.flow || 'checkout'})`);
      }
    } else if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as Stripe.PaymentIntent;
      console.warn(`Paiement échoué : ${intent.id}`, intent.last_payment_error);
    } else if (event.type === "charge.refunded") {
      // Remboursement (total ou partiel) : sans ce traitement, l'utilisateur
      // récupérait son argent ET gardait ses jetons, avec une facture qui
      // restait « payée ». On reprend les jetons et on marque la facture.
      const charge = event.data.object as Stripe.Charge;
      const intentId = typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id;
      await handleRefund(supabase, intentId);
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

  // 2. Facture d'achat — numéro TRP-YYYY-NNNN attribué et consommé dans la
  //    MÊME transaction SQL (advisory lock côté RPC). Avant, chaque webhook
  //    lisait le max puis insérait : deux achats simultanés de deux
  //    utilisateurs différents obtenaient le même numéro (la contrainte
  //    UNIQUE est par utilisateur, elle ne bloquait pas ce doublon).
  //    TVA 20 % : prestation de service numérique (vente de crédits).
  const customerEmail = session.customer_details?.email ||
    session.customer_email || null;
  const customerName = session.customer_details?.name || packLabel;

  const { data: invoiceNumber, error: invoiceError } = await supabase.rpc(
    "create_purchase_invoice",
    {
      p_user_id: userId,
      p_customer_name: customerName,
      p_customer_email: customerEmail,
      p_amount_ttc: amountTtc,
      p_vat_rate: 20,
      p_payment_method: "card",
      p_external_id: intentId,
    },
  );
  if (invoiceError || !invoiceNumber) {
    // On ne re-throw pas : les tokens sont crédités, l'utilisateur a déjà payé.
    // L'absence de facture sera détectable via une requête de cohérence.
    console.error(
      `⚠️ Facture non créée pour intent ${intentId} : ${invoiceError?.message || "aucun numéro renvoyé"}`,
    );
    return; // pas de backfill d'un numéro de facture qui n'existe pas
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
// Traitement d'un PaymentIntent réussi (flow Apple Pay natif)
// ----------------------------------------------------------------------------
// Identique à handleCheckoutCompleted mais lit les métadonnées et le montant
// directement depuis le PaymentIntent (pas de Checkout Session enveloppante).
// Le payment_method est marqué "apple_pay" car ce handler est exclusivement
// déclenché par les flows initiés depuis l'app native (où la sheet Apple Pay
// est l'unique méthode de paiement).
async function handlePaymentIntentSucceeded(
  supabase: ReturnType<typeof createClient>,
  intent: Stripe.PaymentIntent,
) {
  const meta = intent.metadata ?? {};
  const userId = meta.user_id;
  const packageId = meta.package_id;
  const tokens = parseInt(meta.tokens || "0", 10);
  const packLabel = meta.pack_label || packageId;

  if (!userId || !packageId || !tokens) {
    throw new Error("Métadonnées PaymentIntent manquantes");
  }

  const amountTtc = (intent.amount_received ?? intent.amount ?? 0) / 100;

  // 1. Crédit des tokens via RPC (idempotent grâce à stripe_payment_intent_id)
  const { data: credited, error: creditError } = await supabase.rpc(
    "credit_token_purchase",
    {
      p_user_id: userId,
      p_tokens: tokens,
      p_amount_ttc: amountTtc,
      p_package_id: packageId,
      p_stripe_intent_id: intent.id,
    },
  );
  if (creditError) {
    throw new Error(`RPC credit_token_purchase échouée : ${creditError.message}`);
  }
  if (credited !== true) {
    console.log(`Intent ${intent.id} déjà crédité — événement ignoré`);
    return;
  }

  // 2. Facture d'achat — numérotation atomique côté SQL (cf. commentaire
  //    détaillé dans handleCheckoutCompleted).
  //    L'email du PaymentIntent vient de receipt_email (posé à la création).
  const customerEmail = intent.receipt_email || null;

  const { data: invoiceNumber, error: invoiceError } = await supabase.rpc(
    "create_purchase_invoice",
    {
      p_user_id: userId,
      p_customer_name: packLabel,
      p_customer_email: customerEmail,
      p_amount_ttc: amountTtc,
      p_vat_rate: 20,
      p_payment_method: "apple_pay",
      p_external_id: intent.id,
    },
  );
  if (invoiceError || !invoiceNumber) {
    console.error(
      `⚠️ Facture non créée pour intent ${intent.id} : ${invoiceError?.message || "aucun numéro renvoyé"}`,
    );
    return; // pas de backfill d'un numéro de facture qui n'existe pas
  }

  // 3. Backfill du numéro de facture sur la transaction
  await supabase
    .from("token_transactions")
    .update({ invoice_number: invoiceNumber })
    .eq("stripe_payment_intent_id", intent.id);

  console.log(
    `✅ [Apple Pay natif] Crédit ${tokens} tokens pour user ${userId} (facture ${invoiceNumber}, intent ${intent.id})`,
  );
}

// ----------------------------------------------------------------------------
// Remboursement Stripe : reprise des jetons + facture marquée remboursée
// ----------------------------------------------------------------------------
async function handleRefund(
  supabase: ReturnType<typeof createClient>,
  intentId: string | undefined,
) {
  if (!intentId) {
    console.warn("charge.refunded sans payment_intent — ignoré");
    return;
  }
  const { data, error } = await supabase.rpc("refund_token_purchase", {
    p_external_id: intentId,
  });
  if (error) {
    throw new Error(`RPC refund_token_purchase échouée : ${error.message}`);
  }
  console.log(
    data === true
      ? `↩️ Remboursement traité pour l'intent ${intentId}`
      : `Remboursement ignoré (achat inconnu ou déjà remboursé) : ${intentId}`,
  );
}

// Note : l'empreinte fiscale SHA-256 est désormais calculée côté SQL, dans la
// RPC create_purchase_invoice — elle dépend du numéro de facture, qui n'est
// attribué qu'à l'intérieur de la transaction verrouillée.
