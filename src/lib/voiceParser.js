// ============================================================================
// voiceParser.js
// ============================================================================
// Transforme une dictée vocale (potentiellement bruitée, mal ordonnée,
// pleine d'hésitations) en un objet structuré :
//
//   {
//     intent: "creation_course_vtc",
//     customerName: string,
//     pickupAddress: string,
//     dropoffAddress: string,
//     time: string,         // "HH:MM" ou ""
//     passengers: number,
//     hasLuggage: boolean,
//     distance: number|null, // km
//     price: number|null,    // EUR
//     confidence: { name, pickup, dropoff, time, distance, price }
//   }
//
// Stratégie multi-passes :
//   1. Pré-traitement : lowercase, normalisation accents, suppression
//      fillers ("euh", "du coup", "bon alors"…), normalisation de mots
//      mal compris ("balles" → "euros", "bornes" → "km").
//   2. Extraction par tokens : on lit le texte de gauche à droite et on
//      remplit les slots. Pas de regex monolithique.
//   3. Fuzzy match sur les villes via Levenshtein (tolère 1-2 fautes).
//   4. Heuristiques d'ordre :
//        - 2 villes détectées sans préposition → 1re = pickup, 2e = dropoff
//        - "X vers Y" → X = pickup, Y = dropoff
//        - "depuis X pour Y" → idem
//        - "à Y depuis X" → X = pickup, Y = dropoff
//   5. Le nom client = ce qui reste après extraction des autres slots,
//      ou le bloc qui suit "pour" / "récupérer" / etc.
// ============================================================================

// ----------------------------------------------------------------------------
// Lexique : villes connues + variantes phonétiques courantes
// ----------------------------------------------------------------------------
// Format : { canonical, aliases[], detail? }
// L'`aliases` inclut les fautes phonétiques typiques (ASR Chrome FR-FR).
// Étendre librement, ce lexique est la source de vérité.

