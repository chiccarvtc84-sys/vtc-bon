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
 * Évalue la validité d'un mot de passe — règles MINIMALES (choix utilisateur) :
 *   - au moins 8 caractères
 *   - au moins 1 lettre
 *   - au moins 1 chiffre
 *
 * Pas de blacklist, pas de check de mots-clés contextuels, pas de pattern
 * de complexité. Le bcrypt côté Supabase + la vérif email + l'anti-fraude
 * device assurent la sécurité réelle du compte.
 */
export function checkPasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { ok: false, score: 0, reason: 'Mot de passe requis' };
  }
  if (password.length < 8) {
    return { ok: false, score: 0, reason: 'Mot de passe : 8 caractères minimum' };
  }
  if (password.length > 200) {
    // Limite bcrypt = 72 chars, on autorise jusqu'à 200 pour les passphrases.
    return { ok: false, score: 0, reason: 'Mot de passe trop long (max 200 caractères)' };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { ok: false, score: 0, reason: 'Mot de passe : au moins une lettre' };
  }
  if (!/\d/.test(password)) {
    return { ok: false, score: 0, reason: 'Mot de passe : au moins un chiffre' };
  }

  return { ok: true, score: 3, reason: null };
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
