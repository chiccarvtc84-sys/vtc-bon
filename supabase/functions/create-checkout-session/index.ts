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

// Origines explicitement autorisées. SITE_URL = origine de la PWA en prod,
// localhost:5173/5174 = dev Vite, capacitor:// + ionic:// = WebView Capacitor
// (iOS et Android utilisent ces schémas pour l'origin du WebView).
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

// Catalogue figé côté serveur — la source de vérité pour les prix.
// Doit rester synchronisé avec TOKEN_PACKAGES côté React.
// priceIds Live : produits créés dans le compte Stripe utilisateur en mode Live.
// Bascule effectuée 2026-04-30. Les anciens IDs Test sont conservés en
// commentaire ci-dessous pour rollback rapide si besoin.
//
// Test mode (rollback) :
//   pack20: price_1TRqnaGbkiwQlw6ADATVkH6n
//   pack40: price_1TRqo3GbkiwQlw6A3tgTqL0X
//   pack50: price_1TRqoIGbkiwQlw6AmCOFcZH8
//   pack80: price_1TRqoTGbkiwQlw6AhPoifOH8
const PACKAGES: Record<
  string,
  { priceId: string; tokens: number; label: string; amountCents: number }
> = {
  pack20: { priceId: "price_1TRbSXGbkiwQlw6ArEmIHC2N", tokens: 20, label: "Pack Découverte", amountCents: 200 },
  pack40: { priceId: "price_1TRbSXGbkiwQlw6AetDlzM9a", tokens: 40, label: "Pack Essentiel", amountCents: 350 },
  pack50: { priceId: "price_1TRbSWGbkiwQlw6A9xo37B38", tokens: 50, label: "Pack Confort", amountCents: 400 },
  pack80: { priceId: "price_1TRbSVGbkiwQlw6ABNmVGjj8", tokens: 80, label: "Pack Pro", amountCents: 500 },
};

// Rate limit en mémoire (best-effort, suffisant pour bloquer un abus basique).
// Les Edge Functions Supabase peuvent recycler les workers, donc ce n'est pas
// une garantie absolue, mais ça calme un bot qui martèle l'endpoint.
const RATE_LIMIT_WINDOW_MS = 60_000;     // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;       // 10 sessions Checkout / user / minute
const recentCalls = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const calls = (recentCalls.get(userId) || []).filter((t) => t > cutoff);
  calls.push(now);
  recentCalls.set(userId, calls);
  // Best-effort cleanup pour éviter une fuite mémoire
  if (recentCalls.size > 1000) {
    for (const [k, v] of recentCalls) {
      if (v[v.length - 1] < cutoff) recentCalls.delete(k);
    }
  }
  return calls.length > RATE_LIMIT_MAX_REQUESTS;
}

Deno.serve(async (req: Request) => {
  const cors = buildCorsHeaders(req.headers.get("Origin"));

  // Préflight CORS
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
    const siteUrl = Deno.env.get("SITE_URL") || "http://localhost:5173";

    // Identité utilisateur via le JWT Supabase
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

    // Lire et valider strictement le packageId
    const body = await req.json().catch(() => ({}));
    const rawPackageId = body?.packageId;
    if (typeof rawPackageId !== "string" || rawPackageId.length > 32) {
      return json({ error: "packageId invalide" }, 400);
    }
    const packageId = rawPackageId;
    const pack = PACKAGES[packageId];
    if (!pack) {
      return json({ error: `Pack inconnu : ${packageId}` }, 400);
    }

    // Profil utilisateur (pour pré-remplir l'email Stripe)
    // Note : le flag anti-fraude ("flagged") ne bloque PAS les paiements réels —
    // il ne sert qu'à empêcher le cumul abusif du bonus de bienvenue gratuit.
    // Un vrai paiement carte via Stripe n'a pas ce risque de fraude.
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

    return json({ sessionId: session.id, url: session.url }, 200);
  } catch (err) {
    // Sécurité H-2 (audit 2026-05-06) : ne JAMAIS forwarder les détails
    // Stripe au client (stripe_code/type/status, message brut). Ça leak
    // des infos de configuration interne (priceId manquant, clé pas en
    // bon mode, account pas activé, etc.) qui aident un attaquant à
    // cartographier ton infra. On log côté serveur, on renvoie générique.
    const e = err as { message?: string; code?: string; type?: string; statusCode?: number };
    console.error("[create-checkout-session] error:", {
      msg: e?.message, code: e?.code, type: e?.type, status: e?.statusCode,
    });

    // Whitelist d'erreurs Stripe traduisibles directement au user.
    // Tout le reste retourne un message générique (pas de détail technique).
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