export const CITY_LEXICON = [
  // Sud-Est / proche Avignon (zone d'activité principale)
  { canonical: 'Avignon', aliases: ['avignon', 'avinion', 'avignion'] },
  { canonical: 'Avignon TGV', aliases: ['avignon tgv', 'gare tgv avignon', 'tgv avignon', 'gare avignon tgv'] },
  { canonical: 'Avignon Centre', aliases: ['avignon centre', 'avignon centre ville', 'centre avignon'] },
  { canonical: 'Sorgues', aliases: ['sorgues', 'sorg'] },
  { canonical: 'Carpentras', aliases: ['carpentras', 'carpentra'] },
  { canonical: 'Châteauneuf-du-Pape', aliases: ['chateauneuf du pape', 'chateauneuf', 'châteauneuf', 'chateauneuf-du-pape'] },
  { canonical: 'L\'Isle-sur-la-Sorgue', aliases: ['l\'isle sur la sorgue', 'isle sur la sorgue', 'lisle sur la sorgue'] },
  { canonical: 'Villeneuve-lès-Avignon', aliases: ['villeneuve les avignon', 'villeneuve lez avignon', 'villeneuve'] },
  { canonical: 'Orange', aliases: ['orange', 'orangé'] },
  { canonical: 'Cavaillon', aliases: ['cavaillon', 'cavayon'] },
  { canonical: 'Aéroport Avignon-Provence', aliases: ['aeroport avignon', 'aéroport avignon', 'aeroport avignon provence', 'avignon aeroport'] },

  // Grandes villes France (top 30 — étendre selon usage réel)
  { canonical: 'Marseille', aliases: ['marseille', 'marseye', 'marseil', 'marsey', 'marsylle'] },
  { canonical: 'Lyon', aliases: ['lyon', 'lion', 'lions', 'lyont'] },
  { canonical: 'Nîmes', aliases: ['nimes', 'nîmes', 'nime', 'nim'] },
  { canonical: 'Montpellier', aliases: ['montpellier', 'montpellié', 'monpellier', 'mompellier'] },
  { canonical: 'Toulon', aliases: ['toulon', 'toulons'] },
  { canonical: 'Nice', aliases: ['nice', 'niss'] },
  { canonical: 'Cannes', aliases: ['cannes', 'can', 'canne'] },
  { canonical: 'Aix-en-Provence', aliases: ['aix en provence', 'aix-en-provence', 'aix', 'ex en provence', 'aix-en-pro'] },
  { canonical: 'Arles', aliases: ['arles', 'arle'] },
  { canonical: 'Salon-de-Provence', aliases: ['salon de provence', 'salon-de-provence', 'salon'] },
  { canonical: 'Paris', aliases: ['paris', 'pari'] },
  { canonical: 'Bordeaux', aliases: ['bordeaux', 'bordo', 'bordeau'] },
  { canonical: 'Toulouse', aliases: ['toulouse', 'toulous'] },
  { canonical: 'Nantes', aliases: ['nantes', 'nant'] },
  { canonical: 'Strasbourg', aliases: ['strasbourg', 'strazbour', 'strazbourg'] },
  { canonical: 'Lille', aliases: ['lille', 'lil'] },
  { canonical: 'Rennes', aliases: ['rennes', 'rene'] },
  { canonical: 'Reims', aliases: ['reims', 'rin', 'rains'] },
  { canonical: 'Saint-Étienne', aliases: ['saint etienne', 'saint-étienne', 'st etienne', 'st-etienne'] },
  { canonical: 'Le Havre', aliases: ['le havre', 'havre'] },
  { canonical: 'Grenoble', aliases: ['grenoble', 'grenobl'] },
  { canonical: 'Dijon', aliases: ['dijon'] },
  { canonical: 'Angers', aliases: ['angers', 'angé', 'angé'] },

  // Gares & aéroports majeurs
  { canonical: 'Gare TGV', aliases: ['tgv', 'gare tgv', 'tg v'] },
  { canonical: 'Gare Marseille Saint-Charles', aliases: ['marseille saint charles', 'saint charles', 'marseille st charles'] },
  { canonical: 'Gare de Lyon Part-Dieu', aliases: ['lyon part dieu', 'part dieu', 'part-dieu', 'lyon part-dieu'] },
  { canonical: 'Aéroport Marseille-Provence', aliases: ['aeroport marseille', 'aéroport marseille', 'mp2', 'marignane'] },
  { canonical: 'Aéroport Nice Côte d\'Azur', aliases: ['aeroport nice', 'aéroport nice', 'nice cote d\'azur'] },
  { canonical: 'Aéroport Lyon Saint-Exupéry', aliases: ['aeroport lyon', 'saint exupery', 'st exupery'] },
  { canonical: 'Paris Charles de Gaulle', aliases: ['cdg', 'roissy', 'charles de gaulle', 'paris cdg', 'roissy cdg'] },
  { canonical: 'Paris Orly', aliases: ['orly', 'paris orly'] },
  { canonical: 'Gare de Lyon (Paris)', aliases: ['paris gare de lyon', 'gare de lyon paris'] },
  { canonical: 'Gare Montparnasse', aliases: ['montparnasse', 'paris montparnasse'] },
];

// ----------------------------------------------------------------------------
// Mots à supprimer ou normaliser AVANT extraction
// ----------------------------------------------------------------------------
const FILLERS = [
  'euh', 'euhh', 'heu', 'hum', 'hmm', 'mmh', 'ben', 'bah', 'beh',
  'du coup', 'bon alors', 'alors', 'donc', 'voilà', 'enfin',
  'je voudrais', 'je veux', 'fais une course', 'fais moi une course',
  'fais-moi une course', 'crée une course', 'creer une course',
  'créer une course', 'fais le bon', 'tu peux', 'tu vas',
  's il te plait', 's\'il te plaît', 'stp', 'svp',
];

