// ============================================================================
// EDGE FUNCTION : create-payment-intent
// ============================================================================
// Crée un Stripe PaymentIntent pour un achat de pack de crédits via Apple Pay
// natif (sheet PassKit iOS) ou Google Pay. Pas de page Checkout web — l'app
// récupère un clientSecret et déclenche directement la sheet de paiement
// native via @capacitor-community/stripe.
//
// Différence avec create-checkout-session :
//   - PAS d'URL de retour (le paiement reste dans l'app)
//   - PAS de hosted page Stripe
//   - Renvoie { paymentIntentId, clientSecret } au lieu de { url }
//   - L'app appelle ensuite Stripe.confirmApplePay(clientSecret) en natif
//
// Sécurité :
//   - JWT Supabase requis (identité tirée du token)
//   - Le montant est calculé côté serveur depuis un catalogue figé
//   - Métadonnées (user_id, package_id, tokens) embarquées sur le PaymentIntent
//     → lues par le webhook stripe-webhook au moment du `payment_intent.succeeded`
//   - Refus des comptes flagués (anti-fraude)
//
// Variables d'env :
//   - STRIPE_SECRET_KEY  (sk_live_… en production, sk_test_… en dev)
// ============================================================================

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

function buildCorsHeaders(reqOrigin: string | null): Record<string, string> {
  const siteUrl = (Deno.env.get("SITE_URL") || "").replace(/\/$/, "");
  const allowed = new Set<string>([
    "http://localhost:5173",
    "http://localhost:5174",
    "capacitor://localhost",
    "ionic://localhost",
    "https://localhost",
  ]);
  if (siteUrl) allowed.add(siteUrl);

  const origin = reqOrigin && allowed.has(reqOrigin) ? reqOrigin : (siteUrl || "");
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "3600",
    "Vary": "Origin",
  };
}

// Catalogue figé côté serveur (synchronisé avec TOKEN_PACKAGES côté React).
// Pour Apple Pay natif on n'a PAS besoin du priceId (on passe directement
// par PaymentIntent avec amount + currency). On garde priceId pour traçabilité.
const PACKAGES: Record<
  string,
  { tokens: number; label: string; amountCents: number }
> = {
  pack20: { tokens: 20, label: "Pack Découverte", amountCents: 200 },
  pack40: { tokens: 40, label: "Pack Essentiel",  amountCents: 350 },
  pack50: { tokens: 50, label: "Pack Confort",    amountCents: 400 },
  pack80: { tokens: 80, label: "Pack Pro",        amountCents: 500 },
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const recentCalls = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const calls = (recentCalls.get(userId) || []).filter((t) => t > cutoff);
  calls.push(now);
  recentCalls.set(userId, calls);
  if (recentCalls.size > 1000) {
    for (const [k, v] of recentCalls) {
      if (v[v.length - 1] < cutoff) recentCalls.delete(k);
    }
  }
  return calls.length > RATE_LIMIT_MAX_REQUESTS;
}

Deno.serve(async (req: Request) => {
  const cors = buildCorsHeaders(req.headers.get("Origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return json({ error: "Stripe non configuré (STRIPE_SECRET_KEY manquant)" }, 500);
    }

    // Identité utilisateur via JWT Supabase
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Token manquant" }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return json({ error: "Utilisateur non authentifié" }, 401);
    }

    if (isRateLimited(user.id)) {
      return json({ error: "Trop de requêtes. Réessayez dans une minute." }, 429);
    }

    // Lecture & validation du packageId
    const body = await req.json().catch(() => ({}));
    const rawPackageId = body?.packageId;
    if (typeof rawPackageId !== "string" || rawPackageId.length > 32) {
      return json({ error: "packageId invalide" }, 400);
    }
    const pack = PACKAGES[rawPackageId];
    if (!pack) {
      return json({ error: `Pack inconnu : ${rawPackageId}` }, 400);
    }

    // Profil pour anti-fraude
    const { data: profile } = await supabase
      .from("users")
      .select("email, name, flagged")
      .eq("id", user.id)
      .single();

    if (profile?.flagged) {
      return json({ error: "Compte temporairement suspendu" }, 403);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    // Création du PaymentIntent. amount en centimes, EUR.
    // payment_method_types=['card'] (plus fiable que automatic_payment_methods
    // pour le flow Apple Pay natif via @capacitor-community/stripe — le
    // plugin confirme le PI avec un PaymentMethod de type 'card', dérivé
    // du token Apple Pay généré par PassKit côté iOS).
    const intent = await stripe.paymentIntents.create({
      amount: pack.amountCents,
      currency: "eur",
      payment_method_types: ["card"],
      receipt_email: profile?.email || user.email,
      description: `${pack.label} — ${pack.tokens} crédits TrajetPro`,
      metadata: {
        user_id: user.id,
        package_id: rawPackageId,
        tokens: String(pack.tokens),
        pack_label: pack.label,
        // Drapeau pour différencier ce flow du Checkout Session classique
        // côté webhook : ici on traite payment_intent.succeeded,
        // pas checkout.session.completed.
        flow: "native_apple_pay",
      },
    });

    return json({
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      amountCents: pack.amountCents,
      label: pack.label,
      tokens: pack.tokens,
    }, 200);
  } catch (err) {
    const e = err as { message?: string; code?: string; type?: string; statusCode?: number };
    console.error("[create-payment-intent] error:", {
      msg: e?.message, code: e?.code, type: e?.type, status: e?.statusCode,
    });

    let userMessage = "Erreur interne lors de la création du paiement";
    if (e?.code === "card_declined") userMessage = "Carte refusée par votre banque.";
    else if (e?.code === "rate_limit") userMessage = "Trop de tentatives, réessayez dans une minute.";
    else if (e?.type === "StripeInvalidRequestError" && /amount/.test(e?.message || "")) {
      userMessage = "Montant invalide.";
    }

    return new Response(
      JSON.stringify({ error: userMessage }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
