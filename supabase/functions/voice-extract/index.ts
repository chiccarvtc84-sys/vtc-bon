// ============================================================================
// EDGE FUNCTION : voice-extract
// ============================================================================
// Reçoit une transcription vocale (faite côté client par Web Speech API),
// la nettoie via Google Gemini 2.5 Flash, et retourne un JSON structuré
// avec les champs d'un bon de course (client, lieux, distance, prix).
//
// Migration Anthropic Claude → Google Gemini (2026-05-01) : tier gratuit
// largement suffisant pour le volume actuel ; modèle 2.0 Flash rapide et
// précis sur le français (gemini-2.0-flash a été déprécié en 2026,
// remplacé par gemini-2.5-flash). Logique métier inchangée — même system prompt,
// même structure JSON de retour. Pas de SDK Gemini pour Deno → on appelle
// l'API REST directement via fetch().
//
// Sécurité :
//   - JWT requis (verify_jwt: true) → seuls les utilisateurs connectés
//   - Validation : transcription non vide, max 5000 caractères
//   - Rate limit en mémoire : 30 calls/user/minute (anti-abus)
//
// Variables d'env :
//   - GEMINI_API_KEY     (clé AIza... depuis https://aistudio.google.com/apikey)
//   - SUPABASE_URL, SUPABASE_ANON_KEY (auto-injectés par Supabase)
//
// Coût : tier gratuit Gemini 2.5 Flash = 1500 req/jour gratuites côté Google.
// ============================================================================

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
// Configuration Gemini
// ----------------------------------------------------------------------------
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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
const RATE_LIMIT_MAX = 30;
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
// Parsing robuste : Gemini en mode JSON strict est généralement clean,
// mais on garde la dégradation gracieuse au cas où.
// ----------------------------------------------------------------------------
function safeParseJson(text: string): unknown {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
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
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return json({ error: "Service indisponible (GEMINI_API_KEY manquant côté serveur)" }, 500);
    }
    if (apiKey.length < 20) {
      return json({
        error: "GEMINI_API_KEY invalide",
        detail: `La clé semble tronquée. Reçu : '${apiKey.slice(0, 6)}...' (${apiKey.length} caractères)`,
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

    // 5. Appel Google Gemini 2.5 Flash en mode JSON strict.
    //    Pas de SDK Gemini pour Deno → fetch() natif.
    //    `responseMimeType: "application/json"` force Gemini à ne renvoyer
    //    QUE du JSON parsable, sans préambule ni markdown.
    //    Gemini gère le caching côté serveur automatiquement (pas de
    //    `cache_control` à passer).
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    let geminiResponse: {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
        safetyRatings?: unknown;
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
      promptFeedback?: { blockReason?: string };
    };

    try {
      const url = `${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
      const fetchResponse = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: `Transcription à analyser :\n\n${transcription}` }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0,
            // Gemini 2.5 Flash a un mode "thinking" activé par défaut qui
            // consomme une partie du budget AVANT de générer la réponse.
            // Pour de l'extraction JSON simple on n'en a pas besoin :
            // thinkingBudget: 0 désactive complètement le raisonnement interne
            // (réponse plus rapide + JSON jamais tronqué).
            thinkingConfig: { thinkingBudget: 0 },
            maxOutputTokens: 2048,
          },
        }),
        signal: controller.signal,
      });

      if (!fetchResponse.ok) {
        const errBody = await fetchResponse.text();
        // Sécurité H-3 (audit 2026-05-06) : on log le détail Gemini côté
        // serveur mais on NE le forward PAS au client. Sinon on leak des
        // infos de config (API_KEY_INVALID, PERMISSION_DENIED, quota, …)
        // qui permettent à un attaquant authentifié de probe l'état de la
        // clé Gemini.
        console.error("[voice-extract] Gemini API error:", fetchResponse.status, errBody.slice(0, 500));
        return json({
          error: "Service d'extraction vocale temporairement indisponible. Réessayez dans quelques instants.",
        }, 502);
      }

      geminiResponse = await fetchResponse.json();
    } finally {
      clearTimeout(timeoutId);
    }

    // 6. Vérification que Gemini a bien renvoyé du contenu (pas bloqué pour
    //    safety, par exemple).
    // Sécurité : on log le blockReason / finishReason côté serveur mais
    // on ne les forward pas au client.
    if (geminiResponse?.promptFeedback?.blockReason) {
      console.error("[voice-extract] Gemini prompt blocked:", geminiResponse.promptFeedback.blockReason);
      return json({
        error: "Votre transcription contient du contenu sensible et a été refusée. Reformulez en termes plus neutres.",
      }, 400);
    }

    const candidates = geminiResponse?.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      console.error("[voice-extract] Gemini sans candidats:", geminiResponse);
      return json({ error: "Service d'extraction vocale temporairement indisponible." }, 500);
    }

    const firstCandidate = candidates[0];
    const text = firstCandidate?.content?.parts?.[0]?.text;
    if (!text) {
      const finishReason = firstCandidate?.finishReason;
      console.error("[voice-extract] Gemini réponse vide. finishReason:", finishReason);
      return json({
        error: "Réponse vide. Réessayez en parlant plus clairement.",
      }, 500);
    }

    // 7. Parse JSON robuste (Gemini en mode JSON strict est très propre,
    //    mais filet de sécurité au cas où).
    let parsed: unknown;
    try {
      parsed = safeParseJson(text);
    } catch (parseErr) {
      // On log le détail (parser error + raw text) côté serveur mais on
      // NE le forward PAS au client. La réponse brute Gemini peut contenir
      // des infos d'API ou des tokens accidentellement échappés.
      console.error("[voice-extract] JSON parse failed:", String(parseErr), text.slice(0, 500));
      return json({
        error: "Réponse de l'IA inattendue. Réessayez ou utilisez la saisie manuelle.",
      }, 500);
    }

    // 8. Logs (sans données sensibles en production)
    const usage = geminiResponse?.usageMetadata;
    console.log("[voice-extract] OK", {
      user_id: user.id,
      transcription_len: transcription.length,
      finish_reason: firstCandidate.finishReason,
      prompt_tokens: usage?.promptTokenCount ?? 0,
      output_tokens: usage?.candidatesTokenCount ?? 0,
      total_tokens: usage?.totalTokenCount ?? 0,
    });

    return json(parsed, 200);
  } catch (err) {
    const e = err as { name?: string; message?: string };
    console.error("[voice-extract] Internal error:", err);
    if (e?.name === "AbortError") {
      return json({ error: "Délai d'attente dépassé (30s) côté API Gemini" }, 504);
    }
    return json({
      error: "Erreur interne lors de l'extraction vocale",
      detail: e?.message || String(err),
    }, 500);
  }
});
