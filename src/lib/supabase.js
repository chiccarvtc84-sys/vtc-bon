// ============================================================================
// TRAJETPRO - Helpers Supabase
// ============================================================================
// Ce fichier centralise toutes les interactions avec Supabase.
// Les composants React doivent utiliser ces helpers, pas appeler Supabase
// directement (sauf cas particuliers).
// ============================================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
 * Déconnexion robuste.
 *
 * Le bug que ce code prévient : `supabase.auth.signOut()` est async, donc si
 * l'utilisateur ferme la page entre l'appel et la fin de la requête réseau,
 * les clés JWT peuvent rester dans `localStorage`. À la réouverture,
 * `getSession()` les retrouve et "restaure" l'ancienne session — l'utilisateur
 * croit être déconnecté mais ne l'est pas.
 *
 * Parade : on **purge synchroniquement** toutes les clés Supabase du
 * localStorage AVANT le `await`. Même si la requête réseau échoue ou est
 * interrompue, le navigateur ne retrouvera plus de session au prochain load.
 */
export async function signOut() {
  // 1) Purge synchrone du localStorage (clés `sb-*` et `supabase*`).
  //    Garantit qu'au prochain reload, getSession() retournera null
  //    même si l'étape 2 ci-dessous est interrompue (fermeture de tab,
  //    coupure réseau, etc.).
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

  // 2) Invalide la session côté serveur et propage l'event SIGNED_OUT
  //    aux autres tabs/listeners. Scope 'local' = on ne touche pas aux
  //    autres devices du même utilisateur (utile s'il est connecté sur
  //    son téléphone aussi). Best-effort : si ça échoue, l'étape 1 a
  //    déjà nettoyé localement.
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (e) {
    console.warn('signOut() serveur a échoué (déjà déconnecté localement) :', e?.message);
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
 * @param {string} userId
 * @param {object} updates — partial settings à fusionner
 */
export async function updateInvoiceSettings(userId, updates) {
  if (!userId) throw new Error('userId requis');
  // Lit l'existant pour merger côté client (pas d'opération JSONB serveur
  // pour éviter une RPC dédiée)
  const current = await loadInvoiceSettings(userId);
  const merged = { ...current, ...updates };
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
 * Mode iOS NATIF : sur device, on devrait idéalement utiliser le plugin
 * @capacitor-community/apple-sign-in pour une UX native (pas de popup web).
 * Pour l'instant on utilise le flow OAuth web qui marche dans la WebView.
 */
export async function signInWithApple() {
  const redirectTo = typeof window !== 'undefined'
    ? `${window.location.origin}/`
    : undefined;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo,
      // Demande email + nom (les seules données qu'Apple expose).
      // L'utilisateur verra "Apple va partager : email, prénom et nom".
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

  // Purge le localStorage côté client (la session est déjà invalidée
  // côté serveur par la suppression de auth.users)
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

  // Consommation d'un crédit
  const { data: consumed } = await supabase.rpc('consume_tokens', {
    p_user_id: userId,
    p_amount: 1,
    p_kind: 'consume_booking',
    p_related_id: data.id,
  });

  if (!consumed) {
    // Rollback : supprimer le bon créé
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
  // Récupérer le dernier numéro
  const { data: lastInvoice } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNum = 1;
  if (lastInvoice) {
    const match = lastInvoice.invoice_number.match(/(\d+)$/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }

  const year = new Date().getFullYear();
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

  // Consommation d'un crédit
  const { data: consumed } = await supabase.rpc('consume_tokens', {
    p_user_id: userId,
    p_amount: 1,
    p_kind: 'consume_invoice',
    p_related_id: data.id,
  });

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

/**
 * MODE DEV : achat de tokens sans Stripe.
 * Crée une transaction de type 'purchase' qui crédite le solde via le trigger.
 * Conservé pour le mode invité ou pour les tests sans paiement réel.
 */
export async function purchaseTokensDev(userId, { packageId, tokens, priceTTC }) {
  // ID factice pour respecter la contrainte unique stripe_payment_intent_id en dev
  const fakeIntentId = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const { data, error } = await supabase.rpc('credit_token_purchase', {
    p_user_id: userId,
    p_tokens: tokens,
    p_amount_ttc: priceTTC,
    p_package_id: packageId,
    p_stripe_intent_id: fakeIntentId,
  });

  if (error) throw error;
  if (data !== true) throw new Error('Achat refusé (transaction déjà enregistrée)');

  return { ok: true, intentId: fakeIntentId };
}

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
