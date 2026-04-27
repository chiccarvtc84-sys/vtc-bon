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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

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
export async function signUp({ email, password, name, phone, siret, referredBy }) {
  // Étape 1 : créer le compte Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, phone, siret, referred_by: referredBy }
    }
  });

  if (authError) throw authError;

  // Le trigger handle_new_auth_user crée auto le profil dans public.users
  // avec 5 crédits offerts via une transaction "welcome"

  return authData;
}

/** Connexion par email/mot de passe */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  // Donner le bonus mensuel si dû
  if (data.user) {
    await supabase.rpc('credit_monthly_bonus', { p_user_id: data.user.id });
  }

  return data;
}

/** Déconnexion */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
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
    // Supabase functions.invoke renvoie une erreur sans body JSON parsé.
    // On essaye de récupérer le détail dans error.context si possible.
    const detail = error?.context?.body || error?.message || 'Erreur Stripe';
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
 * Cherche un utilisateur par son code de parrainage (utilisé au signup
 * pour valider que le code existe avant de tenter le crédit).
 */
export async function findUserByReferralCode(code) {
  if (!code) return null;
  const { data, error } = await supabase
    .from('users')
    .select('id, name, referral_code')
    .eq('referral_code', code.toUpperCase())
    .maybeSingle();

  if (error) {
    console.warn('Erreur lookup referral code:', error);
    return null;
  }
  return data;
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
