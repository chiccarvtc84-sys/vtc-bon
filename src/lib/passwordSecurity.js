// ============================================================================
// passwordSecurity.js
// ============================================================================
// Équivalent gratuit du "Leaked Password Protection" de Supabase Auth Pro :
//
// 1. checkPasswordStrength(password) : retourne un score + raisons (longueur,
//    diversité, motifs faibles). Léger, 100% local.
//
// 2. isPasswordPwned(password) : interroge l'API HaveIBeenPwned avec le
//    protocole k-anonymity (gratuit, sans clé, sans rate limit serveur) :
//      - hash SHA-1 du mot de passe (le SHA-1 N'EST PAS envoyé au serveur)
//      - on envoie SEULEMENT les 5 premiers caractères du hash
//      - le serveur retourne la liste des suffixes matchants
//      - on compare localement → on sait si le hash complet est dans la fuite
//        SANS jamais envoyer le mot de passe ni son hash complet.
//
// Référence : https://haveibeenpwned.com/API/v3#PwnedPasswords
//
// Usage dans SignupScreen :
//   import { checkPasswordStrength, isPasswordPwned } from '../lib/passwordSecurity.js';
//   const strength = checkPasswordStrength(form.password);
//   if (!strength.ok) { setError(strength.reason); return; }
//   const pwned = await isPasswordPwned(form.password);
//   if (pwned) { setError("Mot de passe trop courant — choisissez-en un autre"); return; }
// ============================================================================

/**
 * Évalue rapidement la force d'un mot de passe (avant l'appel HIBP).
 * Renvoie { ok, score (0-4), reason } — ne bloque pas les mots de passe
 * simples mais valides ; bloque uniquement les patterns évidents.
 */
export function checkPasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { ok: false, score: 0, reason: 'Mot de passe requis' };
  }
  if (password.length < 8) {
    return { ok: false, score: 0, reason: 'Mot de passe : 8 caractères minimum' };
  }
  if (password.length > 200) {
    // Limite de Supabase Auth = 72 caractères pour bcrypt, mais on autorise
    // jusqu'à 200 pour les passphrases longues. Au-delà, c'est suspect.
    return { ok: false, score: 0, reason: 'Mot de passe trop long (max 200 caractères)' };
  }

  const lower = password.toLowerCase();

  // Blacklist locale des mots de passe les plus utilisés (top 30 FR/EN)
  const obviousList = new Set([
    'password', 'motdepasse', 'azerty', 'azerty123', 'qwerty', 'qwerty123',
    '12345678', '123456789', '1234567890', 'azertyuiop', 'qwertyuiop',
    '00000000', '11111111', 'abcdefgh', 'iloveyou', 'admin123', 'letmein',
    'welcome1', 'monkey123', 'dragon123', 'football', 'baseball',
    'sunshine', 'master12', 'trustno1', 'soleil12', 'bonjour1', 'bonsoir1',
    'password1', 'password123',
  ]);
  if (obviousList.has(lower)) {
    return { ok: false, score: 1, reason: 'Mot de passe trop courant. Choisissez-en un plus original.' };
  }

  // Blacklist contextuelle TrajetPro
  const appWords = ['trajetpro', 'trajet', 'chauffeur', 'vtc', 'taxi', 'sorgues', 'avignon'];
  for (const w of appWords) {
    if (lower === w || lower === w + '123' || lower === w + '2024' || lower === w + '2025' || lower === w + '2026') {
      return { ok: false, score: 1, reason: 'Évitez les mots de passe basés sur le nom de l\'app ou votre ville.' };
    }
  }

  // Score de diversité : longueur + nb de classes de caractères
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  let classes = 0;
  if (/[a-z]/.test(password)) classes++;
  if (/[A-Z]/.test(password)) classes++;
  if (/\d/.test(password)) classes++;
  if (/[^A-Za-z0-9]/.test(password)) classes++;
  if (classes >= 2) score++;
  if (classes >= 3) score++;

  // On autorise tout dès lors que ce n'est pas dans la blacklist —
  // le check final HIBP est la vraie garde-fou.
  return { ok: true, score, reason: null };
}

/**
 * Calcule SHA-1 d'une chaîne et retourne le hex en MAJUSCULES (format HIBP).
 * Utilise crypto.subtle (Web Crypto API) — disponible en Vite/Capacitor WebView
 * sur HTTPS et localhost. SHA-1 est ici utilisé UNIQUEMENT pour interroger
 * HIBP, pas pour stocker le mot de passe.
 */
async function sha1Hex(input) {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-1', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Interroge HaveIBeenPwned via le protocole k-anonymity.
 * Retourne `true` si le mot de passe est dans une fuite connue.
 * Retourne `false` si non trouvé OU si l'API est inaccessible (fail-open
 * pour ne pas bloquer le signup en cas de panne réseau).
 *
 * Aucune clé API requise. Pas de rate limit pour l'usage normal.
 * En-tête `Add-Padding: true` pour éviter le timing attack.
 */
export async function isPasswordPwned(password) {
  if (!password) return false;
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const res = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      { headers: { 'Add-Padding': 'true' } },
    );
    if (!res.ok) {
      console.warn('HIBP API non disponible :', res.status);
      return false; // fail-open
    }
    const text = await res.text();
    // Réponse : suffixe:count par ligne
    const lines = text.split('\n');
    for (const line of lines) {
      const [s, count] = line.trim().split(':');
      if (s === suffix && parseInt(count || '0', 10) > 0) {
        return true;
      }
    }
    return false;
  } catch (err) {
    // Pas de réseau, sandbox WebView restrictive… on ne bloque pas le signup
    console.warn('HIBP check échoué :', err?.message);
    return false; // fail-open
  }
}
