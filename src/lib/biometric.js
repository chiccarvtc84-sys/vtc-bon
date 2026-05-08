// ============================================================================
// biometric.js — wrapper Face ID / Touch ID pour TrajetPro
// ============================================================================
// Plugin : @aparajita/capacitor-biometric-auth (Capacitor 7)
//
// Sur le WEB (Vite dev) : `isAvailable()` retourne false → tous les helpers
// font des no-op gracieux pour ne pas casser le développement local.
//
// Sur iOS : utilise Face ID si dispo, sinon Touch ID, sinon code passcode
// (LAPolicyDeviceOwnerAuthentication).
// Sur Android : utilise BiometricPrompt API (empreinte / face / iris selon
// device) avec fallback PIN/pattern si biométrie indisponible.
//
// Architecture :
//   - L'utilisateur active la biométrie depuis Profil → Préférences → Biométrie
//   - On stocke un flag `biometric_enabled` dans Capacitor Preferences
//   - Au prochain démarrage de l'app : si flag=true ET session Supabase
//     valide en cache, on prompt Face ID AVANT de laisser l'utilisateur
//     accéder à l'écran d'accueil. Si refus → fallback login email/password.
//
// Sécurité :
//   - On ne stocke JAMAIS de mot de passe ou token sensible avec la
//     biométrie : Supabase gère déjà sa propre session (refresh_token chiffré
//     dans le storage par leur SDK). On ajoute juste un verrou "ouverture
//     de l'app" qui empêche un voleur de téléphone d'accéder aux données.
// ============================================================================

import { BiometricAuth, BiometryType } from '@aparajita/capacitor-biometric-auth';
import { isNativePlatform, preferencesGet, preferencesSet } from './platform.js';

const PREF_KEY_ENABLED = 'biometric_enabled';
// L'ID du user TrajetPro qui a activé la biométrie sur cet appareil.
// On le stocke pour empêcher la reconnexion automatique vers un AUTRE
// compte (ex : utilisateur qui se déconnecte puis fait Sign-in with Apple
// avec un Apple ID différent → on doit bloquer la nouvelle session car
// l'appareil est verrouillé pour le compte d'origine).
const PREF_KEY_USER_ID = 'biometric_user_id';

/**
 * Vrai si l'appareil supporte la biométrie ET qu'au moins une empreinte
 * digitale ou un visage est enregistré dans les réglages système.
 */
export async function isBiometricAvailable() {
  if (!isNativePlatform()) return false;
  try {
    const { isAvailable } = await BiometricAuth.checkBiometry();
    return Boolean(isAvailable);
  } catch (_err) {
    return false;
  }
}

/**
 * Renvoie le type de biométrie disponible pour personnaliser le label
 * dans l'UI : "Face ID" / "Touch ID" / "Biométrie" générique.
 */
export async function getBiometryLabel() {
  if (!isNativePlatform()) return 'Biométrie (mobile uniquement)';
  try {
    const { biometryType } = await BiometricAuth.checkBiometry();
    switch (biometryType) {
      case BiometryType.faceId: return 'Face ID';
      case BiometryType.touchId: return 'Touch ID';
      case BiometryType.faceAuthentication: return 'Reconnaissance faciale';
      case BiometryType.fingerprintAuthentication: return 'Empreinte digitale';
      case BiometryType.irisAuthentication: return 'Reconnaissance d\'iris';
      default: return 'Biométrie';
    }
  } catch (_err) {
    return 'Biométrie';
  }
}

/**
 * Vrai si l'utilisateur a activé la biométrie via la page Préférences.
 * Lu depuis Capacitor Preferences (clé `biometric_enabled`).
 */
export async function isBiometricEnabled() {
  const v = await preferencesGet(PREF_KEY_ENABLED);
  return v === 'true';
}

/**
 * Active la biométrie ET la lie à un user TrajetPro spécifique.
 *
 * @param {string} userId — UUID du user TrajetPro actuellement connecté.
 *   Stocké dans Capacitor Preferences pour qu'au prochain login, on
 *   puisse vérifier que c'est BIEN le même compte qui revient (et pas
 *   un autre Apple ID via iCloud Keychain ou un compte email différent).
 *
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function enableBiometric(userId) {
  if (!isNativePlatform()) {
    return { ok: false, reason: 'La biométrie n\'est disponible que sur iPhone et Android.' };
  }
  if (!userId) {
    return { ok: false, reason: 'Activation impossible : aucun utilisateur connecté.' };
  }
  const available = await isBiometricAvailable();
  if (!available) {
    return {
      ok: false,
      reason: 'Aucune empreinte ou Face ID configuré sur cet appareil. Ouvrez Réglages → Face ID & code pour en ajouter.',
    };
  }
  try {
    await BiometricAuth.authenticate({
      reason: 'Confirmer l\'activation de la biométrie pour TrajetPro',
      cancelTitle: 'Annuler',
      allowDeviceCredential: true, // fallback PIN/passcode si biométrie échoue 3x
      iosFallbackTitle: 'Utiliser le code',
      androidTitle: 'Activer la biométrie',
      androidSubtitle: 'TrajetPro · sécurisez l\'ouverture de votre app',
      androidConfirmationRequired: false,
    });
    await preferencesSet(PREF_KEY_ENABLED, 'true');
    await preferencesSet(PREF_KEY_USER_ID, String(userId));
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err?.message || 'Activation annulée.',
    };
  }
}

/**
 * Désactive la biométrie ET supprime le binding au user. Appeler ça
 * quand l'utilisateur désactive l'option dans les Préférences OU quand
 * il supprime son compte. Ne PAS l'appeler sur un simple logout volontaire :
 * on veut que Face ID continue à reconnaître le compte au prochain login.
 */
export async function disableBiometric() {
  await preferencesSet(PREF_KEY_ENABLED, 'false');
  await preferencesSet(PREF_KEY_USER_ID, '');
}

/**
 * Renvoie le UUID du user lié à la biométrie sur cet appareil, ou null
 * si la biométrie n'est pas activée. Utilisé au login pour vérifier que
 * le user qui revient est bien celui qui avait activé Face ID.
 */
export async function getBiometricUserId() {
  const enabled = await isBiometricEnabled();
  if (!enabled) return null;
  const v = await preferencesGet(PREF_KEY_USER_ID);
  return v || null;
}

/**
 * Demande à l'utilisateur de s'authentifier avec sa biométrie (par
 * exemple au démarrage de l'app, après un session restore Supabase).
 *
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function verifyBiometric() {
  if (!isNativePlatform()) return { ok: true }; // no-op sur web
  const enabled = await isBiometricEnabled();
  if (!enabled) return { ok: true }; // pas de check si fonctionnalité off

  try {
    await BiometricAuth.authenticate({
      reason: 'Authentifiez-vous pour ouvrir TrajetPro',
      cancelTitle: 'Annuler',
      allowDeviceCredential: true,
      iosFallbackTitle: 'Utiliser le code',
      androidTitle: 'Authentification requise',
      androidSubtitle: 'TrajetPro · accédez à votre compte',
      androidConfirmationRequired: false,
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err?.message || 'Authentification annulée.',
    };
  }
}
