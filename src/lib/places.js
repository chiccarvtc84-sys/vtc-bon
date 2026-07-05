// ============================================================================
// places.js — Recherche d'adresses intelligente (façon Uber Driver / Bolt)
// ============================================================================
// Basée sur Nominatim (OpenStreetMap), gratuit & sans clé — déjà utilisé par
// TrajetPro. Chaque résultat est enrichi : catégorie (gare / aéroport / hôtel
// / santé / restaurant / commerce…), distance depuis la position de
// l'utilisateur, temps voiture estimé, puis trié par PERTINENCE pondérée par
// la PROXIMITÉ (un grand POI proche remonte au-dessus d'une correspondance
// lointaine). Les résultats sont biaisés autour de la position GPS via le
// `viewbox` Nominatim. Historique (récentes / favorites) persisté via
// Capacitor Preferences.
//
// Le jour où l'on prend une clé Google Places / Mapbox, seul ce fichier change.
// ============================================================================

import { preferencesGet, preferencesSet } from './platform.js';

// Repli quand le GPS n'est pas disponible : base du chauffeur (Sorgues, 84).
export const FALLBACK_CENTER = { lat: 44.0066, lng: 4.8725 };

// Distance à vol d'oiseau (km) entre deux points {lat,lng}.
export function distanceKm(a, b) {
  if (!a || !b) return null;
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Temps voiture estimé (min) SANS appel réseau — faire un routage OSRM par
// résultat serait trop d'appels. Vitesse moyenne réaliste par palier
// (ville → départementale → voie rapide → autoroute).
export function etaMinutes(km) {
  if (km == null) return null;
  const kmh = km < 3 ? 22 : km < 15 ? 38 : km < 40 ? 62 : 88;
  return Math.max(1, Math.round((km / kmh) * 60));
}

export function fmtDistance(km) {
  if (km == null) return null;
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}

// Catégorie (clé d'icône + libellé) déduite de class/type Nominatim.
export function placeCategory(cls, type) {
  const k = `${cls || ''}/${type || ''}`;
  const has = (...xs) => xs.some((x) => k.includes(x));
  if (has('railway/station', 'railway/halt', 'public_transport/station')) return { key: 'train', label: 'Gare' };
  if (has('aeroway', 'aerodrome', 'airport', 'terminal')) return { key: 'plane', label: 'Aéroport' };
  if (has('tourism/hotel', 'tourism/motel', 'tourism/guest_house', 'tourism/hostel', 'tourism/apartment')) return { key: 'hotel', label: 'Hôtel' };
  if (has('hospital', 'clinic', 'healthcare', 'doctors', 'pharmacy')) return { key: 'hospital', label: 'Santé' };
  if (has('restaurant', 'fast_food', 'cafe', '/bar', '/pub', 'food_court')) return { key: 'food', label: 'Restaurant' };
  if (has('shop/mall', 'shop/department_store', 'shop/supermarket', 'marketplace')) return { key: 'shopping', label: 'Centre commercial' };
  if (has('shop/')) return { key: 'shopping', label: 'Boutique' };
  if (has('fuel', 'charging_station')) return { key: 'fuel', label: 'Station' };
  if (has('school', 'university', 'college', 'kindergarten')) return { key: 'school', label: 'Éducation' };
  if (has('place_of_worship', 'historic', 'tourism/attraction', 'tourism/museum', 'monument', 'castle')) return { key: 'landmark', label: 'Lieu' };
  if (has('place/city', 'place/town', 'place/village', 'place/hamlet', 'place/suburb', 'boundary/administrative')) return { key: 'city', label: 'Ville' };
  if (has('building/house', 'place/house', 'building/residential')) return { key: 'home', label: 'Adresse' };
  if (has('office', 'amenity/')) return { key: 'business', label: 'Établissement' };
  return { key: 'default', label: 'Adresse' };
}

function primaryName(r) {
  if (r.name) return r.name;
  const a = r.address || {};
  if (a.road) return a.house_number ? `${a.house_number} ${a.road}` : a.road;
  if (a.pedestrian) return a.pedestrian;
  return (r.display_name || '').split(',')[0];
}

function cityOf(a = {}) {
  return a.city || a.town || a.village || a.municipality || a.county || '';
}

function secondaryAddress(r) {
  const a = r.address || {};
  const city = cityOf(a);
  const parts = [];
  if (r.name && a.road) parts.push(a.house_number ? `${a.house_number} ${a.road}` : a.road);
  else if (a.suburb && a.suburb !== city) parts.push(a.suburb);
  const cp = `${a.postcode || ''} ${city}`.trim();
  if (cp) parts.push(cp);
  if (!parts.length) return (r.display_name || '').split(',').slice(1, 3).join(',').trim();
  return parts.filter(Boolean).join(' · ');
}

// Chaîne d'adresse "propre" à stocker dans le bon (re-géocodable pour la carte).
function storableValue(r) {
  const city = cityOf(r.address);
  const nm = primaryName(r);
  if (r.name && city && !nm.toLowerCase().includes(city.toLowerCase())) return `${nm}, ${city}`;
  return nm;
}

const searchCache = new Map(); // "requête@centre" -> résultats

const norm = (s) => (s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Mots-CATÉGORIE : quand l'utilisateur tape juste "gare" / "aéroport" / etc.,
// on ne fait PAS une recherche texte (qui remonterait des rues nommées "Gare")
// mais on interroge Overpass pour les vrais POI de ce type AUTOUR de lui,
// triés par proximité — exactement le comportement Uber/Google Maps.
const CATEGORY_QUERIES = [
  { keys: ['gare', 'train', 'sncf', 'tgv'], filters: ['["railway"="station"]', '["railway"="halt"]'], radius: 60000, cat: { key: 'train', label: 'Gare' } },
  { keys: ['aeroport', 'airport', 'avion'], filters: ['["aeroway"="aerodrome"]'], radius: 160000, cat: { key: 'plane', label: 'Aéroport' } },
  { keys: ['hopital', 'hospital', 'urgence', 'urgences', 'clinique'], filters: ['["amenity"="hospital"]', '["amenity"="clinic"]'], radius: 45000, cat: { key: 'hospital', label: 'Hôpital' } },
  { keys: ['hotel'], filters: ['["tourism"="hotel"]'], radius: 25000, cat: { key: 'hotel', label: 'Hôtel' } },
  { keys: ['restaurant', 'resto'], filters: ['["amenity"="restaurant"]'], radius: 15000, cat: { key: 'food', label: 'Restaurant' } },
  { keys: ['centre commercial', 'centre-commercial', 'mall', 'galerie marchande'], filters: ['["shop"="mall"]', '["shop"="department_store"]'], radius: 45000, cat: { key: 'shopping', label: 'Centre commercial' } },
  { keys: ['pharmacie'], filters: ['["amenity"="pharmacy"]'], radius: 15000, cat: { key: 'hospital', label: 'Pharmacie' } },
  { keys: ['supermarche', 'supermarché'], filters: ['["shop"="supermarket"]'], radius: 20000, cat: { key: 'shopping', label: 'Supermarché' } },
  { keys: ['station', 'essence', 'carburant', 'station-service'], filters: ['["amenity"="fuel"]'], radius: 25000, cat: { key: 'fuel', label: 'Station-service' } },
  { keys: ['ecole', 'lycee', 'college', 'universite', 'fac'], filters: ['["amenity"~"school|college|university"]'], radius: 25000, cat: { key: 'school', label: 'Éducation' } },
];

function detectCategory(query) {
  const q = norm(query);
  return CATEGORY_QUERIES.find((c) => c.keys.some((k) => { const nk = norm(k); return q === nk || q === nk + 's'; })) || null;
}

// Recherche par catégorie via Overpass (POI du bon type autour de `center`).
async function searchByCategory(cfg, center, signal) {
  const clauses = cfg.filters
    .flatMap((f) => [`node${f}(around:${cfg.radius},${center.lat},${center.lng});`, `way${f}(around:${cfg.radius},${center.lat},${center.lng});`])
    .join('');
  const ql = `[out:json][timeout:12];(${clauses});out center 60;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(ql),
  });
  if (!res.ok) throw new Error('overpass http ' + res.status);
  const data = await res.json();
  const els = (data.elements || []).map((e) => {
    const pos = e.type === 'node' ? { lat: e.lat, lng: e.lon } : (e.center ? { lat: e.center.lat, lng: e.center.lon } : null);
    if (!pos) return null;
    const tags = e.tags || {};
    const name = tags.name || tags['name:fr'] || cfg.cat.label;
    const city = tags['addr:city'] || '';
    const addr = [tags['addr:street'], [tags['addr:postcode'], city].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
    const dist = distanceKm(center, pos);
    return {
      id: `${e.type}/${e.id}`,
      lat: pos.lat, lng: pos.lng,
      name,
      address: addr,
      value: city && !name.toLowerCase().includes(city.toLowerCase()) ? `${name}, ${city}` : name,
      category: cfg.cat,
      distanceKm: dist,
      etaMin: etaMinutes(dist),
      importance: 0,
    };
  }).filter(Boolean);
  // Tri par proximité (le plus proche d'abord — c'est tout l'intérêt) + dédup.
  els.sort((a, b) => (a.distanceKm ?? 9e9) - (b.distanceKm ?? 9e9));
  const seen = new Set();
  const out = [];
  for (const r of els) { const k = r.name.toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push(r); if (out.length >= 8) break; }
  return out;
}

// Recherche texte classique (adresse / lieu précis) via Nominatim.
async function nominatimSearch(q, center, signal) {
  const d = 1.4; // viewbox ~150 km → biais de proximité souple (bounded=0)
  const viewbox = [center.lng - d, center.lat + d, center.lng + d, center.lat - d].join(',');
  const url = 'https://nominatim.openstreetmap.org/search'
    + '?format=jsonv2&addressdetails=1&limit=20&countrycodes=fr&dedupe=1'
    + `&viewbox=${encodeURIComponent(viewbox)}&bounded=0&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('places http ' + res.status);
  const data = await res.json();
  if (!Array.isArray(data)) return [];

  const enriched = data.map((r) => {
    const pos = { lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
    const dist = distanceKm(center, pos);
    return {
      id: String(r.place_id),
      lat: pos.lat, lng: pos.lng,
      name: primaryName(r),
      address: secondaryAddress(r),
      value: storableValue(r),
      category: placeCategory(r.class, r.type),
      distanceKm: dist,
      etaMin: etaMinutes(dist),
      importance: r.importance || 0,
    };
  });
  // Score (bas = mieux) : distance + malus de non-pertinence (jusqu'à 14 km).
  const score = (r) => (r.distanceKm ?? 500) + (1 - (r.importance || 0)) * 14;
  enriched.sort((a, b) => score(a) - score(b));
  const seen = new Set();
  const out = [];
  for (const r of enriched) {
    const key = `${r.name.toLowerCase()}|${(r.address || '').toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
    if (out.length >= 8) break;
  }
  return out;
}

// Recherche principale. `near` = {lat,lng} de l'utilisateur (ou null → repli).
// Aiguille vers Overpass (catégorie proche) ou Nominatim (adresse précise).
export async function searchPlaces(query, near, signal) {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  const center = near || FALLBACK_CENTER;
  const cacheKey = `${q.toLowerCase()}@${center.lat.toFixed(2)},${center.lng.toFixed(2)}`;
  if (searchCache.has(cacheKey)) return searchCache.get(cacheKey);

  const cfg = detectCategory(q);
  let out = [];
  if (cfg) {
    try { out = await searchByCategory(cfg, center, signal); }
    catch (e) { if (e && e.name === 'AbortError') throw e; out = []; }
    // Repli sur Nominatim si Overpass vide / en erreur.
    if (!out.length) out = await nominatimSearch(q, center, signal);
  } else {
    out = await nominatimSearch(q, center, signal);
  }
  searchCache.set(cacheKey, out);
  return out;
}

// ─── Historique : récentes + favorites (persisté via Preferences) ───────────
const RECENT_KEY = 'places_recent';
const FAV_KEY = 'places_favorites';

async function loadList(key) {
  try { const raw = await preferencesGet(key); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
async function saveList(key, list) {
  try { await preferencesSet(key, JSON.stringify(list.slice(0, 12))); } catch { /* best effort */ }
}
const slim = (p) => ({
  name: p.name, address: p.address || '', value: p.value || p.name,
  lat: p.lat ?? null, lng: p.lng ?? null,
  category: p.category || { key: 'default', label: 'Adresse' },
});

export const loadRecents = () => loadList(RECENT_KEY);
export const loadFavorites = () => loadList(FAV_KEY);

export async function addRecent(place) {
  if (!place || !place.value) return loadList(RECENT_KEY);
  const s = slim(place);
  const list = await loadList(RECENT_KEY);
  const next = [s, ...list.filter((x) => x.value !== s.value)];
  await saveList(RECENT_KEY, next);
  return next;
}
export async function toggleFavorite(place) {
  const s = slim(place);
  const list = await loadList(FAV_KEY);
  const exists = list.some((x) => x.value === s.value);
  const next = exists ? list.filter((x) => x.value !== s.value) : [s, ...list];
  await saveList(FAV_KEY, next);
  return next;
}
export function isFavorite(favList, place) {
  const v = place.value || place.name;
  return (favList || []).some((x) => x.value === v);
}
