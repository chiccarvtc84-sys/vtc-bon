// ============================================================================
// inAppPurchase.js — Achat de jetons via Apple In-App Purchase (RevenueCat)
// ============================================================================
// Remplace Stripe/Apple Pay pour l'achat de jetons SUR iOS UNIQUEMENT : la
// règle App Store 3.1.1 exige In-App Purchase pour tout contenu numérique
// consommé dans l'app (aucune des exceptions 3.1.3 ne s'applique à TrajetPro).
//
// RevenueCat valide lui-même l'achat auprès d'Apple (App Store Server API) et
// prévient notre backend via webhook (`revenuecat-webhook`) une fois l'achat
// confirmé authentique — on n'a pas à gérer nous-mêmes les reçus/JWS.
//
// IMPORTANT : sur Android et web, ces fonctions sont des no-ops gracieux
// (retournent notAvailable). Android reste sur Stripe Checkout web pour
// l'instant (pas d'accès à un appareil Android pour tester Google Play
// Billing — hors scope).
// ============================================================================

import { isNativePlatform, platformName } from './platform.js';

// Les product_id App Store Connect suivent la convention <bundle-id>.<packId>,
// déclarée à la fois côté App Store Connect, RevenueCat, et dans le
// dictionnaire miroir PACKAGES de supabase/functions/revenuecat-webhook/index.ts.
const PRODUCT_ID_PREFIX = 'com.trajetpro.app.';

// Nombre de jetons par pack — miroir de TOKEN_PACKAGES (App.jsx) et du
// dictionnaire PACKAGES du webhook RevenueCat. Gardés synchronisés à la main :
// c'est le même triplet de vérité qu'on a déjà pour Stripe (3 endroits).
const PACKAGE_TOKENS = { pack20: 20, pack40: 40, pack50: 50, pack80: 80 };

// Cache de l'init pour ne pas reconfigurer le SDK à chaque achat.
let purchasesInitPromise = null;

function isIOSNative() {
  return isNativePlatform() && platformName() === 'ios';
}

/**
 * Initialise le SDK RevenueCat avec la clé API publique + identifie
 * l'utilisateur (pour que le webhook reçoive le bon `app_user_id` = notre
 * `users.id` Supabase). Paresseux : la première tentative d'achat déclenche
 * l'init, les suivantes réutilisent la promesse résolue — même pattern que
 * `ensureStripeInit` dans applePay.js.
 *
 * @param {string} userId
 */
async function ensurePurchasesInit(userId) {
  if (!isIOSNative()) return false;
  if (purchasesInitPromise) return purchasesInitPromise;

  purchasesInitPromise = (async () => {
    const apiKey = import.meta.env.VITE_REVENUECAT_API_KEY;
    if (!apiKey) {
      throw new Error('VITE_REVENUECAT_API_KEY manquante dans .env');
    }
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    await Purchases.configure({ apiKey, appUserID: userId });
    return true;
  })();

  return purchasesInitPromise;
}

/**
 * Vrai si l'achat via In-App Purchase est possible sur ce device (iOS natif
 * uniquement — Android/web retombent sur Stripe Checkout web).
 */
export function isInAppPurchaseAvailable() {
  return isIOSNative();
}

/**
 * Lance l'achat d'un pack de jetons via StoreKit (sheet native Apple, pas de
 * choix de moyen de paiement côté app — Apple gère ça lui-même).
 *
 * @param {string} packageId — pack20 / pack40 / pack50 / pack80
 * @param {string} userId — Supabase users.id, transmis à RevenueCat pour lier
 *   l'achat au bon compte (lu ensuite par le webhook comme `app_user_id`)
 * @returns {Promise<{
 *   ok: boolean,
 *   tokens?: number,
 *   transactionId?: string,
 *   reason?: string,
 *   cancelled?: boolean,
 *   notAvailable?: boolean,
 * }>}
 */
export async function purchasePack(packageId, userId) {
  console.log('[inAppPurchase] purchasePack START', { packageId, native: isIOSNative() });

  if (!isIOSNative()) {
    return { ok: false, notAvailable: true, reason: "L'achat via l'App Store n'est disponible que sur iPhone." };
  }

  const tokens = PACKAGE_TOKENS[packageId];
  if (!tokens) {
    return { ok: false, reason: `Pack inconnu : ${packageId}` };
  }

  try {
    await ensurePurchasesInit(userId);
    const { Purchases } = await import('@revenuecat/purchases-capacitor');

    const productId = `${PRODUCT_ID_PREFIX}${packageId}`;

    // Les offerings sont configurées côté dashboard RevenueCat (import des
    // 4 produits App Store Connect dans l'offering "current").
    const offerings = await Purchases.getOfferings();
    const rcPackage = offerings.current?.availablePackages?.find(
      (p) => p.product.identifier === productId,
    );
    if (!rcPackage) {
      console.error('[inAppPurchase] package introuvable dans les offerings', { productId, offerings });
      return {
        ok: false,
        notAvailable: true,
        reason: `Pack introuvable dans les offres Apple (${productId}). Vérifie la configuration RevenueCat.`,
      };
    }

    const result = await Purchases.purchasePackage({ aPackage: rcPackage });
    console.log('[inAppPurchase] purchasePackage OK', result);

    // Succès : le webhook RevenueCat va créditer en async (quelques secondes),
    // même délai d'attente que pour Apple Pay natif côté Stripe.
    return {
      ok: true,
      tokens,
      transactionId: result.transaction?.transactionIdentifier,
    };
  } catch (err) {
    // PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR === '1' (enum de strings)
    if (err?.code === '1' || err?.userCancelled) {
      return { ok: false, cancelled: true, reason: 'Achat annulé.' };
    }
    console.error('[inAppPurchase] EXCEPTION', err?.message, err);
    return { ok: false, reason: err?.message || 'Erreur lors de l\'achat via l\'App Store.' };
  }
}
