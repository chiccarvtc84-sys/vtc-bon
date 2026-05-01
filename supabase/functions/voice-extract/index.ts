// ============================================================================
// EDGE FUNCTION : voice-extract
// ============================================================================
// Reçoit une transcription vocale (faite côté client par Web Speech API),
// la nettoie via Claude Sonnet 4.6, et retourne un JSON structuré avec
// les champs d'un bon de course (client, lieux, distance, prix).
//
// Pourquoi Claude au lieu du parser local (`src/lib/voiceParser.js`) :
//   - Tolérance aux accents étrangers (maghrébin, ouest-africain, asiatique…)
//   - Correction phonétique (Carime → Karim, Niouyenne → Nguyen…)
//   - Reformatage propre des lieux (gares, aéroports, monuments)
//   - Score de confiance + liste des champs incertains
//
// Sécurité :
//   - JWT requis (verify_jwt: true) → seuls les utilisateurs connectés
//   - Validation : transcription non vide, max 5000 caractères
//   - Rate limit en mémoire : 30 calls/user/minute (anti-abus)
//
// Variables d'env :
//   - ANTHROPIC_API_KEY  (clé sk-ant-api03-… depuis console.anthropic.com)
//   - SUPABASE_URL, SUPABASE_ANON_KEY (auto-injectés par Supabase)
//
// Coût indicatif :
//   - Input : ~700-900 tokens (system + transcription) → 90% en cache après le 1er call
//   - Output : ~150 tokens (JSON court)
//   - ~0.003 €/extraction sur Sonnet 4.6 cache miss, ~0.0006 € cache hit
// ============================================================================

import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.40.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ----------------------------------------------------------------------------
// SYSTEM PROMPT (verbatim de la spec utilisateur — ne pas modifier)
// ----------------------------------------------------------------------------
const SYSTEM_PROMPT = `Tu es un assistant spécialisé dans l'extraction d'informations de courses VTC à partir de transcriptions vocales en français. Les chauffeurs qui utilisent l'application ont souvent un accent étranger (maghrébin, ouest-africain, asiatique, est-européen, etc.) et la reconnaissance vocale produit fréquemment des erreurs phonétiques. Ta mission est de comprendre l'intention réelle du chauffeur, pas de prendre la transcription au pied de la lettre.

Tu dois retourner UNIQUEMENT un objet JSON valide, sans texte avant ni après, avec la structure suivante :
{
  "client_prenom": string | null,
  "client_nom": string | null,
  "lieu_prise_en_charge": string | null,
  "lieu_depose": string | null,
  "distance_km": number | null,
  "prix_euros": number | null,
  "confiance": "haute" | "moyenne" | "basse",
  "champs_incertains": string[],
  "transcription_corrigee": string
}

RÈGLES POUR LE NOM ET PRÉNOM :
- Si un seul mot identifiable comme nom de personne → mets-le dans client_prenom, laisse client_nom à null
- Si "Monsieur", "Madame", "Mr", "Mme" suivi d'UN seul mot → c'est un nom de famille (client_nom)
- Si deux mots qui sont des noms de personne → premier = prénom, deuxième = nom
- Si "Monsieur/Madame" suivi de DEUX mots → prénom + nom
- Corrige les erreurs phonétiques courantes : Carime/Karime → Karim, Mohammed/Mouhamed → Mohamed, Iassine/Yassine → Yacine, Aicha/Aysha → Aïcha, Dialo/Dialeau → Diallo, Traore → Traoré, Niouyenne → Nguyen
- Garde les majuscules sur les noms propres
- Si totalement inintelligible → null + ajout dans champs_incertains

RÈGLES POUR LE LIEU DE PRISE EN CHARGE :
- Mots-clés : "je récupère", "prise en charge", "départ", "depuis", "à partir de", "je le prends à", "il est à", "je pars de"
- Reformate proprement (capitalisation, retire les "euh")
- Reconnaît gares, aéroports (Marignane, Roissy, Orly), hôtels, adresses, monuments
- Corrige les erreurs phonétiques de villes/quartiers (Avignon TGV, Aéroport Marseille Provence, Sorgues centre)

RÈGLES POUR LE LIEU DE DÉPOSE :
- Mots-clés : "je dépose", "destination", "arrivée", "vers", "jusqu'à", "direction", "à destination de", "je l'emmène à", "il va à"
- Mêmes règles de reformatage

RÈGLES POUR LA DISTANCE :
- Cherche nombres suivis de "kilomètres", "km", "bornes", "klics"
- Convertis en décimal (ex. "douze virgule cinq kilomètres" → 12.5)
- Reconnaît nombres en lettres
- Non mentionné → null

RÈGLES POUR LE PRIX :
- Cherche nombres suivis de "euros", "€", "balles", "boules", "le prix est", "ça fait", "ça coûte", "tarif", "course à"
- Convertis en décimal
- Non mentionné → null

NIVEAU DE CONFIANCE :
- "haute" : tous les champs présents extraits clairement
- "moyenne" : un ou deux champs nécessitent interprétation, ou un champ optionnel manque
- "basse" : transcription très bruitée, plusieurs champs ambigus, lieu PEC OU lieu dépose absent

CHAMPS INCERTAINS : liste les noms des champs où tu as dû deviner ou qui sont absents alors qu'ils semblaient mentionnés.

TRANSCRIPTION CORRIGÉE : réécris la phrase complète du chauffeur dans un français propre et naturel, avec noms et lieux correctement orthographiés.

CONTRAINTES STRICTES :
1. JAMAIS autre chose qu'un JSON valide
2. JAMAIS d'invention d'information non présente → null si manquant
3. JAMAIS de virgule comme séparateur décimal (utilise le point)
4. JAMAIS de markdown, balises \`\`\`json, ou habillage autour du JSON
5. Si aucune info exploitable → tous les champs à null, confiance "basse", explique brièvement dans transcription_corrigee`;

