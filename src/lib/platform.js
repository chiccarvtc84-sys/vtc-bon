// ============================================================================
// platform.js — Helpers cross-platform (web + Capacitor iOS/Android)
// ============================================================================
// Le code React est exécuté à la fois en web (Vite dev server) et dans la
// WebView Capacitor (iOS / Android). Ce module isole les imports natifs
// pour qu'ils ne plantent pas en web.
//
// Convention : on utilise dynamic import() à l'intérieur des fonctions pour
// éviter d'inclure les SDK Capacitor dans le bundle web. En web, la fonction
// renvoie une valeur par défaut sans tenter d'appeler le natif.
// ============================================================================

import { Capacitor } from '@capacitor/core';

export const isNativePlatform = () => Capacitor.isNativePlatform();
export const platformName = () => Capacitor.getPlatform(); // 'web' | 'ios' | 'android'

/**
 * Souscrit aux changements de connexion réseau.
 * @param {(connected: boolean) => void} callback
 * @returns {() => void} unsubscribe
 */
export async function watchNetwork(callback) {
  // En web on utilise navigator.onLine, suffisant pour Vite dev
  if (!isNativePlatform()) {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return () => {};
    }
    const onlineHandler = () => callback(true);
    const offlineHandler = () => callback(false);
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    callback(navigator.onLine);
    return () => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  }

  // En natif : @capacitor/network donne le vrai état (Wi-Fi / cellulaire)
  const { Network } = await import('@capacitor/network');
  const status = await Network.getStatus();
  callback(status.connected);
  const handle = await Network.addListener('networkStatusChange', (s) => {
    callback(s.connected);
  });
  return () => { try { handle.remove(); } catch {} };
}

/**
 * Stocke une valeur durable, accessible cross-app-restart.
 * - Web : localStorage
 * - Natif : @capacitor/preferences (chiffré sur iOS, SharedPreferences sur Android)
 */
export async function preferencesSet(key, value) {
  const v = typeof value === 'string' ? value : JSON.stringify(value);
  if (!isNativePlatform()) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, v);
    return;
  }
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.set({ key, value: v });
}

export async function preferencesGet(key) {
  if (!isNativePlatform()) {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  }
  const { Preferences } = await import('@capacitor/preferences');
  const { value } = await Preferences.get({ key });
  return value ?? null;
}

export async function preferencesRemove(key) {
  if (!isNativePlatform()) {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    return;
  }
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.remove({ key });
}
