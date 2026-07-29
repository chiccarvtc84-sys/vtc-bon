// ============================================================================
// TRAJETPRO - Helpers Supabase
// ============================================================================
// Ce fichier centralise toutes les interactions avec Supabase.
// Les composants React doivent utiliser ces helpers, pas appeler Supabase
// directement (sauf cas particuliers).
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { preferencesGet, preferencesSet, preferencesRemove } from './platform.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ----------------------------------------------------------------------------
// Stockage durable de la session auth
// ----------------------------------------------------------------------------
// Par défaut supabase-js garde la session dans localStorage — or sur iOS,
// WKWebView peut PURGER localStorage (pression disque, maintenance système,
// longues périodes d'inactivité) → session perdue → l'utilisateur se retrouve
// déconnecté aléatoirement. On stocke donc la session dans les Préférences
// natives (UserDefaults iOS / SharedPreferences Android), qui ne sont jamais
// purgées. Sur web, preferences* retombe sur localStorage : inchangé.
// Clé sous laquelle supabase-js range la session (convention par défaut :
// sb-<ref-projet>-auth-token). On la dérive de l'URL plutôt que de la coder
// en dur, pour rester juste si le projet change.
const SUPABASE_PROJECT_REF = (() => {
  try { return new URL(supabaseUrl).hostname.split('.')[0]; } catch { return ''; }
})();
export const AUTH_STORAGE_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`;

const authStorage = {
  getItem: async (key) => {
    const value = await preferencesGet(key);
    if (value !== null && value !== undefined) return value;
    // Migration douce : session posée par l'ANCIEN stockage (localStorage,
    // avant ce fix). On la récupère et on la copie dans les Préférences pour
    // ne pas déconnecter l'utilisateur lors de la mise à jour de l'app.
    const legacy = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    if (legacy !== null) await preferencesSet(key, legacy);
    return legacy;
  },
  setItem: async (key, value) => { await preferencesSet(key, value); },
  removeItem: async (key) => { await preferencesRemove(key); },
};

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("⚠️ Supabase URL ou Anon Key manquante dans .env");
}

// ⚠️ Singleton GLOBAL du client Supabase.
//
// Sans ça, Vite HMR (Hot Module Reload) crée une nouvelle instance du client
// chaque fois qu'on édite ce fichier. Conséquence : plusieurs `GoTrueClient`
// instances dans la page (warning observé : "Multiple GoTrueClient instances
// detected"), qui se battent pour le verrou auth → login qui pend, refresh
// qui déconnecte, etc.
//
// On stocke le client sur `globalThis` avec une clé unique. Si l'instance
// existe déjà, on la réutilise au lieu d'en créer une nouvelle.
const SB_GLOBAL_KEY = '__trajetpro_supabase_client__';
const _global = /** @type {any} */ (globalThis);

export const supabase =
  _global[SB_GLOBAL_KEY] ||
  (_global[SB_GLOBAL_KEY] = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: authStorage,
    },
  }));


// ----------------------------------------------------------------------------
// Authentification
// ----------------------------------------------------------------------------

/** Récupère l'utilisateur actuellement connecté avec son profil complet */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error("Erreur récupération profil :", error);
    return null;
  }

  return profile;
}

/** Inscription complète (Auth + profil) */
export async function signUp({ email, password, name, phone, siret, referredBy, deviceFingerprint }) {
  // Le trigger SQL `handle_new_auth_user` lit raw_user_meta_data pour :
  //  - récupérer name/phone/siret pour le profil
  //  - lookup le code de parrainage (referred_by) → UUID parrain
  //  - vérifier si le device_fingerprint a déjà reçu un bonus welcome
  //    (anti-double-bonus : un même device ne reçoit le bonus qu'une fois)
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        phone,
        siret,
        referred_by: referredBy,
        device_fingerprint: deviceFingerprint,
      },
    },
  });

  if (authError) throw authError;
  return authData;
}

/** Connexion par email/mot de passe.
 *  Le bonus mensuel n'est PAS crédité ici : il est appelé dans `loadUserData`
 *  côté React, après la transition d'état. Le faire ici ajoutait un await
 *  bloquant qui pouvait pendre quand le verrou auth interne du SDK n'était
 *  pas relâché à temps (cas typique : HMR + multiple GoTrueClient instances).
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Envoie un email de réinitialisation de mot de passe.
 *
 * Sans ça, un chauffeur qui oublie son mot de passe perd définitivement son
 * compte — donc ses crédits achetés et ses factures (qu'il a l'obligation
 * légale de conserver). C'est aussi un motif classique de rejet App Store.
 *
 * Le lien renvoie sur l'app ; Supabase émet alors l'événement
 * PASSWORD_RECOVERY côté client, qui ouvre l'écran de choix du nouveau mot
 * de passe.
 *
 * @param {string} email
 */
export async function resetPassword(email) {
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  // On ne propage PAS une erreur "utilisateur inconnu" : révéler qu'une
  // adresse est (ou non) inscrite permettrait d'énumérer les comptes.
  if (error && !/user not found|not found/i.test(error.message || '')) {
    throw new Error(error.message || "Envoi de l'email impossible");
  }
  return true;
}

/**
 * Définit un nouveau mot de passe pour l'utilisateur actuellement authentifié
 * (utilisé après le retour du lien de réinitialisation, événement
 * PASSWORD_RECOVERY).
 *
 * @param {string} newPassword
 */
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message || 'Mise à jour du mot de passe impossible');
  return true;
}

/**
 * Déconnexion robuste.
 *
 * Le bug que ce code prévient : `supabase.auth.signOut()` est async, donc si
 * l'utilisateur ferme la page entre l'appel et la fin de la requête réseau,
 * les clés JWT peuvent rester dans le stockage. À la réouverture,
 * `getSession()` les retrouve et "restaure" l'ancienne session — l'utilisateur
 * croit être déconnecté mais ne l'est pas.
 *
 * Parade : le nettoyage local (Preferences natives + localStorage) est
 * TOUJOURS exécuté, même si l'appel réseau échoue ou dépasse son délai.
 */
export async function signOut() {
  // ⚠️ ORDRE IMPORTANT (audit 2026-07-29) : la purge du stockage doit venir
  // APRÈS l'appel signOut(). Avant, on purgeait d'abord — auth-js ne
  // retrouvait alors plus l'access token, n'envoyait donc jamais le POST
  // /logout, et le refresh token restait valide côté serveur (une session
  // copiée depuis un poste partagé restait exploitable).
  //
  // Timeout court : sur réseau mort, l'appel peut pendre longtemps ; on ne
  // doit jamais bloquer une déconnexion (le nettoyage local suffit à
  // déconnecter l'utilisateur ici et maintenant).
  try {
    await Promise.race([
      supabase.auth.signOut({ scope: 'local' }),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]);
  } catch (e) {
    console.warn('signOut() serveur a échoué (nettoyage local effectué quand même) :', e?.message);
  }

  // Nettoyage local, TOUJOURS exécuté même si l'appel réseau a échoué.
  // Sur iOS/Android la session vit dans les Preferences natives (adaptateur
  // authStorage), PAS dans localStorage : sans cette purge, un logout
  // hors-ligne laissait une session zombie qui reconnectait automatiquement
  // l'utilisateur au lancement suivant.
  try {
    await preferencesRemove(AUTH_STORAGE_KEY);
  } catch (e) {
    console.warn('Purge Preferences échouée :', e?.message);
  }

  // Filet de sécurité web : purge toute clé sb-*/supabase* résiduelle.
  if (typeof localStorage !== 'undefined') {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('sb-') || k.toLowerCase().includes('supabase'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  }
}

/**
 * Charge les paramètres de facturation de l'utilisateur (logo, toggles
 * SIRET / N° VTC). Stockés dans `users.invoice_settings JSONB`.
 *
 * Renvoie un objet avec valeurs par défaut si la colonne est NULL ou
 * vide — l'UI peut donc toujours faire `settings.show_siret` sans
 * avoir à gérer undefined.
 *
 * @param {string} userId — auth.uid() de l'utilisateur
 * @returns {Promise<{
 *   logo_data_url: string|null,
 *   show_siret: boolean,
 *   show_vtc_number: boolean,
 *   company_name?: string,
 *   address?: string,
 *   ...
 * }>}
 */
export async function loadInvoiceSettings(userId) {
  if (!userId) return { logo_data_url: null, show_siret: true, show_vtc_number: true };
  const { data, error } = await supabase
    .from('users')
    .select('invoice_settings')
    .eq('id', userId)
    .single();
  if (error) {
    console.warn('[loadInvoiceSettings] échec :', error.message);
    return { logo_data_url: null, show_siret: true, show_vtc_number: true };
  }
  const s = data?.invoice_settings || {};
  return {
    logo_data_url: s.logo_data_url ?? null,
    show_siret: s.show_siret !== false, // default true si absent
    show_vtc_number: s.show_vtc_number !== false,
    company_name: s.company_name ?? null,
    address: s.address ?? null,
    ...s, // permettre d'autres champs étendus
  };
}

/**
 * Met à jour les paramètres de facturation. Merge avec l'existant
 * pour préserver les autres champs.
 *
 * Sécurité H-4 (audit 2026-05-06) : whitelist stricte des clés
 * autorisées + plafonds sur les valeurs (longueur, taille du logo).
 * Évite que (a) la mise à jour échappe à un attaquant déterminé
 * pour bourrer la JSONB de blob (DOS row-bloat), (b) introduire des
 * clés inattendues qui seraient lues plus tard par le générateur PDF.
 *
 * @param {string} userId
 * @param {object} updates — partial settings à fusionner
 */
const ALLOWED_INVOICE_SETTINGS_KEYS = [
  'logo_data_url',
  'show_siret', 'show_vtc_number',
  'legal_form', 'show_legal_form',
  'vat_number', 'show_vat_number',
  'vehicle_plate', 'show_vehicle_plate',
  'vtc_number', 'pro_card_number', 'vehicle_model',
  // Champs étendus du profil (legacy : la nouvelle UI ne les expose plus,
  // mais on les autorise pour compat ascendante).
  'company_name', 'address',
];

const LIMITS = {
  logo_data_url: 200_000,        // ~150 KB de base64 pour PNG/JPG ≤300px
  legal_form: 100,
  vat_number: 50,
  vehicle_plate: 20,
  vtc_number: 50,
  pro_card_number: 50,
  vehicle_model: 100,
  company_name: 200,
  address: 500,
};

export async function updateInvoiceSettings(userId, updates) {
  if (!userId) throw new Error('userId requis');
  if (!updates || typeof updates !== 'object') {
    throw new Error('updates doit être un objet');
  }

  // Whitelist stricte : on ne garde que les clés autorisées
  const sanitized = {};
  for (const k of ALLOWED_INVOICE_SETTINGS_KEYS) {
    if (k in updates) {
      let v = updates[k];
      // Coerce les booleans
      if (k.startsWith('show_')) {
        sanitized[k] = Boolean(v);
        continue;
      }
      // String fields : trim + check max length
      if (typeof v === 'string') {
        v = v.trim();
        const limit = LIMITS[k];
        if (limit && v.length > limit) {
          throw new Error(`${k} trop long (max ${limit} caractères)`);
        }
      } else if (v !== null && v !== undefined) {
        // Si c'est ni string ni null/undefined ni boolean → reject
        throw new Error(`${k} : type invalide`);
      }
      sanitized[k] = v;
    }
  }

  // Lit l'existant pour merger côté client
  const current = await loadInvoiceSettings(userId);
  const merged = { ...current, ...sanitized };
  const { error } = await supabase
    .from('users')
    .update({ invoice_settings: merged })
    .eq('id', userId);
  if (error) throw new Error(`Échec mise à jour invoice_settings : ${error.message}`);
  return merged;
}

/**
 * Sign in with Apple — Apple OAuth via Supabase Auth.
 *
 * Conforme :
 *   - App Store règle 4.8 (obligatoire si email login présent, depuis 2020)
 *   - RGPD (Apple expose seulement email + nom — pas de tracking)
 *
 * Côté serveur, Supabase Dashboard doit avoir :
 *   - Authentication → Providers → Apple : Enabled
 *   - Service ID + Team ID + Key ID + Private Key (.p8) renseignés
 *   - Redirect URL : https://olmhckwethdcxhvsrfie.supabase.co/auth/v1/callback
 *
 * Côté Apple Developer Console :
 *   - "Sign in with Apple" capability activée pour le bundle id com.trajetpro.app
 *   - Service ID `com.trajetpro.app.signin` créé
 *   - Authentication Key (.p8) téléchargée
 *
 * Mode WEB : Supabase ouvre une popup vers appleid.apple.com → l'utilisateur
 * autorise → redirect vers /auth/v1/callback → session créée.
 *
 * Mode iOS NATIF : on utilise le plugin @capacitor-community/apple-sign-in
 * qui déclenche la fenêtre système native d'Apple (Face ID / Touch ID),
 * récupère un identityToken JWT signé par Apple, puis on l'échange contre
 * une session Supabase via signInWithIdToken — ZÉRO redirection web,
 * tout reste dans l'app (UX native conforme aux exigences App Store).
 */
export async function signInWithApple() {
  // ─── Détection plateforme ────────────────────────────────────────
  // On utilise Capacitor.isNativePlatform() en dynamique pour ne pas
  // casser le bundling web (le plugin natif n'est dispo qu'en iOS).
  let isIOSNative = false;
  try {
    const { Capacitor } = await import('@capacitor/core');
    isIOSNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  } catch {
    isIOSNative = false;
  }

  // ─── Branche NATIVE iOS ──────────────────────────────────────────
  if (isIOSNative) {
    const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');

    // Sécurité du nonce — IMPORTANT, double valeur :
    //   1. rawNonce : généré côté client, gardé en mémoire JS
    //   2. hashedNonce : SHA-256(rawNonce), envoyé à Apple via le plugin
    //
    // Apple inclut le hashedNonce TEL QUEL dans le JWT id_token (sans
    // le re-hasher). Supabase, lui, hash automatiquement le rawNonce qu'on
    // lui passe puis compare avec celui du JWT → match parfait.
    //
    // Ce double-saut empêche un attaquant qui intercepterait la requête
    // vers Apple de connaître le rawNonce (il n'aurait que son hash),
    // et garantit que le JWT a bien été émis pour notre session précise
    // (anti-replay).
    const rawNonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0')).join('');

    // Hash SHA-256 hex via WebCrypto (dispo dans WKWebView iOS).
    const enc = new TextEncoder().encode(rawNonce);
    const hashBuf = await crypto.subtle.digest('SHA-256', enc);
    const hashedNonce = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0')).join('');

    const result = await SignInWithApple.authorize({
      // clientId = Service ID configuré dans Apple Developer Console
      // (le même que celui renseigné côté Supabase Provider).
      clientId: 'com.trajetpro.app.signin',
      // redirectURI requis par l'API du plugin mais NON utilisé en natif —
      // Apple ne redirige pas, il renvoie directement le token via callback.
      redirectURI: 'https://olmhckwethdcxhvsrfie.supabase.co/auth/v1/callback',
      scopes: 'email name',
      state: rawNonce,
      nonce: hashedNonce, // ← HASHÉ pour Apple
    });

    const idToken = result?.response?.identityToken;
    if (!idToken) {
      throw new Error('Sign in with Apple : aucun token reçu d\'Apple.');
    }

    // Échange le idToken Apple contre une session Supabase.
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: idToken,
      nonce: rawNonce, // ← BRUT pour Supabase (qui hashera côté serveur)
    });

    if (error) {
      throw new Error(`Sign in with Apple échoué : ${error.message}`);
    }
    return data;
  }

  // ─── Branche WEB (PWA / dev local / Android) ─────────────────────
  const redirectTo = typeof window !== 'undefined'
    ? `${window.location.origin}/`
    : undefined;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo,
      scopes: 'email name',
    },
  });

  if (error) {
    throw new Error(`Sign in with Apple échoué : ${error.message}`);
  }
  return data;
}

/**
 * Supprime DÉFINITIVEMENT le compte de l'utilisateur connecté.
 *
 * Conforme :
 *   - RGPD article 17 (droit à l'effacement)
 *   - App Store règle 5.1.1(v) (suppression in-app obligatoire)
 *   - Google Play Data Safety
 *
 * Effet :
 *   - Toutes les factures, bons, transactions et device fingerprints
 *     sont supprimés en base.
 *   - Le compte auth.users est supprimé (la session est invalidée).
 *   - Le localStorage est purgé.
 *
 * IRRÉVERSIBLE — le caller DOIT confirmer 2x avant d'appeler.
 *
 * @returns {Promise<{ success: true, deleted_invoices, deleted_bookings, deleted_transactions }>}
 * @throws si l'appel RPC échoue (l'utilisateur reste connecté).
 */
export async function deleteMyAccount() {
  const { data, error } = await supabase.rpc('delete_my_account');
  if (error) {
    throw new Error(`Suppression du compte échouée : ${error.message}`);
  }

  // Purge le stockage côté client (la session est déjà invalidée côté serveur
  // par la suppression de auth.users). Sur iOS/Android la session est dans les
  // Preferences natives, pas dans localStorage — les deux sont nettoyés.
  try {
    await preferencesRemove(AUTH_STORAGE_KEY);
  } catch (e) {
    console.warn('Purge Preferences échouée :', e?.message);
  }
  if (typeof localStorage !== 'undefined') {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('sb-') || k.toLowerCase().includes('supabase'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  }

  return data;
}

// ----------------------------------------------------------------------------
// Vérifications anti-fraude
// ----------------------------------------------------------------------------

/** Vérifie si un email utilise un domaine jetable */
export async function isDisposableEmail(email) {
  const { data } = await supabase.rpc('is_disposable_email', { p_email: email });
  return data === true;
}

/** Vérifie un SIRET via Edge Function (API INSEE) */
export async function verifySiret(siret) {
  const { data, error } = await supabase.functions.invoke('verify-siret', {
    body: { siret },
  });
  if (error) return { valid: false, reason: error.message };
  return data;
}

/**
 * Marque le SIRET de l'utilisateur connecté comme vérifié.
 * Appelé après un retour OK de verifySiret(), pour persister le statut
 * dans users.siret_verified. RLS + RPC SECURITY DEFINER avec auth.uid()
 * check pour éviter qu'un user marque le SIRET de quelqu'un d'autre.
 *
 * @param {string} userId
 */
export async function markSiretVerified(userId) {
  const { data, error } = await supabase.rpc('mark_siret_verified', { p_user_id: userId });
  if (error) throw new Error(`mark_siret_verified RPC échouée : ${error.message}`);
  return data === true;
}

/**
 * Marque la carte VTC de l'utilisateur connecté comme vérifiée.
 * Appelé après saisie d'un n° de carte pro non vide. Pas d'API publique
 * pour vérifier la carte en temps réel — on stocke la déclaration
 * du chauffeur (sa responsabilité légale s'il fournit un faux numéro).
 */
export async function markEvtcVerified(userId) {
  const { data, error } = await supabase.rpc('mark_evtc_verified', { p_user_id: userId });
  if (error) throw new Error(`mark_evtc_verified RPC échouée : ${error.message}`);
  return data === true;
}

// ----------------------------------------------------------------------------
// Avatar (photo de profil)
// ----------------------------------------------------------------------------
// Stockage : bucket Supabase Storage 'avatars', path '{user_id}/avatar.{ext}'.
// RLS : tout le monde peut lire (URLs publiques utilisables direct dans <img>),
// seul le propriétaire peut écrire dans son propre dossier.

/**
 * Upload une photo de profil pour l'utilisateur connecté.
 * Remplace l'avatar existant si présent (upsert + cache-busting via ?v= timestamp).
 *
 * @param {string} userId    — UUID du user
 * @param {File}   file       — fichier image (jpeg/png/webp/heic, max 2 MB)
 * @returns {Promise<string>} — l'URL publique de l'avatar
 */
export async function uploadAvatar(userId, file) {
  if (!userId) throw new Error('userId requis');
  if (!file) throw new Error('Aucun fichier sélectionné');
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('Image trop grande (max 2 Mo). Compressez-la avant.');
  }
  // Extension à partir du type MIME (plus fiable que file.name)
  const mime = file.type || 'image/jpeg';
  const ext = mime.includes('png') ? 'png'
            : mime.includes('webp') ? 'webp'
            : mime.includes('heic') || mime.includes('heif') ? 'heic'
            : 'jpg';
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: mime,
    });
  if (uploadError) throw new Error(`Upload échoué : ${uploadError.message}`);

  // URL publique (bucket public). On ajoute un cache-bust pour que le navigateur
  // recharge l'image après remplacement (sinon il garde l'ancienne en cache).
  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
  const finalUrl = `${publicUrl}?v=${Date.now()}`;

  // Persister dans users.avatar_url
  const { error: updateError } = await supabase
    .from('users')
    .update({ avatar_url: finalUrl })
    .eq('id', userId);
  if (updateError) throw new Error(`Mise à jour profil échouée : ${updateError.message}`);

  return finalUrl;
}

/**
 * Supprime la photo de profil (efface le fichier Storage + colonne avatar_url).
 * Le user retombera sur l'affichage des initiales.
 */
export async function deleteAvatar(userId) {
  if (!userId) throw new Error('userId requis');
  // On tente de supprimer toutes les variantes (jpg/png/webp/heic) sans
  // savoir laquelle est présente — Supabase ignore les fichiers inexistants.
  const paths = ['jpg', 'png', 'webp', 'heic'].map(ext => `${userId}/avatar.${ext}`);
  await supabase.storage.from('avatars').remove(paths);

  const { error } = await supabase
    .from('users')
    .update({ avatar_url: null })
    .eq('id', userId);
  if (error) throw new Error(`Mise à jour profil échouée : ${error.message}`);
}

// ----------------------------------------------------------------------------
// Bons de course (bookings)
// ----------------------------------------------------------------------------

/** Charge tous les bons de course actifs d'un utilisateur */
export async function loadBookings(userId) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('pickup_datetime', { ascending: true });

  if (error) throw error;
  return data;
}

/** Crée un nouveau bon de course (consomme 1 crédit) */
export async function createBooking(userId, booking) {
  // Insertion du bon
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      user_id: userId,
      customer_name: booking.customerName,
      customer_phone: booking.phone || null,
      customer_email: booking.customerEmail || null,
      customer_address: booking.customerAddress || null,
      customer_company: booking.customerCompany || null,
      pickup_address: booking.pickupAddress,
      dropoff_address: booking.dropoffAddress,
      pickup_datetime: booking.dateTime,
      passengers: booking.passengers,
      has_luggage: booking.hasLuggage,
      distance_km: booking.distance,
      duration_min: booking.duration,
      price_ttc: booking.price,
      notes: booking.notes || null,
      type: booking.type || 'manual',
      status: 'confirmed',
    })
    .select()
    .single();

  if (error) throw error;

  // Consommation d'un crédit. On capture explicitement l'erreur RPC pour
  // ne pas masquer un vrai problème (RLS, permission, lock, etc.) en
  // affichant "Crédits insuffisants" alors que le user a 100+ crédits.
  const { data: consumed, error: consumeErr } = await supabase.rpc('consume_tokens', {
    p_user_id: userId,
    p_amount: 1,
    p_kind: 'consume_booking',
    p_related_id: data.id,
  });

  if (consumeErr) {
    // Rollback puis remontée de l'erreur réelle (lisible par l'UI).
    await supabase.from('bookings').delete().eq('id', data.id);
    throw new Error(`consume_tokens RPC échouée : ${consumeErr.message || consumeErr}`);
  }

  if (!consumed) {
    // Le serveur a légitimement refusé : solde DB insuffisant.
    await supabase.from('bookings').delete().eq('id', data.id);
    throw new Error("Crédits insuffisants");
  }

  return data;
}

/** Met à jour un bon existant (gratuit) */
export async function updateBooking(bookingId, booking) {
  const { error } = await supabase
    .from('bookings')
    .update({
      customer_name: booking.customerName,
      customer_phone: booking.phone || null,
      customer_email: booking.customerEmail || null,
      customer_address: booking.customerAddress || null,
      customer_company: booking.customerCompany || null,
      pickup_address: booking.pickupAddress,
      dropoff_address: booking.dropoffAddress,
      pickup_datetime: booking.dateTime,
      passengers: booking.passengers,
      has_luggage: booking.hasLuggage,
      distance_km: booking.distance,
      duration_min: booking.duration,
      price_ttc: booking.price,
      notes: booking.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId);

  if (error) throw error;
}

/** Supprime (soft delete) un bon */
export async function deleteBooking(bookingId) {
  const { error } = await supabase
    .from('bookings')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', bookingId);

  if (error) throw error;
}

// ----------------------------------------------------------------------------
// Factures (invoices)
// ----------------------------------------------------------------------------

/** Charge toutes les factures d'un utilisateur */
export async function loadInvoices(userId) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('user_id', userId)
    .order('issued_at', { ascending: false });

  if (error) throw error;
  return data;
}

/** Crée une facture à partir d'un bon (consomme 1 crédit) */
export async function createInvoice(userId, booking) {
  const year = new Date().getFullYear();

  // Récupérer le dernier numéro FAC- de l'année.
  // ⚠️ Filtrer sur le préfixe FAC- est indispensable : la table invoices
  // contient AUSSI les factures d'achat de crédits TRP-YYYY-NNNN insérées
  // par les webhooks Stripe/RevenueCat pour ce même user_id, avec un
  // compteur GLOBAL à toute l'app. Sans le filtre, la regex (\d+)$ lisait
  // indifféremment TRP-2026-0127 → saut de numérotation (rupture CGI), ou
  // pire : recul du compteur → collision UNIQUE(user_id, invoice_number)
  // → plus AUCUNE facture émissible. On trie sur invoice_number (zero-padded
  // → ordre lexicographique = ordre numérique) plutôt que created_at pour
  // prendre le vrai maximum de la série.
  const { data: lastInvoice } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('user_id', userId)
    .like('invoice_number', `FAC-${year}-%`)
    .order('invoice_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNum = 1;
  if (lastInvoice) {
    const match = lastInvoice.invoice_number.match(/(\d+)$/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }

  const invoiceNumber = `FAC-${year}-${String(nextNum).padStart(4, '0')}`;
  const fingerprint = await generateFingerprint(booking, invoiceNumber);
  const vatAmount = +(booking.price * 0.10 / 1.10).toFixed(2);

  // Insertion de la facture
  const { data, error } = await supabase
    .from('invoices')
    .insert({
      user_id: userId,
      booking_id: booking.id,
      invoice_number: invoiceNumber,
      customer_name: booking.customerName,
      amount_ht: booking.price - vatAmount,
      amount_vat: vatAmount,
      amount_ttc: booking.price,
      vat_rate: 10,
      status: 'pending',
      fingerprint,
    })
    .select()
    .single();

  if (error) throw error;

  // Consommation d'un crédit (avec capture explicite de l'erreur RPC,
  // cf. createBooking pour la justif).
  const { data: consumed, error: consumeErr } = await supabase.rpc('consume_tokens', {
    p_user_id: userId,
    p_amount: 1,
    p_kind: 'consume_invoice',
    p_related_id: data.id,
  });

  if (consumeErr) {
    await supabase.from('invoices').delete().eq('id', data.id);
    throw new Error(`consume_tokens RPC échouée : ${consumeErr.message || consumeErr}`);
  }

  if (!consumed) {
    await supabase.from('invoices').delete().eq('id', data.id);
    throw new Error("Crédits insuffisants");
  }

  return data;
}

// ----------------------------------------------------------------------------
// Tokens
// ----------------------------------------------------------------------------

/** Charge l'historique des transactions de tokens d'un utilisateur */
export async function loadTokenTransactions(userId) {
  const { data, error } = await supabase
    .from('token_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Crée une session Stripe Checkout pour acheter un pack de crédits.
 * Appelle l'Edge Function `create-checkout-session` (JWT requis).
 * Retourne `{ sessionId, url }` ; le caller redirige vers `url`.
 */
export async function createCheckoutSession(packageId) {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { packageId },
  });
  if (error) {
    // En v2.45 du SDK Supabase, `error.context` est une Response et son
    // `body` est un ReadableStream non lu — il faut donc appeler .text()
    // pour récupérer la chaîne, puis parser le JSON.
    //
    // La fonction Edge renvoie en mode verbose :
    //   { error: "...", detail: "...", stripe_code: "...", stripe_type: "...", stripe_status: ... }
    // On préfère `detail` (le vrai message Stripe) à `error` (générique).
    let detail = error?.message || 'Erreur Stripe';
    let parsed = null;
    if (error?.context && typeof error.context.text === 'function') {
      try {
        const raw = await error.context.text();
        if (raw) {
          try {
            parsed = JSON.parse(raw);
            // Priorité : detail (Stripe) > error (générique) > message
            detail = parsed?.detail || parsed?.error || parsed?.message || raw;
          } catch {
            detail = raw;
          }
        }
      } catch {
        // body déjà consommé
      }
    }
    console.error('[createCheckoutSession] Edge function error:', {
      status: error?.context?.status,
      detail,
      stripe_code: parsed?.stripe_code,
      stripe_type: parsed?.stripe_type,
      stripe_status: parsed?.stripe_status,
      fullBody: parsed,
      raw: error,
    });
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  if (!data?.url) {
    throw new Error("Réponse Stripe invalide (pas d'URL Checkout)");
  }
  return data;
}

/**
 * Marque une facture comme encaissée (status: 'paid', paid_at: now()).
 * Utile pour les paiements en espèces/chèque/virement encaissés hors-Stripe :
 * le chauffeur passe manuellement la facture en "Payée" depuis l'app.
 *
 * Implémentation : passe par le RPC SECURITY DEFINER `update_invoice_status`
 * qui ne permet de modifier QUE les colonnes status + paid_at (les autres
 * colonnes — numéro chrono, montants — restent immuables pour conformité
 * fiscale CGI). Le RPC vérifie auth.uid() == invoice.user_id.
 *
 * 🐛 Auparavant on faisait un UPDATE direct sur la table mais il n'y a pas
 * de policy RLS UPDATE → erreur "Cannot coerce to single JSON object".
 *
 * @param {string} invoiceId
 * @returns {Promise<boolean>} true si la mise à jour a réussi
 */
export async function markInvoicePaid(invoiceId) {
  if (!invoiceId) throw new Error('invoiceId requis');
  const { data, error } = await supabase.rpc('update_invoice_status', {
    p_invoice_id: invoiceId,
    p_status: 'paid',
  });
  if (error) throw new Error(`Échec marquage facture : ${error.message}`);
  // Le RPC renvoie TRUE si OK. Si data ≠ true, c'est qu'un fallback s'est
  // exécuté sans erreur formelle — on remonte le souci au caller pour
  // qu'il évite de mentir à l'utilisateur ("Encaissé !") alors que la DB
  // n'a pas été mise à jour.
  if (data !== true) throw new Error('Le serveur n\'a pas confirmé la mise à jour. Réessayez.');
  return true;
}

/**
 * Repasse une facture en "en attente" (cas où on s'est trompé en marquant
 * payée prématurément). Symétrique de markInvoicePaid().
 */
export async function markInvoiceUnpaid(invoiceId) {
  if (!invoiceId) throw new Error('invoiceId requis');
  const { data, error } = await supabase.rpc('update_invoice_status', {
    p_invoice_id: invoiceId,
    p_status: 'pending',
  });
  if (error) throw new Error(`Échec marquage facture : ${error.message}`);
  if (data !== true) throw new Error('Le serveur n\'a pas confirmé la mise à jour. Réessayez.');
  return true;
}

/**
 * Crée un Stripe PaymentIntent pour le flow Apple Pay natif.
 *
 * Différent de createCheckoutSession : on ne renvoie PAS d'URL Stripe à
 * ouvrir, mais un `clientSecret` qu'on passe directement au plugin
 * @capacitor-community/stripe pour déclencher la sheet Apple Pay native
 * (pas de redirection web → 1 clic au lieu de 3).
 *
 * @param {string} packageId — pack20 / pack40 / pack50 / pack80
 * @returns {Promise<{
 *   paymentIntentId: string,
 *   clientSecret: string,
 *   amountCents: number,
 *   label: string,
 *   tokens: number,
 * }>}
 */
export async function createPaymentIntent(packageId) {
  const { data, error } = await supabase.functions.invoke('create-payment-intent', {
    body: { packageId },
  });

  if (error) {
    let detail = error?.message || 'Erreur création paiement';
    try {
      if (error?.context && typeof error.context.json === 'function') {
        const errorBody = await error.context.json();
        if (errorBody?.error) detail = errorBody.error;
      }
    } catch { /* fallback à error.message */ }
    console.error('[createPaymentIntent] Edge function error:', {
      status: error?.context?.status,
      detail,
    });
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  if (!data?.clientSecret) {
    throw new Error("Réponse Stripe invalide (pas de clientSecret)");
  }
  return data;
}

/**
 * Récupère une transaction d'achat à partir d'un session_id Stripe Checkout.
 * Utilisé sur la page de retour pour vérifier que le webhook a bien crédité.
 */
export async function findPurchaseBySessionId(userId, sessionId) {
  if (!userId || !sessionId) return null;
  // On stocke le payment_intent_id (pas le session_id) — il faut donc passer
  // par le metadata de la session. Plus simple : on regarde si une transaction
  // de type 'purchase' a été créée dans les 5 dernières minutes.
  const { data } = await supabase
    .from('token_transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('kind', 'purchase')
    .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

// Sécurité M-5 (audit 2026-05-06) : `purchaseTokensDev` retiré du bundle
// production. Ce helper appelait `credit_token_purchase` directement depuis
// le client, ce qui (a) exposait la signature de la RPC dans le bundle
// minifié, (b) servait de roadmap pour un attaquant sur les noms de
// paramètres à essayer. La RPC est de toute façon REVOKE'd côté serveur
// pour `anon` et `authenticated` — donc le helper était déjà sans effet,
// mais on le supprime pour ne pas polluer le bundle.
//
// L'achat de tokens en production passe EXCLUSIVEMENT par :
//   client → createCheckoutSession() → Stripe Checkout → webhook signé →
//   credit_token_purchase (côté serveur, en service_role).

/**
 * Met à jour le profil utilisateur (champs métier éditables).
 * RLS `users_update_own` garantit que seul l'utilisateur peut modifier
 * sa propre ligne. Les champs auth-managés (email, password) sont gérés
 * via supabase.auth.updateUser séparément.
 *
 * @param {string} userId - UUID de l'utilisateur
 * @param {object} updates - clés DB (snake_case) à mettre à jour
 * @returns {Promise<object>} la ligne mise à jour
 */
export async function updateUserProfile(userId, updates) {
  if (!userId) throw new Error('userId manquant');
  // Whitelist : on n'autorise que les champs éditables côté UI.
  // Évite qu'un attaquant envoie token_balance=99999 par ex.
  // Note : `siret` était initialement bloqué (vérif INSEE au signup),
  // mais on l'autorise depuis 2026-05-06 sur demande utilisateur pour
  // permettre les corrections de saisie. La validation côté UI vérifie
  // juste que c'est 14 chiffres.
  const allowed = [
    'name', 'phone', 'siret', 'company_name', 'evtc_number',
    'pro_card_number', 'vehicle_model', 'vehicle_plate',
    'iban', 'vat_intra',
  ];
  const sanitized = {};
  for (const k of allowed) {
    if (k in updates) sanitized[k] = updates[k];
  }
  sanitized.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('users')
    .update(sanitized)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Extraction intelligente d'un bon de course à partir d'une transcription
 * vocale, via Claude Sonnet 4.6 (Edge Function `voice-extract`).
 *
 * Pourquoi : la reconnaissance vocale du navigateur (Web Speech API) produit
 * souvent des erreurs phonétiques sur les noms à accents étrangers et les
 * lieux. Claude nettoie intelligemment et corrige (Carime → Karim, etc.).
 *
 * @param {string} transcription - Texte brut de l'ASR (max 5000 caractères)
 * @returns {Promise<{
 *   client_prenom: string|null,
 *   client_nom: string|null,
 *   lieu_prise_en_charge: string|null,
 *   lieu_depose: string|null,
 *   distance_km: number|null,
 *   prix_euros: number|null,
 *   confiance: 'haute'|'moyenne'|'basse',
 *   champs_incertains: string[],
 *   transcription_corrigee: string,
 * }>}
 * @throws {Error} si l'API Gemini échoue, si JWT invalide, ou rate limit
 *   atteint. Le caller doit catcher et fallback sur le parser local.
 */
export async function extractBookingFromVoice(transcription) {
  if (!transcription || !transcription.trim()) {
    throw new Error('Transcription vide');
  }
  const { data, error } = await supabase.functions.invoke('voice-extract', {
    body: { transcription: transcription.trim() },
  });
  if (error) {
    // Lecture du body d'erreur (idem pattern createCheckoutSession)
    let detail = error?.message || 'Erreur extraction vocale';
    let parsed = null;
    if (error?.context && typeof error.context.text === 'function') {
      try {
        const raw = await error.context.text();
        if (raw) {
          try {
            parsed = JSON.parse(raw);
            detail = parsed?.detail || parsed?.error || raw;
          } catch {
            detail = raw;
          }
        }
      } catch {
        // body déjà consommé
      }
    }
    console.error('[extractBookingFromVoice] Edge function error:', {
      status: error?.context?.status,
      detail,
      // Gemini renvoie un body JSON détaillé en cas d'erreur (quota, key invalide, etc.)
      // L'Edge Function le forward dans `gemini_body` pour le diagnostic.
      gemini_body: parsed?.gemini_body,
      fullBody: parsed,
    });
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return data;
}

/**
 * Cherche un utilisateur par son code de parrainage (utilisé au signup
 * pour valider que le code existe avant de tenter le crédit).
 *
 * Utilise la RPC `lookup_referral_code` (SECURITY DEFINER) car la table
 * `users` a une policy RLS qui n'autorise que la lecture de sa propre
 * ligne — donc un SELECT direct depuis le client (a fortiori pendant
 * le signup où l'utilisateur n'est pas encore authentifié) retournerait
 * toujours `null` même pour un code valide.
 */
export async function findUserByReferralCode(code) {
  if (!code) return null;
  const { data, error } = await supabase.rpc('lookup_referral_code', { p_code: code });
  if (error) {
    console.warn('Erreur lookup referral code:', error);
    return null;
  }
  // La RPC retourne TABLE → tableau de rows. On prend la 1re ou null.
  if (!Array.isArray(data) || data.length === 0) return null;
  return data[0]; // { id, name }
}

/**
 * Crédite le bonus de parrainage (parrain +10, filleul +5).
 * À appeler après que le filleul a confirmé son email.
 */
export async function creditReferralBonus(referrerId, refereeId) {
  const { data, error } = await supabase.rpc('credit_referral_bonus', {
    p_referrer_id: referrerId,
    p_referee_id: refereeId,
  });
  if (error) throw error;
  return data === true;
}

// ----------------------------------------------------------------------------
// Utilitaires
// ----------------------------------------------------------------------------

/** Génère une empreinte cryptographique pour une facture (immutabilité) */
async function generateFingerprint(booking, invoiceNumber) {
  const data = `${booking.id}-${invoiceNumber}-${booking.price}-${Date.now()}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Génère un device fingerprint basique pour anti-fraude */
export function generateDeviceFingerprint() {
  const data = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
  ].join('|');

  // Hash simple (en prod, utiliser FingerprintJS)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'fp_' + Math.abs(hash).toString(16);
}