// ----------------------------------------------------------------------------
// CORS
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// Rate limit en mémoire (best-effort — les workers Edge peuvent être recyclés)
// ----------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30; // 30 extractions/user/minute (le chauffeur fait peut-être 1 course toutes les 10-30 min)
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
  return calls.length > RATE_LIMIT_MAX;
}

// ----------------------------------------------------------------------------
// Parsing robuste de la réponse Claude (gère le cas où il enrobe en ```json)
// ----------------------------------------------------------------------------
function safeParseJson(text: string): unknown {
  // Supprime les fences ```json ... ``` ou ``` ... ```
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  // Si Claude a quand même prefixé/suffixé du texte, on essaye d'extraire le 1er bloc {...}
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) cleaned = jsonMatch[0];
  return JSON.parse(cleaned);
}

// ----------------------------------------------------------------------------
// HANDLER
// ----------------------------------------------------------------------------
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
    // 1. Validation env
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json({ error: "Service indisponible (ANTHROPIC_API_KEY manquant côté serveur)" }, 500);
    }
    if (!apiKey.startsWith("sk-ant-")) {
      return json({
        error: "ANTHROPIC_API_KEY invalide",
        detail: `La clé doit commencer par sk-ant-. Reçu : '${apiKey.slice(0, 10)}...'`,
      }, 500);
    }

    // 2. Authentification (JWT Supabase)
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

    // 3. Rate limit
    if (isRateLimited(user.id)) {
      return json({ error: "Trop d'extractions vocales. Réessayez dans une minute." }, 429);
    }

    // 4. Validation du body
    const body = await req.json().catch(() => ({}));
    const transcription = String(body?.transcription ?? "").trim();
    if (!transcription) {
      return json({ error: "Le champ 'transcription' est requis" }, 400);
    }
    if (transcription.length > 5000) {
      return json({ error: "Transcription trop longue (max 5000 caractères)" }, 400);
    }

    // 5. Appel Claude Sonnet 4.6 avec prompt caching
    //    Le system prompt est mis en cache (cache_control: ephemeral) →
    //    après le 1er call, les call suivants paient ~10% du prix d'input
    //    pour la portion système (au-dessus du seuil de cache 1024 tokens).
    const anthropic = new Anthropic({ apiKey });

    // AbortController pour le timeout 30s spécifié par le user
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    let response;
    try {
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        temperature: 0,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: `Transcription à analyser :\n\n${transcription}`,
          },
        ],
      }, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }

    // 6. Extraction du texte de la réponse
    const firstText = response.content.find((b) => b.type === "text");
    if (!firstText || firstText.type !== "text") {
      console.error("[voice-extract] Réponse Claude sans bloc texte:", response.content);
      return json({ error: "Réponse Claude sans contenu texte" }, 500);
    }

    // 7. Parse JSON robuste
    let parsed: unknown;
    try {
      parsed = safeParseJson(firstText.text);
    } catch (parseErr) {
      console.error("[voice-extract] JSON parse failed:", firstText.text);
      return json({
        error: "Réponse Claude invalide (JSON malformé)",
        detail: String(parseErr),
        raw: firstText.text.slice(0, 500),
      }, 500);
    }

    // 8. Logs (sans données sensibles en production)
    console.log("[voice-extract] OK", {
      user_id: user.id,
      transcription_len: transcription.length,
      cache_creation_tokens: response.usage.cache_creation_input_tokens ?? 0,
      cache_read_tokens: response.usage.cache_read_input_tokens ?? 0,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    });

    return json(parsed, 200);
  } catch (err) {
    const e = err as { name?: string; message?: string; status?: number };
    console.error("[voice-extract] Internal error:", err);
    if (e?.name === "AbortError") {
      return json({ error: "Délai d'attente dépassé (30s) côté API Claude" }, 504);
    }
    return json({
      error: "Erreur interne lors de l'extraction vocale",
      detail: e?.message || String(err),
    }, e?.status && e.status >= 400 && e.status < 600 ? e.status : 500);
  }
});
