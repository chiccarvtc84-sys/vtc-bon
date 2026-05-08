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
 * @returns {Promise<boolean>}
 */
export async function isApplePayAvailable() {
  if (!isNativePlatform()) return false;
  try {
    await ensureStripeInit();
    const { Stripe } = await import('@capacitor-community/stripe');
    const result = await Stripe.isApplePayAvailable();
    return Boolean(result?.available);
  } catch (err) {
    console.warn('[applePay] isApplePayAvailable failed:', err?.message);
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

  try {
    await ensureStripeInit();
    const { Stripe } = await import('@capacitor-community/stripe');

    // 2. Vérifier qu'Apple Pay est dispo (sinon on bascule sur le flow web)
    const avail = await Stripe.isApplePayAvailable();
    console.log('[applePay] isApplePayAvailable →', avail);
    if (!avail?.available) {
      return {
        ok: false,
        notAvailable: true,
        reason: 'Apple Pay non disponible sur ce device. Vérifie : (1) au moins une carte ajoutée dans l\'app Wallet d\'iOS, (2) capability "Apple Pay" cochée dans Xcode → Signing & Capabilities, (3) merchant.com.trajetpro.app n\'est plus en rouge.',
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
    console.log('[applePay] presentApplePay result →', result);

    // result.paymentResult vaut 'Completed' / 'Canceled' / 'Failed'
    if (result?.paymentResult === 'Completed') {
      return {
        ok: true,
        paymentIntentId: intent.paymentIntentId,
        tokens: intent.tokens,
      };
    }
    if (result?.paymentResult === 'Canceled') {
      return { ok: false, cancelled: true, reason: 'Paiement annulé.' };
    }
    return { ok: false, reason: `Paiement échoué (${result?.paymentResult})` };
  } catch (err) {
    console.error('[applePay] EXCEPTION', err?.message, err);
    return { ok: false, reason: err?.message || 'Erreur Apple Pay (cf. logs Xcode)' };
  }
}
