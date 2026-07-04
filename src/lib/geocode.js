// ============================================================================
// geocode.js — Adresse texte → coordonnées GPS (lat/lng)
// ============================================================================
// Utilise Nominatim (OpenStreetMap), gratuit et SANS clé API. Politique
// d'usage OSM : usage raisonnable, 1 requête/seconde. On met chaque résultat
// en cache (mémoire + persistant via Preferences) pour ne géocoder une même
// adresse qu'UNE seule fois — l'app ne fait donc quasiment aucun appel réseau
// en régime courant (les adresses reviennent souvent : gares, hôtels…).
//
// Restreint à la France (countrycodes=fr) — app VTC française.
// Renvoie { lat, lng } ou null (adresse vide / introuvable / hors-ligne).
// ============================================================================

import { preferencesGet, preferencesSet } from './platform.js';

const memCache = new Map();      // { requête normalisée -> {lat,lng}|null }

const norm = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

export async function geocode(query) {
  const q = (query || '').trim();
  if (!q) return null;

  const key = norm(q);
  if (memCache.has(key)) return memCache.get(key);

  // Cache persistant (survit aux redémarrages de l'app).
  const storeKey = 'geo:' + key;
  try {
    const saved = await preferencesGet(storeKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      memCache.set(key, parsed);
      return parsed;
    }
  } catch { /* pas de cache dispo */ }

  try {
    const url = 'https://nominatim.openstreetmap.org/search'
      + '?format=json&limit=1&addressdetails=0&countrycodes=fr&q='
      + encodeURIComponent(q);
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('geocode http ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      memCache.set(key, null);          // évite de re-tenter une adresse vide
      return null;
    }
    const coord = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    memCache.set(key, coord);
    try { await preferencesSet(storeKey, JSON.stringify(coord)); } catch { /* best effort */ }
    return coord;
  } catch {
    // Hors-ligne ou erreur réseau : on ne cache PAS (pour retenter plus tard).
    return null;
  }
}

// Itinéraire routier réel entre 2 points (suit les routes, façon Uber) via
// OSRM (démo publique, gratuit, sans clé). Renvoie { coords: [[lat,lng]…],
// distance (m), duration (s) } ou null (échec → l'appelant retombe sur une
// ligne droite). OSRM renvoie les coordonnées en [lng, lat] : on inverse pour
// Leaflet qui attend [lat, lng].
const routeCache = new Map();

export async function routeBetween(a, b) {
  if (!a || !b) return null;
  const key = `${a.lat},${a.lng};${b.lat},${b.lng}`;
  if (routeCache.has(key)) return routeCache.get(key);
  try {
    const url = 'https://router.project-osrm.org/route/v1/driving/'
      + `${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('osrm http ' + res.status);
    const data = await res.json();
    if (data.code !== 'Ok' || !Array.isArray(data.routes) || !data.routes.length) return null;
    const r = data.routes[0];
    const coords = r.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    const out = { coords, distance: r.distance, duration: r.duration };
    routeCache.set(key, out);
    return out;
  } catch {
    return null;
  }
}