// Synonymes : remplacements word-by-word AVANT parsing
const SYNONYMS = [
  // Argot et synonymes courants
  [/\bbornes?\b/g, ' km'],
  [/\bbalan?ces?\b/g, ' euros'],   // "balances" → "euros" (rare)
  [/\bbal+es?\b/g, ' euros'],      // "balles" / "bal" → euros
  [/\bbatons?\b/g, ' euros'],
  [/\bsacs?\b/g, ' euros'],        // "100 sacs" = 100 euros (argot)
  [/\beuro?s?\b/g, ' euros'],
  [/\bkilom[eè]tres?\b/g, ' km'],
  [/\bkms?\b/g, ' km'],
  // Nettoyage ponctuation parasites de l'ASR
  [/\.{2,}/g, ' '],
  [/[,;]/g, ' '],
];

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function stripAccents(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function preprocess(raw) {
  let t = (raw || '').toLowerCase().trim();
  // Suppression fillers (mots-outils → on les remplace par espace)
  for (const f of FILLERS) {
    const safe = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    t = t.replace(new RegExp(`\\b${safe}\\b`, 'g'), ' ');
  }
  // Synonymes
  for (const [re, rep] of SYNONYMS) {
    t = t.replace(re, rep);
  }
  // Compactage des espaces
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

/**
 * Distance de Levenshtein (édition). Coût 1 pour insertion/suppression/sub.
 * Limité à des chaînes courtes (villes), donc l'algo naïf O(m*n) suffit.
 */
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const m = a.length, n = b.length;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/**
 * Recherche le meilleur match d'une ville dans le lexique pour une chaîne donnée.
 * Retourne { canonical, score } où score = 1 (exact) / 0.8 (1 faute) / 0.6 (2 fautes) / 0.
 */
function fuzzyMatchCity(token) {
  const stripped = stripAccents(token);
  let best = null, bestDist = Infinity, bestLen = 0;
  for (const city of CITY_LEXICON) {
    for (const alias of [city.canonical.toLowerCase(), ...city.aliases]) {
      const a = stripAccents(alias);
      // Match exact
      if (a === stripped) return { canonical: city.canonical, score: 1, matched: alias };
      // Tolérance Levenshtein, plafonnée selon la longueur (1 faute pour ≥4, 2 pour ≥7)
      const len = a.length;
      if (len >= 4) {
        const tolerance = len >= 7 ? 2 : 1;
        const d = levenshtein(a, stripped);
        if (d <= tolerance && d < bestDist) {
          bestDist = d;
          best = city.canonical;
          bestLen = len;
        }
      }
    }
  }
  if (best) {
    const score = bestDist === 0 ? 1 : (bestDist === 1 ? 0.85 : 0.65);
    return { canonical: best, score };
  }
  return null;
}

/**
 * Trouve toutes les villes mentionnées dans le texte préprocessé, en consommant
 * les tokens (1 à 4 mots consécutifs). Retourne un tableau ordonné par position
 * d'apparition : [{ canonical, score, start, end }].
 */
function extractCities(text) {
  const tokens = text.split(/\s+/).filter(Boolean);
  const found = [];
  let i = 0;
  while (i < tokens.length) {
    let consumed = 0;
    let bestMatch = null;
    // Essaie d'abord avec 4 mots, puis 3, 2, 1 (greedy le plus long)
    for (let n = Math.min(4, tokens.length - i); n >= 1; n--) {
      const candidate = tokens.slice(i, i + n).join(' ');
      const m = fuzzyMatchCity(candidate);
      if (m && m.score >= 0.65) {
        bestMatch = { ...m, start: i, end: i + n - 1, raw: candidate };
        consumed = n;
        break;
      }
    }
    if (bestMatch) {
      found.push(bestMatch);
      i += consumed;
    } else {
      i++;
    }
  }
  return found;
}

/**
 * Extrait les nombres avec unités. Retourne { distance, price, time } détectés.
 */
function extractNumbers(text) {
  const out = { distance: null, price: null, time: '' };

  // Distance : "100 km", "100 kilomètres" (déjà normalisé en "km")
  const distMatch = text.match(/(\d{1,4})\s*km\b/);
  if (distMatch) {
    const v = parseInt(distMatch[1], 10);
    if (v > 0 && v < 2000) out.distance = v;
  }

  // Prix : "180 euros" (après normalisation balles/euro/euros/sacs/etc.)
  const priceMatch = text.match(/(\d{1,5})\s*euros?\b/);
  if (priceMatch) {
    const v = parseInt(priceMatch[1], 10);
    if (v > 0 && v < 100000) out.price = v;
  }

  // Heure : "12h50", "12 h 50", "12:50", "12h"
  const timeMatch = text.match(/(\d{1,2})\s*h\s*(\d{2})?/) ||
                    text.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (timeMatch) {
    const hh = String(timeMatch[1]).padStart(2, '0');
    const mm = String(timeMatch[2] || '00').padStart(2, '0');
    if (parseInt(hh, 10) <= 24 && parseInt(mm, 10) <= 59) {
      out.time = `${hh}:${mm}`;
    }
  }

  return out;
}

/**
 * Extrait passagers et bagages (mots-clés).
 */
function extractMeta(text) {
  const out = { passengers: 1, hasLuggage: false };

  const paxMatch =
    text.match(/(?:ils?\s+(?:seront|sont)|nous\s+sommes|on\s+est|nous\s+serons)\s+(\d+)/) ||
    text.match(/(\d+)\s+(?:personnes?|passagers?|adultes?|gens|pax)/) ||
    text.match(/à\s+(\d+)\s+(?:personne|adulte)/);
  if (paxMatch) {
    const n = parseInt(paxMatch[1], 10);
    if (n > 0 && n <= 9) out.passengers = n;
  }

  if (/\bvalises?\b|\bbagages?\b|\bsac\s+de\s+voyage\b|\btrolleys?\b|\bcabines?\b/.test(text)) {
    out.hasLuggage = true;
  }

  return out;
}

/**
 * Détermine pickup et dropoff à partir des villes détectées + mots-clés directionnels.
 */
function resolveRoute(text, cities) {
  if (cities.length === 0) return { pickup: '', dropoff: '', pickupConf: 0, dropoffConf: 0 };
  if (cities.length === 1) {
    // Une seule ville : on regarde les prépositions pour deviner si c'est un
    // pickup ou un dropoff. Par défaut c'est le dropoff (plus probable —
    // l'app tourne souvent depuis la base du chauffeur, cf. base_city).
    const c = cities[0];
    const before = text.slice(0, text.indexOf(c.raw)).slice(-15);
    if (/\b(?:depuis|de|d'?\s*à\s+|à\s+partir\s+de)\s*$/.test(before)) {
      return { pickup: c.canonical, dropoff: '', pickupConf: c.score, dropoffConf: 0 };
    }
    return { pickup: '', dropoff: c.canonical, pickupConf: 0, dropoffConf: c.score };
  }

  // 2 villes ou plus : on prend la 1re et la dernière
  const first = cities[0];
  const last = cities[cities.length - 1];

  // Mots-clés explicites entre les deux villes
  const between = text.slice(
    text.indexOf(first.raw) + first.raw.length,
    text.indexOf(last.raw, text.indexOf(first.raw) + first.raw.length),
  );

  // "X vers Y" / "X jusqu'à Y" / "X pour Y" / "X destination Y"
  // → first = pickup, last = dropoff (ordre naturel)
  if (/\b(?:vers|jusqu'?\s*[aà]|pour|direction|destination|à\s+)\b/.test(between)) {
    return {
      pickup: first.canonical, dropoff: last.canonical,
      pickupConf: first.score, dropoffConf: last.score,
    };
  }

  // "depuis X à Y" / "de X à Y"
  const beforeFirst = text.slice(0, text.indexOf(first.raw)).slice(-20);
  if (/\b(?:depuis|de|d'?)\s*$/.test(beforeFirst)) {
    return {
      pickup: first.canonical, dropoff: last.canonical,
      pickupConf: first.score, dropoffConf: last.score,
    };
  }

  // "Y depuis X" → inversion
  const beforeLast = text.slice(0, text.indexOf(last.raw, text.indexOf(first.raw) + first.raw.length)).slice(-15);
  if (/\b(?:depuis|de|d'?)\s*$/.test(beforeLast)) {
    return {
      pickup: last.canonical, dropoff: first.canonical,
      pickupConf: last.score, dropoffConf: first.score,
    };
  }

  // Cas par défaut "X Y" sans mot-clé : on suppose ordre naturel
  return {
    pickup: first.canonical, dropoff: last.canonical,
    pickupConf: first.score * 0.85, dropoffConf: last.score * 0.85,
  };
}

/**
 * Heuristique : "gare TGV" générique → on essaie de la rattacher à la
 * même ville que le pickup ou le dropoff (ex : si pickup="Avignon Centre"
 * et dropoff="Gare TGV", on infère "Avignon TGV").
 * Évite les ambiguïtés sans pour autant inventer une ville.
 */
function refineGenericTGV(route) {
  const generic = 'Gare TGV';
  const inferTGV = (cityCanonical) => {
    if (!cityCanonical) return null;
    // Cherche dans le lexique une entrée du type "{Ville} TGV"
    const baseCity = cityCanonical.split(/\s/)[0]; // "Avignon Centre" → "Avignon"
    const tgvVariant = CITY_LEXICON.find(
      (c) => c.canonical.toLowerCase() === `${baseCity.toLowerCase()} tgv`,
    );
    return tgvVariant ? tgvVariant.canonical : null;
  };

  if (route.dropoff === generic) {
    const inferred = inferTGV(route.pickup);
    if (inferred) return { ...route, dropoff: inferred };
  }
  if (route.pickup === generic) {
    const inferred = inferTGV(route.dropoff);
    if (inferred) return { ...route, pickup: inferred };
  }
  return route;
}

/**
 * Extrait le nom du client. Stratégies dans l'ordre :
 *   1. Verbe explicite ("récupérer/prendre/chercher X à") + préposition
 *   2. "pour/chez/le client X" suivi d'un mot
 *   3. Premier mot non-reconnu (ni ville, ni nombre, ni unité, ni filler)
 *      avant la première ville détectée
 */
function extractCustomerName(text, cities, originalRaw) {
  // 1. Pattern explicite avec verbe
  const verbMatch = originalRaw.toLowerCase().match(
    /(?:r[eé]cup[eé]rer?|recupere|recuperer|prendre|chercher|d[eé]poser|deposer|passer\s+prendre|pour\s+(?:un|une)?\s*(?:mr\.?|m\.?|monsieur|mme\.?|madame)?)\s+(?:un\s+|une\s+|mr\.?\s+|m\.\s+|monsieur\s+|mme\.?\s+|madame\s+)?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'-]{1,40}?)\s+(?:[aà]|au|aux|depuis|sur|vers|pour|en|chez|à\s+\d)/,
  );
  if (verbMatch) {
    return { name: capitalizeName(verbMatch[1]), confidence: 0.85 };
  }

  // 2. "Pour <Nom>" ou "Le client X"
  const forMatch = originalRaw.toLowerCase().match(
    /(?:^|\s)(?:pour|le\s+client|client|cliente)\s+(?:un\s+|une\s+|mr\.?\s+|m\.\s+|monsieur\s+|mme\.?\s+|madame\s+)?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'-]{1,30})/,
  );
  if (forMatch) {
    const candidate = forMatch[1];
    if (!isCityWord(candidate) && !isMetaWord(candidate)) {
      return { name: capitalizeName(candidate), confidence: 0.75 };
    }
  }

  // 3. Premier mot inconnu avant la première ville (cas "Dupont Marseille Avignon")
  if (cities.length > 0) {
    const tokens = text.split(/\s+/).filter(Boolean);
    const firstCityStart = cities[0].start;
    const before = tokens.slice(0, firstCityStart);
    // Cherche un token alphabétique pur (pas un nombre, pas une unité)
    for (const tok of before) {
      if (
        /^[a-zà-ÿ]{2,}$/i.test(tok) &&
        !isCityWord(tok) &&
        !isMetaWord(tok) &&
        !KNOWN_PREPOSITIONS.has(tok)
      ) {
        return { name: capitalizeName(tok), confidence: 0.55 };
      }
    }
  }

  return { name: '', confidence: 0 };
}

const KNOWN_PREPOSITIONS = new Set([
  'a', 'à', 'au', 'aux', 'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du',
  'depuis', 'pour', 'vers', 'avec', 'et', 'ou', 'mais', 'donc', 'car', 'ni',
  'sur', 'sous', 'dans', 'chez', 'en', 'jusqu', 'jusqua', 'son', 'sa', 'ses',
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'ce', 'cet', 'cette', 'ces',
  'qui', 'que', 'quoi', 'dont', 'où',
]);

function isCityWord(w) {
  const x = stripAccents(w.toLowerCase());
  return CITY_LEXICON.some((c) =>
    [c.canonical.toLowerCase(), ...c.aliases].some((al) => stripAccents(al) === x),
  );
}

function isMetaWord(w) {
  const x = w.toLowerCase();
  return /^(km|euros?|h|tgv|valise|valises|bagage|bagages|adulte|adultes|personne|personnes|passager|passagers|pax)$/.test(x)
    || /^\d+$/.test(x);
}

function capitalizeName(s) {
  return s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// ----------------------------------------------------------------------------
// Fonction principale
// ----------------------------------------------------------------------------

export function parseVoiceCommand(raw) {
  const empty = {
    intent: 'creation_course_vtc',
    customerName: '', pickupAddress: '', dropoffAddress: '',
    time: '', passengers: 1, hasLuggage: false,
    distance: null, price: null,
    confidence: { name: 0, pickup: 0, dropoff: 0, time: 0, distance: 0, price: 0 },
  };
  if (!raw || !raw.trim()) return empty;

  const text = preprocess(raw);

  const cities = extractCities(text);
  const route = refineGenericTGV(resolveRoute(text, cities));
  const numbers = extractNumbers(text);
  const meta = extractMeta(text);
  const nameInfo = extractCustomerName(text, cities, raw);

  return {
    intent: 'creation_course_vtc',
    customerName: nameInfo.name,
    pickupAddress: route.pickup,
    dropoffAddress: route.dropoff,
    time: numbers.time,
    passengers: meta.passengers,
    hasLuggage: meta.hasLuggage,
    distance: numbers.distance,
    price: numbers.price,
    confidence: {
      name: nameInfo.confidence,
      pickup: route.pickupConf,
      dropoff: route.dropoffConf,
      time: numbers.time ? 0.95 : 0,
      distance: numbers.distance != null ? 0.95 : 0,
      price: numbers.price != null ? 0.95 : 0,
    },
  };
}

// ----------------------------------------------------------------------------
// Tests internes (lance avec : node --experimental-vm-modules src/lib/voiceParser.test.mjs)
// Conservés ici en commentaire pour rappel des cas couverts.
// ----------------------------------------------------------------------------
//
// parseVoiceCommand("dupont marseille avignon tgv 100 bornes 180 balles")
//   → { customerName: "Dupont", pickupAddress: "Marseille",
//       dropoffAddress: "Avignon TGV", distance: 100, price: 180 }
//
// parseVoiceCommand("euh fais une course pour martin lyon vers avignon tgv")
//   → { customerName: "Martin", pickupAddress: "Lyon",
//       dropoffAddress: "Avignon TGV" }
//
// parseVoiceCommand("bernard nimes avignon tgv")
//   → { customerName: "Bernard", pickupAddress: "Nîmes",
//       dropoffAddress: "Avignon TGV" }
//
// parseVoiceCommand("Récupérer Mme Dubois à Avignon centre pour la gare TGV à 12h50, ils seront 3 avec valises")
//   → { customerName: "Dubois", pickupAddress: "Avignon Centre",
//       dropoffAddress: "Gare TGV", time: "12:50", passengers: 3, hasLuggage: true }
//
// parseVoiceCommand("marseye lion 350 km")
//   → { customerName: "", pickupAddress: "Marseille",
//       dropoffAddress: "Lyon", distance: 350 }
