// ============================================================================
// EDGE FUNCTION : create-checkout-session
// ============================================================================
// Crée une session Stripe Checkout pour acheter un pack de crédits.
// L'utilisateur authentifié envoie un { packageId } et reçoit l'URL hosted
// de Stripe vers laquelle on le redirige.
//
// Sécurité :
//   - JWT requis (l'identité de l'utilisateur est tirée du token Supabase).
//   - Le price_id est hardcodé côté serveur — impossible pour le client de
//     trafiquer le prix.
//
// Variables d'env attendues côté Supabase :
//   - STRIPE_SECRET_KEY  (sk_test_… ou sk_live_…)
//   - SITE_URL           (URL de retour après paiement, ex http://localhost:5173)
// ============================================================================

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Catalogue figé côté serveur — la source de vérité pour les prix.
// Doit rester synchronisé avec TOKEN_PACKAGES côté React.
const PACKAGES: Record<
  string,
  { priceId: string; tokens: number; label: string; amountCents: number }
> = {
  pack20: {
    priceId: "price_1TQuQWGYVtGQnVrZcnvDfEMJ",
    tokens: 20,
    label: "Pack Découverte",
    amountCents: 200,
  },
  pack40: {
    priceId: "price_1TQuQZGYVtGQnVrZO9EFBOg3",
    tokens: 40,
    label: "Pack Essentiel",
    amountCents: 350,
  },
  pack50: {
    priceId: "price_1TQuQcGYVtGQnVrZbp1H0jyi",
    tokens: 50,
    label: "Pack Confort",
    amountCents: 400,
  },
  pack80: {
    priceId: "price_1TQuQfGYVtGQnVrZzc62g6OX",
    tokens: 80,
    label: "Pack Pro",
    amountCents: 500,
  },
};

Deno.serve(async (req: Request) => {
  // Préflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return jsonError("Stripe non configuré (STRIPE_SECRET_KEY manquant)", 500);
    }
    const siteUrl = Deno.env.get("SITE_URL") || "http://localhost:5173";

    // Identité utilisateur via le JWT Supabase
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonError("Token manquant", 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonError("Utilisateur non authentifié", 401);
    }

    // Lire le packageId envoyé
    const body = await req.json().catch(() => ({}));
    const packageId = String(body?.packageId ?? "");
    const pack = PACKAGES[packageId];
    if (!pack) {
      return jsonError(`Pack inconnu : ${packageId}`, 400);
    }

    // Profil utilisateur (pour pré-remplir l'email Stripe)
    const { data: profile } = await supabase
      .from("users")
      .select("email, name")
      .eq("id", user.id)
      .single();

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: profile?.email || user.email,
      line_items: [{ price: pack.priceId, quantity: 1 }],
      success_url: `${siteUrl}/?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?purchase=cancel`,
      // Métadonnées indispensables : le webhook lit ces champs pour créditer
      // le bon utilisateur avec le bon nombre de tokens.
      metadata: {
        user_id: user.id,
        package_id: packageId,
        tokens: String(pack.tokens),
        pack_label: pack.label,
      },
      // Locale FR pour la page Checkout
      locale: "fr",
      allow_promotion_codes: false,
    });

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("create-checkout-session error:", err);
    return jsonError(
      err instanceof Error ? err.message : "Erreur interne",
      500,
    );
  }
});

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
