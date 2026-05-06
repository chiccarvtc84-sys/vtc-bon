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
 * Active la biométrie : déclenche un prompt système pour vérifier que
 * l'utilisateur a bien Face ID / Touch ID configuré et fonctionnel.
 * Si l'utilisateur valide → on persiste le flag `biometric_enabled=true`.
 * Si refus / annulation → on retourne false sans rien stocker.
 *
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function enableBiometric() {
  if (!isNativePlatform()) {
    return { ok: false, reason: 'La biométrie n\'est disponible que sur iPhone et Android.' };
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
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err?.message || 'Activation annulée.',
    };
  }
}

/**
 * Désactive la biométrie : pas de prompt, juste on efface le flag.
 */
export async function disableBiometric() {
  await preferencesSet(PREF_KEY_ENABLED, 'false');
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
