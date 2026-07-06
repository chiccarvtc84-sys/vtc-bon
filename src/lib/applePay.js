// ============================================================================
// applePay.js — Wrapper natif Apple Pay via @capacitor-community/stripe
// ============================================================================
// Initialise le SDK Stripe iOS (Mobile SDK) avec la clé publique, puis expose
// `payWithApplePay(packageId)` qui :
//   1. Demande au backend (Edge Function) de créer un PaymentIntent côté Stripe
//   2. Appelle le plugin natif pour afficher la sheet Apple Pay (Face ID prompt)
//   3. Confirme le PaymentIntent quand l'utilisateur valide
//   4. Retourne le résultat ({ ok, paymentIntentId } ou { ok:false, reason })
//
// Le webhook Stripe (côté Edge Function) crédite ensuite les tokens via
// `payment_intent.succeeded` (avec metadata.flow === 'native_apple_pay').
//
// FALLBACK : si le device n'a pas Apple Pay configuré (pas de carte dans
// Wallet, ou Face ID désactivé), on retourne un résultat spécifique pour
// que l'UI puisse retomber sur Stripe Checkout web.
//
// IMPORTANT : sur web et Android, ces fonctions sont des no-ops gracieux.
// L'app utilise alors le Stripe Checkout web classique.
// ============================================================================

import { isNativePlatform } from './platform.js';
import { createPaymentIntent } from './supabase.js';

// Identifiant Merchant Apple — DOIT correspondre à celui créé dans Apple
// Developer Portal → Identifiers → Merchant IDs et déclaré dans
// l'entitlements iOS (com.apple.developer.in-app-payments).
const MERCHANT_ID = 'merchant.com.trajetpro.app';

// Pays / devise pour Apple Pay
const COUNTRY_CODE = 'FR';
const CURRENCY_CODE = 'EUR';

// Cache du résultat d'init pour ne pas re-initialiser à chaque paiement
let stripeInitPromise = null;

/**
 * Initialise le SDK Stripe natif avec la clé publique. À appeler UNE FOIS
 * au démarrage de l'app (avant tout paiement). En interne, c'est paresseux :
 * la première tentative de paiement déclenche l'init, les suivantes
 * réutilisent la promesse résolue.
 */
async function ensureStripeInit() {
  if (!isNativePlatform()) {
    console.log('[applePay] ensureStripeInit: not native platform → skip');
    return false;
  }
  if (stripeInitPromise) return stripeInitPromise;

  stripeInitPromise = (async () => {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
    if (!publishableKey) {
      throw new Error('VITE_STRIPE_PUBLIC_KEY manquante dans .env');
    }
    console.log('[applePay] Stripe.initialize avec key', publishableKey.slice(0, 12) + '...');
    const { Stripe } = await import('@capacitor-community/stripe');
    await Stripe.initialize({ publishableKey });
    console.log('[applePay] Stripe.initialize OK');
    return true;
  })();

  return stripeInitPromise;
}

/**
 * Vrai si Apple Pay est dispo sur ce device (iPhone avec carte enregistrée
 * dans Wallet, et merchant ID configuré).
 *
 * ⚠️ Quirk du plugin v7 : `Stripe.isApplePayAvailable()` THROW si Apple
 * Pay est INDISPONIBLE, et resolve avec `undefined` (= void) si DISPONIBLE.
 * Donc on considère "OK" toute résolution sans erreur, et on capte
 * uniquement les rejects.
 *
 * @returns {Promise<boolean>}
 */
export async function isApplePayAvailable() {
  if (!isNativePlatform()) return false;
  try {
    await ensureStripeInit();
    const { Stripe } = await import('@capacitor-community/stripe');
    await Stripe.isApplePayAvailable();
    return true;  // pas de throw → Apple Pay dispo
  } catch (err) {
    console.warn('[applePay] isApplePayAvailable rejected:', err?.message);
    return false;
  }
}

/**
 * Lance le flow complet Apple Pay : création PaymentIntent → sheet native
 * → confirmation. Bloque jusqu'à ce que l'utilisateur valide ou annule.
 *
 * @param {string} packageId — pack20 / pack40 / pack50 / pack80
 * @returns {Promise<{
 *   ok: boolean,
 *   paymentIntentId?: string,
 *   tokens?: number,
 *   reason?: string,
 *   cancelled?: boolean,
 *   notAvailable?: boolean,
 * }>}
 */
export async function payWithApplePay(packageId) {
  console.log('[applePay] payWithApplePay START', { packageId, native: isNativePlatform() });

  if (!isNativePlatform()) {
    return { ok: false, notAvailable: true, reason: 'Apple Pay disponible seulement sur iPhone (vous êtes sur web).' };
  }

  // 1. Backend crée le PaymentIntent et renvoie clientSecret
  let intent;
  try {
    intent = await createPaymentIntent(packageId);
    console.log('[applePay] PaymentIntent créé', { id: intent.paymentIntentId, amount: intent.amountCents });
  } catch (err) {
    console.error('[applePay] createPaymentIntent FAIL', err?.message);
    return { ok: false, reason: `Création PaymentIntent : ${err?.message || 'erreur inconnue'}` };
  }

  // Le plugin natif ne renvoie PAS le message d'erreur détaillé d'Apple/Stripe
  // dans la valeur résolue de presentApplePay() — il le pousse uniquement via
  // l'event 'applePayFailed' (voir ApplePayExecutor.swift côté plugin). Sans
  // ce listener, on ne voit jamais que le statut générique "applePayFailed"
  // et on perd la vraie raison (certificat, 3DS/SCA requis, carte refusée…).
  let nativeFailureReason = null;
  let failedListener = null;

  try {
    await ensureStripeInit();
    const { Stripe } = await import('@capacitor-community/stripe');

    failedListener = await Stripe.addListener('applePayFailed', (error) => {
      nativeFailureReason = typeof error === 'string' ? error : (error?.error ?? null);
      console.error('[applePay] event applePayFailed →', nativeFailureReason);
    });

    // 2. Test de disponibilité Apple Pay.
    //    Le plugin v7 THROW si indispo, resolve avec undefined si dispo.
    //    Donc on considère le succès = absence d'exception.
    try {
      await Stripe.isApplePayAvailable();
      console.log('[applePay] isApplePayAvailable → OK (resolve sans throw)');
    } catch (availErr) {
      console.warn('[applePay] isApplePayAvailable THROW:', availErr?.message);
      return {
        ok: false,
        notAvailable: true,
        reason: `Apple Pay non disponible sur ce device : ${availErr?.message || 'raison inconnue'}. Vérifie qu'une carte est ajoutée dans l'app Wallet d'iOS.`,
      };
    }

    // 3. Préparer la sheet Apple Pay avec le montant + label
    const amountEur = (intent.amountCents / 100).toFixed(2);
    await Stripe.createApplePay({
      paymentIntentClientSecret: intent.clientSecret,
      paymentSummaryItems: [
        {
          label: intent.label,                  // "Pack Essentiel"
          amount: parseFloat(amountEur),        // 3.50
        },
      ],
      merchantIdentifier: MERCHANT_ID,
      countryCode: COUNTRY_CODE,
      currency: CURRENCY_CODE,
      requiredShippingContactFields: [],
      requiredBillingContactFields: [],
    });

    // 4. Présenter la sheet (Face ID prompt système → l'utilisateur valide)
    console.log('[applePay] presentApplePay()…');
    const result = await Stripe.presentApplePay();
    console.log('[applePay] presentApplePay result →', result, 'nativeFailureReason:', nativeFailureReason);

    // ⚠️ Plugin v7 : les valeurs sont 'applePayCompleted' / 'applePayCanceled'
    // / 'applePayFailed' (nouvelle convention en lowerCamelCase préfixée).
    // On normalise en lowercase + on reconnaît tous les patterns courants
    // pour ne pas re-rater une variation de casse.
    const raw = String(result?.paymentResult ?? '').toLowerCase();

    if (raw.includes('completed') || raw.includes('success')) {
      return {
        ok: true,
        paymentIntentId: intent.paymentIntentId,
        tokens: intent.tokens,
      };
    }
    if (raw.includes('cancel')) {
      return { ok: false, cancelled: true, reason: 'Paiement annulé.' };
    }
    return {
      ok: false,
      reason: nativeFailureReason
        ? `Paiement échoué : ${nativeFailureReason}`
        : `Paiement échoué (${result?.paymentResult ?? 'inconnu'})`,
    };
  } catch (err) {
    console.error('[applePay] EXCEPTION', err?.message, err);
    return { ok: false, reason: err?.message || 'Erreur Apple Pay (cf. logs Xcode)' };
  } finally {
    if (failedListener) {
      try { await failedListener.remove(); } catch { /* best effort */ }
    }
  }
}
