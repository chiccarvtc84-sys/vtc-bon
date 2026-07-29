import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Home, FileText, Receipt, User as UserIcon, Mic, MicOff,
  Plus, MapPin, Clock, Users, Briefcase,
  Calendar, ChevronRight, ChevronLeft, Search, Check,
  Phone, Mail, Share2, QrCode, Euro, X,
  Navigation, Car, Shield, Settings, Building2,
  TrainFront, Plane, Hotel, Cross, Utensils, ShoppingBag, Fuel, GraduationCap, Landmark,
  AlertCircle, Edit3, Trash2, Download, Send,
  Sparkles, CreditCard, FileCheck, TrendingUp,
  Fingerprint, Loader2, CheckCircle2, ArrowUpRight,
  MessageSquare, LogOut, HelpCircle, Zap,
  Coins, Wallet, History, Gift, Crown, Info, TrendingDown,
  Lock, ShieldCheck, Copy, UserPlus, LogIn, Eye, EyeOff,
  Star, Award, Languages, Bell, Palette, Moon, Database,
  ChevronDown, ChevronUp, BookOpen, MessageCircle, HandCoins, Globe,
  Cloud, Camera, User
} from 'lucide-react';
import {
  supabase,
  signIn as sbSignIn,
  signUp as sbSignUp,
  signOut as sbSignOut,
  resetPassword as sbResetPassword,
  updatePassword as sbUpdatePassword,
  getCurrentUser,
  loadBookings as sbLoadBookings,
  loadInvoices as sbLoadInvoices,
  loadTokenTransactions as sbLoadTokenTransactions,
  createBooking as sbCreateBooking,
  updateBooking as sbUpdateBooking,
  deleteBooking as sbDeleteBooking,
  createInvoice as sbCreateInvoice,
  // purchaseTokensDev retiré (audit 2026-05-06, M-5 : code mort + roadmap d'attaque)

  findUserByReferralCode,
  creditReferralBonus,
  updateUserProfile,
  extractBookingFromVoice,
  createCheckoutSession,
  findPurchaseBySessionId,
  markInvoicePaid as sbMarkInvoicePaid,
  markInvoiceUnpaid as sbMarkInvoiceUnpaid,
  verifySiret as sbVerifySiret,
  markSiretVerified as sbMarkSiretVerified,
  markEvtcVerified as sbMarkEvtcVerified,
  uploadAvatar as sbUploadAvatar,
  deleteAvatar as sbDeleteAvatar,
  isDisposableEmail as sbIsDisposableEmail,
  deleteMyAccount as sbDeleteMyAccount,
  signInWithApple as sbSignInWithApple,
  loadInvoiceSettings as sbLoadInvoiceSettings,
  updateInvoiceSettings as sbUpdateInvoiceSettings,
} from './lib/supabase.js';
import { watchNetwork, isNativePlatform, preferencesGet, preferencesSet } from './lib/platform.js';
import { checkPasswordStrength, isPasswordPwned } from './lib/passwordSecurity.js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { geocode, routeBetween } from './lib/geocode.js';
import { searchPlaces, fmtDistance, distanceKm as placeDistanceKm, etaMinutes as placeEtaMinutes, loadRecents, loadFavorites, addRecent, toggleFavorite, isFavorite, clearPlacesHistory } from './lib/places.js';
import {
  isBiometricAvailable,
  isBiometricEnabled,
  enableBiometric,
  disableBiometric,
  verifyBiometric,
  getBiometricUserId,
  getBiometryLabel,
} from './lib/biometric.js';
import { buildInvoicePdf, downloadInvoicePdf } from './lib/invoicePdf.js';
import { shareGeneric, sharePdf, openMailto, openSms, downloadIcs } from './lib/shareHelpers.js';
import { exportInvoicesCsv, exportBookingsCsv } from './lib/csvExport.js';
import { useEdgeSwipeBack } from './lib/useEdgeSwipeBack.js';
import { payWithApplePay } from './lib/applePay.js';
import { purchasePack, isInAppPurchaseAvailable } from './lib/inAppPurchase.js';
import { parseVoiceCommand as parseVoiceCommandV2 } from './lib/voiceParser.js';
import {
  ensureNotificationPermission,
  scheduleBookingReminders,
  cancelBookingReminders,
  rescheduleAllBookings,
  ALL_REMINDER_OFFSETS,
} from './lib/notifications.js';

/* -------------------------------------------------------------------------
   DATA MODEL / MOCK PROFILE (geo-aware: Avignon/Sorgues)
   ------------------------------------------------------------------------- */
const DRIVER_PROFILE = {
  firstName: "Moi",
  lastName: "Conducteur",
  companyName: "TrajetPro Services",
  siret: "832 456 789 00012",
  vtcNumber: "EVTC084220001",
  proCardNumber: "VTC-84-2024-0428",
  vehiclePlate: "GT-482-AV",
  vehicleModel: "Mercedes Classe E",
  phone: "+33 6 12 34 56 78",
  email: "contact@trajetpro.fr",
  baseCity: "Sorgues (84)",
  iban: "FR76 3000 4000 0300 0000 0000 000",
  vatRate: 10,
};

// Packages de jetons disponibles à l'achat
const TOKEN_PACKAGES = [
  { id: "pack20", tokens: 20, priceTTC: 2.00, label: "Découverte" },
  { id: "pack40", tokens: 40, priceTTC: 3.50, label: "Essentiel", popular: true },
  { id: "pack50", tokens: 50, priceTTC: 4.00, label: "Confort" },
  { id: "pack80", tokens: 80, priceTTC: 5.00, label: "Pro", bestValue: true },
];

// Coût en jetons pour chaque action
const COST_BOOKING = 1;
const COST_INVOICE = 1;

const KNOWN_ADDRESSES = [
  { label: "Gare TGV Avignon", detail: "Courtine, Avignon", aliases: ["gare tgv", "tgv avignon", "tgv"] },
  { label: "Gare Avignon Centre", detail: "Bd Saint-Roch, Avignon", aliases: ["gare centre", "avignon centre gare", "gare avignon"] },
  { label: "Aéroport Avignon-Provence", detail: "Caumont-sur-Durance", aliases: ["aeroport", "aéroport", "caumont"] },
  { label: "Palais des Papes", detail: "Place du Palais, Avignon", aliases: ["palais des papes", "palais"] },
  { label: "Avignon Centre", detail: "Place de l'Horloge", aliases: ["avignon centre", "centre avignon", "horloge"] },
  { label: "Hôpital Henri Duffaut", detail: "305 Rue Raoul Follereau, Avignon", aliases: ["hopital", "hôpital", "duffaut"] },
  { label: "Centre Sorgues", detail: "Place de la République, Sorgues", aliases: ["centre sorgues", "sorgues centre", "sorgues"] },
  { label: "Gare de Sorgues", detail: "Av. d'Avignon, Sorgues", aliases: ["gare sorgues"] },
  { label: "Le Pontet - Auchan", detail: "Centre Commercial, Le Pontet", aliases: ["pontet", "auchan"] },
  { label: "Villeneuve-lès-Avignon", detail: "Fort Saint-André", aliases: ["villeneuve"] },
  { label: "Carpentras Centre", detail: "Place Aristide Briand", aliases: ["carpentras"] },
  { label: "Châteauneuf-du-Pape", detail: "Centre viticole", aliases: ["chateauneuf", "châteauneuf", "chateauneuf du pape"] },
  { label: "L'Isle-sur-la-Sorgue", detail: "Centre-ville", aliases: ["isle sur la sorgue", "l'isle"] },
  { label: "Hôtel d'Europe", detail: "12 Place Crillon, Avignon", aliases: ["hotel d'europe", "hôtel d'europe", "europe"] },
  { label: "Les Halles Avignon", detail: "Place Pie, Avignon", aliases: ["les halles", "halles"] },
];

// ----- DONNÉES INITIALES -----
// Les bons, factures et historique de tokens sont désormais chargés depuis
// Supabase au démarrage. On part toujours de listes vides côté React :
// `loadUserData()` vient les remplir après le login.
const INITIAL_BOOKINGS = [];
const INITIAL_INVOICES = [];
const INITIAL_TOKEN_HISTORY = [];

// Crédits offerts à l'inscription. Le trigger SQL `handle_new_auth_user`
// crée la transaction `welcome` (+5) côté serveur ; ces constantes restent
// utiles pour l'affichage côté client (textes, valeurs par défaut).
const INITIAL_TOKEN_BALANCE = 5;
const WELCOME_TOKENS = 5;

// Système de parrainage
const REFERRAL_BONUS_REFERRER = 10; // Crédits pour le parrain quand un filleul s'inscrit
const REFERRAL_BONUS_REFEREE = 5;   // Crédits bonus pour le filleul en plus des crédits de bienvenue

// Bonus mensuel de fidélité (1er du mois)
const MONTHLY_BONUS_TOKENS = 1;

// ----- SYSTÈME ANTI-FRAUDE (version gratuite sans SMS) -----
// Seuils de sécurité pour détecter les abus
const FRAUD_THRESHOLDS = {
  maxAccountsPerDevice: 1,       // Un seul compte actif par appareil
  maxAccountsPerIP: 3,           // Limite douce par IP (familles, collègues)
  minEmailVerified: true,         // Validation email obligatoire (gratuit via Supabase)
  cooldownReinstallDays: 30,      // Délai avant nouveau bonus si réinstallation
  maxReferralsPerMonth: 20,       // Limite de parrainages mensuels
  suspicionScore: 40,             // Seuil au-delà duquel le compte passe en review
  requireValidSiret: true,        // SIRET valide (vérification INSEE gratuite)
  blockDisposableEmails: true,    // Bloquer les domaines d'emails jetables
};

// Génère un "device fingerprint" basé sur plusieurs signaux du navigateur/appareil
// En production Capacitor : utiliser @capacitor/device + un vrai fingerprinting
const generateDeviceFingerprint = () => {
  if (typeof window === "undefined") return "srv_" + Math.random().toString(36).slice(2, 12);
  const signals = [
    navigator.userAgent || "",
    navigator.language || "",
    navigator.platform || "",
    (screen?.width || 0) + "x" + (screen?.height || 0),
    (screen?.colorDepth || 0).toString(),
    new Date().getTimezoneOffset().toString(),
    navigator.hardwareConcurrency || 0,
    navigator.maxTouchPoints || 0,
  ].join("|");
  // Hash simple (en prod : utiliser SHA-256 côté serveur)
  let h = 2166136261;
  for (let i = 0; i < signals.length; i++) { h ^= signals.charCodeAt(i); h = Math.imul(h, 16777619); }
  return "dev_" + (h >>> 0).toString(36) + "_" + signals.length.toString(36);
};

// Calcule un score de risque pour un compte (0 = sûr, 100 = suspect)
// Version sans SMS : l'email devient la vérification principale
const calculateRiskScore = ({ emailVerified, siretVerified, deviceKnown, ipKnown, accountAgeDays, referralCount }) => {
  let score = 0;
  if (!emailVerified) score += 30;            // Email non vérifié = signal fort
  if (!siretVerified) score += 25;            // SIRET non vérifié = suspect
  if (deviceKnown) score += 35;               // Appareil déjà utilisé par un autre compte
  if (ipKnown && ipKnown > 3) score += 20;    // Plus de 3 comptes sur la même IP
  if (accountAgeDays < 1) score += 10;
  if (referralCount > 10 && accountAgeDays < 7) score += 25; // Parrainage massif sur un compte neuf
  return Math.min(100, score);
};

// Liste des domaines d'emails jetables les plus courants (à bloquer à l'inscription)
// Version raccourcie - en production utiliser la liste complète de
// https://github.com/disposable-email-domains/disposable-email-domains (~3500 domaines)
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com", "mailinator.com", "guerrillamail.com", "yopmail.com",
  "tempmail.com", "throwaway.email", "fake-mail.com", "trashmail.com",
  "sharklasers.com", "maildrop.cc", "getnada.com", "temp-mail.org",
  "dispostable.com", "jetable.fr.nf", "spam4.me", "mintemail.com",
  "tempinbox.com", "mohmal.com", "emailondeck.com", "dropmail.me",
  "fakeinbox.com", "mailsac.com", "tempr.email", "zetmail.com",
  "mail-temp.com", "tempmail.ninja", "disposablemail.com", "tmail.com",
]);

// Vérifie si l'email utilise un domaine jetable
const isDisposableEmail = (email) => {
  if (!email) return false;
  const domain = email.toLowerCase().trim().split("@")[1];
  if (!domain) return false;
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
};

// Masque un numéro de téléphone pour l'affichage : +33 6 12 34 56 78 → +33 6 ** ** ** 78
const maskPhone = (phone = "") => {
  const clean = phone.replace(/\s/g, "");
  if (clean.length < 6) return phone;
  return phone.slice(0, 6) + " ** ** ** " + clean.slice(-2);
};

// Valide un numéro de téléphone français (mobile ou fixe).
// Accepte +33, 0033 ou 0 en tête, suivi de 9 chiffres dont le 1er est 1-9.
// Tolère les espaces et les points de séparation.
// Une chaîne vide ou null est considérée valide (champ optionnel).
const isValidPhone = (phone) => {
  if (!phone) return true;
  const clean = String(phone).replace(/[^\d+]/g, "");
  return /^(?:\+33|0033|0)[1-9]\d{8}$/.test(clean);
};

// Génère un code de parrainage unique basé sur le nom
const generateReferralCode = (name = "") => {
  const prefix = (name || "TRP").replace(/[^A-Za-z]/g, "").substring(0, 3).toUpperCase() || "TRP";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
};

// Vérifie si un utilisateur a droit au bonus mensuel
const shouldGrantMonthlyBonus = (lastBonusIso) => {
  if (!lastBonusIso) return true;
  const last = new Date(lastBonusIso);
  const now = new Date();
  return last.getFullYear() !== now.getFullYear() || last.getMonth() !== now.getMonth();
};

// NOTE : DEMO_USER (mock de compte de démonstration) supprimé en Phase 4.5.
// L'authentification passe désormais par Supabase Auth (email + mot de passe).
// La vérification anti-fraude device_fingerprint est encore en mémoire locale ;
// la migration vers la table `device_fingerprints` est listée dans TODO_HUMAN.md.
const KNOWN_DEVICES = new Map(); // fingerprint -> { accountId, firstSeen, accountsCount }

/* -------------------------------------------------------------------------
   VOICE COMMAND PARSER
   ------------------------------------------------------------------------- */
function parseVoiceCommand(raw) {
  const text = (raw || "").trim();
  const result = {
    customerName: "", pickupAddress: "", dropoffAddress: "",
    time: "", passengers: 1, hasLuggage: false,
    confidence: { name: 0, pickup: 0, dropoff: 0, time: 0, passengers: 0 },
  };
  if (!text) return result;

  const timeMatch = text.match(/(\d{1,2})\s*h\s*(\d{2})?/i);
  if (timeMatch) {
    const hh = timeMatch[1].padStart(2, "0");
    const mm = (timeMatch[2] || "00").padStart(2, "0");
    result.time = `${hh}:${mm}`;
    result.confidence.time = 0.95;
  }

  const paxMatch =
    text.match(/ils?\s+(?:seront|sont)\s+(\d+)/i) ||
    text.match(/nous\s+sommes\s+(\d+)/i) ||
    text.match(/(\d+)\s+personnes?/i) ||
    text.match(/(\d+)\s+passagers?/i) ||
    text.match(/à\s+(\d+)/i);
  if (paxMatch) {
    const n = parseInt(paxMatch[1], 10);
    if (n > 0 && n < 20) { result.passengers = n; result.confidence.passengers = 0.9; }
  }

  if (/valises?|bagages?|sac\s+de\s+voyage|trolley/i.test(text)) result.hasLuggage = true;

  const nameMatch = text.match(
    /(?:récupérer?|recupere|recuperer|prendre|chercher|déposer|deposer|passer\s+prendre)\s+(?:un\s+|une\s+|mr\.?\s+|m\.\s+|monsieur\s+|mme\.?\s+|madame\s+)?([^,]+?)\s+(?:à|au|aux|depuis|sur)\s+/i
  );
  if (nameMatch) {
    result.customerName = nameMatch[1].split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ").trim();
    result.confidence.name = 0.85;
  }

  const pickupMatch = text.match(/(?:à|au|aux|depuis|sur)\s+([^,]+?)\s+(?:pour|vers|afin|à destination|direction)/i);
  if (pickupMatch) { result.pickupAddress = pickupMatch[1].trim(); result.confidence.pickup = 0.8; }

  const dropoffMatch = text.match(
    /(?:ramener|emmener|conduire|déposer|deposer|aller|direction|destination)\s+(?:à|au|aux|vers|jusqu'?à)?\s*(?:la\s+|le\s+|les\s+|l')?([^,.]+?)(?:,|\s+pour\s|\s+avec|\s+et\s+|$)/i
  );
  if (dropoffMatch) { result.dropoffAddress = dropoffMatch[1].trim(); result.confidence.dropoff = 0.85; }

  const normalize = (addr) => {
    if (!addr) return addr;
    const lower = addr.toLowerCase().trim();
    let best = null, bestScore = 0;
    for (const a of KNOWN_ADDRESSES) {
      for (const alias of [a.label.toLowerCase(), ...a.aliases]) {
        if (lower.includes(alias) || alias.includes(lower)) {
          const score = alias.length;
          if (score > bestScore) { best = a; bestScore = score; }
        }
      }
    }
    return best ? best.label : addr;
  };
  result.pickupAddress = normalize(result.pickupAddress);
  result.dropoffAddress = normalize(result.dropoffAddress);

  return result;
}

/* -------------------------------------------------------------------------
   UTILS
   ------------------------------------------------------------------------- */
const eur = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
const formatDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};
const formatDate = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
// Formate une Date pour un <input type="datetime-local">, qui attend de
// l'heure LOCALE. ⚠️ Ne jamais utiliser toISOString() ici : il convertit en
// UTC, donc en France (UTC+1/+2) l'heure affichée reculait de 1 à 2 h — une
// course dictée « à 12h30 » se pré-remplissait à 10:30, et un bon créé
// « maintenant » était daté dans le passé (donc jamais listé en « Prochaine
// course » ni rappelé par les notifications).
const toLocalInput = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const genId = () => Math.random().toString(36).slice(2, 10);
const genFingerprint = () => Array.from({length:16},()=>"0123456789abcdef"[Math.floor(Math.random()*16)]).join("");

// Validation numéro TVA intracommunautaire (format de base)
const isValidVatIntra = (vat) => {
  if (!vat) return false;
  const clean = vat.replace(/\s/g, "").toUpperCase();
  return /^[A-Z]{2}[A-Z0-9]{8,12}$/.test(clean);
};

const estimatePrice = (distanceKm, durationMin) => {
  const base = 8;
  const km = (distanceKm || 0) * 2.5;
  const time = (durationMin || 0) * (35 / 60);
  return Math.max(base + km + time, 15);
};

function PseudoQR({ seed = "abc123", size = 96 }) {
  const grid = 21;
  const cells = useMemo(() => {
    const hash = (s, i) => {
      let h = 2166136261;
      for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619); }
      h ^= i; h = Math.imul(h, 16777619);
      return (h >>> 0) / 4294967295;
    };
    const arr = [];
    for (let y = 0; y < grid; y++) for (let x = 0; x < grid; x++) {
      const isFinder = (x < 7 && y < 7) || (x >= grid-7 && y < 7) || (x < 7 && y >= grid-7);
      let on = hash(seed, y*grid+x) > 0.5;
      if (isFinder) {
        const lx = x >= grid-7 ? x-(grid-7) : x;
        const ly = y >= grid-7 ? y-(grid-7) : y;
        const inBorder = lx===0||lx===6||ly===0||ly===6;
        const inCore = lx>=2&&lx<=4&&ly>=2&&ly<=4;
        on = inBorder || inCore;
      }
      arr.push({x,y,on});
    }
    return arr;
  }, [seed]);
  const cell = size/grid;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} fill="#fff" rx="4" />
      {cells.filter(c=>c.on).map((c,i)=>(
        <rect key={i} x={c.x*cell} y={c.y*cell} width={cell} height={cell} fill="#0B0B0D" />
      ))}
    </svg>
  );
}

/* -------------------------------------------------------------------------
   GLOBAL STYLES
   ------------------------------------------------------------------------- */
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

    :root {
      --bg: #0B0B0D;
      --bg-gradient: radial-gradient(ellipse at top, #18161C 0%, #0B0B0D 50%);
      --surface: #161719;
      --surface-2: #1E2024;
      --surface-3: #26282E;
      --border: #2A2C31;
      --border-soft: #1F2126;
      --text: #F5F4F1;
      --text-dim: #9CA0A8;
      --muted: #5E626B;
      --accent: #3B82F6;              /* bleu cobalt — fonds, boutons, route */
      --accent-ink: #60A5FA;          /* bleu clair lisible en texte sur sombre */
      --accent-on: #FFFFFF;           /* texte/icône posé SUR --accent */
      --accent-soft: rgba(37,99,235,0.14);
      --accent-ring: rgba(37,99,235,0.40);
      --accent-hover: #60A5FA;
      --success: #4ADE80;
      --success-soft: rgba(74,222,128,0.12);
      /* Déclinaison LISIBLE en texte (même logique que --accent-ink) :
         --success sert aux fonds/icônes, --success-ink au texte sur fond doux. */
      --success-ink: #4ADE80;
      --error: #F87171;
      --error-soft: rgba(248,113,113,0.12);
      --warn: #FBBF24;
      --warn-soft: rgba(251,191,36,0.12);
      --warn-ink: #FBBF24;
      --wa-ink: #25D366;              /* vert WhatsApp, lisible sur fond sombre */
      --nav-bg: rgba(11,11,13,0.85);
      --shadow-card: none;
      --shadow-hero: 0 20px 50px -20px rgba(0,0,0,0.7);
      --map-bg: #101114;
      --map-road: #1A1C21;
      --map-block: #16181D;
    }

    /* ─── THÈME CLAIR ─────────────────────────────────────────────────
       Activé via document.documentElement.setAttribute('data-theme','light').
       On override TOUTES les variables sombres par leur équivalent clair —
       même charte, mêmes ratios de contraste, mais en inversé. L'accent
       doré reste identique (signature TrajetPro). */
    :root[data-theme="light"] {
      /* ─── « TrajetPro Clair » ───────────────────────────────────────
         Fond papier chaud (pas cream), cartes blanches, encre quasi-noire
         comme couleur premium dominante, or de marque conservé mais
         décliné en 2 tons : --accent (vif, pour les FONDS/boutons) et
         --accent-ink (foncé, lisible en TEXTE sur clair). */
      --bg: #F6F5F2;
      --bg-gradient: radial-gradient(ellipse at top, #FFFFFF 0%, #F6F5F2 55%);
      --surface: #FFFFFF;
      --surface-2: #FBFAF7;
      --surface-3: #F1EFEA;
      --border: #ECEAE4;
      --border-soft: #F1EFEA;
      --text: #16171B;
      --text-dim: #6B6C73;
      --muted: #A7A8AE;
      --accent: #2563EB;              /* bleu cobalt — fonds, boutons, route */
      --accent-ink: #1D4ED8;          /* bleu foncé — texte lisible sur clair */
      --accent-on: #FFFFFF;           /* texte/icône posé SUR --accent */
      --accent-soft: rgba(37,99,235,0.10);
      --accent-ring: rgba(37,99,235,0.35);
      --accent-hover: #1D4ED8;
      --success: #12B76A;
      --success-soft: rgba(18,183,106,0.12);
      /* Le vert de marque #12B76A sur fond vert pâle ne donne que 2,3:1 —
         illisible pour les puces « Payée »/« Confirmée ». Version foncée
         réservée au TEXTE (7:1), le vert clair restant pour fonds et icônes. */
      --success-ink: #067647;
      --error: #E5484D;
      --error-soft: rgba(229,72,77,0.10);
      --warn: #B7791F;                /* ambre foncé lisible sur clair */
      --warn-soft: rgba(224,164,34,0.14);
      --warn-ink: #8A5A12;
      --wa-ink: #075E54;              /* vert WhatsApp foncé officiel, lisible sur clair */
      --nav-bg: rgba(255,255,255,0.86);
      --shadow-card: 0 1px 2px rgba(22,23,27,0.04), 0 8px 24px rgba(22,23,27,0.06);
      --shadow-hero: 0 22px 60px -24px rgba(22,23,27,0.28);
      --map-bg: #EDECE7;
      --map-road: #F7F6F3;
      --map-block: #E4E7DF;
    }

    * { box-sizing: border-box; }

    .tp-root {
      font-family: 'Plus Jakarta Sans', -apple-system, system-ui, sans-serif;
      background: var(--bg); color: var(--text);
      letter-spacing: -0.01em;
      -webkit-font-smoothing: antialiased;
    }
    .tp-serif { font-family: 'Fraunces', Georgia, serif; font-variation-settings: "SOFT" 50; letter-spacing: -0.02em; }
    /* tp-root : container racine qui prend tout le viewport.
       Centré horizontalement pour tablettes/desktop, mais en mobile
       il prend toute la largeur. */
    .tp-root {
      width: 100%;
      height: 100vh;
      display: flex;
      justify-content: center;
      background: var(--bg);
      overflow: hidden;
    }
    /* tp-phone : la "boîte téléphone" — exactement la hauteur de l'écran
       (incluant la safe-area du home indicator iPhone), pas de scroll
       global, layout flex column pour empiler le contenu (écran courant)
       + la nav du bas. La nav extends bien jusqu'au tout dernier pixel
       en bas → plus aucun blanc visible dans la zone home indicator. */
    .tp-phone {
      width: 100%;
      max-width: 430px;
      height: 100vh;
      display: flex;
      flex-direction: column;
      background: var(--bg-gradient);
      position: relative;
      border-left: 1px solid var(--border-soft);
      border-right: 1px solid var(--border-soft);
      overflow: hidden;
    }
    /* tp-scroll : container d'écran scrollable.
       - flex: 1 → prend tout l'espace restant dans tp-phone
       - overflow-y: auto → SEUL endroit où on scroll
       - safe-area-inset-top/bottom appliqués ICI (pas sur body)
         → le scroll reste dans le viewport visible, plus de bandes blanches
       - padding-bottom 110px = espace pour la BottomNav fixe + safe-area
       - overscroll-behavior: contain → le scroll ne "rebondit" pas vers le body
       - -webkit-overflow-scrolling: touch → scroll inertiel iOS */
    .tp-scroll {
      flex: 1;
      overflow-y: auto;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      padding-top: env(safe-area-inset-top);
      padding-bottom: calc(110px + env(safe-area-inset-bottom));
    }
    /* tp-no-scroll : modificateur pour les écrans qui doivent tenir
       en une seule vue (Accueil, BookingDetail, InvoiceDetail, Tokens, etc.).
       Override l'overflow pour empêcher tout scroll vertical sur ces écrans. */
    .tp-no-scroll {
      overflow: hidden !important;
    }

    .tp-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; box-shadow: var(--shadow-card); }
    .tp-card-elevated {
      background: linear-gradient(180deg, var(--surface-2), var(--surface));
      border: 1px solid var(--border); border-radius: 16px; box-shadow: var(--shadow-card);
    }

    .tp-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      padding: 10px 16px; border-radius: 12px; font-weight: 600; font-size: 14px;
      cursor: pointer; transition: all 0.15s ease; border: 1px solid transparent; user-select: none;
    }
    .tp-btn-primary { background: var(--accent); color: var(--accent-on); }
    .tp-btn-primary:hover { background: var(--accent-hover); transform: translateY(-1px); }
    .tp-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .tp-btn-ghost { background: var(--surface-2); color: var(--text); border-color: var(--border); }
    .tp-btn-ghost:hover { background: var(--surface-3); }
    .tp-btn-outline { background: transparent; color: var(--text); border-color: var(--border); }

    .tp-input {
      width: 100%; background: var(--surface-2); border: 1px solid var(--border);
      border-radius: 12px; padding: 12px 14px; color: var(--text);
      font-family: inherit; font-size: 14px; outline: none; transition: border-color 0.15s;
    }
    .tp-input:focus { border-color: var(--accent-ring); box-shadow: 0 0 0 3px var(--accent-soft); }
    .tp-input::placeholder { color: var(--muted); }

    .tp-label { font-size: 11px; color: var(--text-dim); font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; }

    .tp-chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
      background: var(--surface-3); color: var(--text-dim); border: 1px solid var(--border);
    }
    .tp-chip-accent { background: var(--accent-soft); color: var(--accent-ink); border-color: var(--accent-ring); }
    .tp-chip-success { background: var(--success-soft); color: var(--success-ink); border-color: var(--success-soft); }
    .tp-chip-warn { background: var(--warn-soft); color: var(--warn-ink); border-color: var(--warn-soft); }
    .tp-chip-error { background: var(--error-soft); color: var(--error); border-color: rgba(248,113,113,0.3); }

    .tp-divider { height: 1px; background: var(--border); margin: 16px 0; }

    .tp-nav {
      position: fixed; bottom: 0; left: 0; right: 0;
      background: var(--nav-bg); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      border-top: 1px solid var(--border);
      padding: 10px 14px;
      /* safe-area : laisse de la marge pour le home indicator iPhone, mais
         pas plus de 20px au minimum pour que ça reste compact partout */
      padding-bottom: max(10px, env(safe-area-inset-bottom));
      display: flex; justify-content: space-around; align-items: center; z-index: 40;
    }
    .tp-phone .tp-nav { position: absolute; max-width: 430px; margin: 0 auto; }
    .tp-nav-item {
      display: flex; flex-direction: column; align-items: center; gap: 3px;
      color: var(--muted); cursor: pointer; padding: 6px 12px; border-radius: 10px;
      transition: color 0.15s; font-size: 10px; font-weight: 600; flex: 1; min-width: 0;
    }
    .tp-nav-item.active { color: var(--accent-ink); }
    .tp-nav-mic {
      width: 56px; height: 56px; background: var(--accent); color: var(--accent-on); border-radius: 18px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 24px -6px rgba(37,99,235,0.5); cursor: pointer;
      margin-top: -18px; transition: transform 0.2s; border: none;
    }
    .tp-nav-mic:hover { transform: scale(1.05); }

    @keyframes tp-pulse {
      0% { box-shadow: 0 0 0 0 rgba(37,99,235,0.6); }
      70% { box-shadow: 0 0 0 24px rgba(37,99,235,0); }
      100% { box-shadow: 0 0 0 0 rgba(37,99,235,0); }
    }
    .tp-pulse { animation: tp-pulse 1.5s infinite; }

    @keyframes tp-wave {
      0%, 100% { transform: scaleY(0.3); }
      50% { transform: scaleY(1); }
    }
    .tp-wave-bar { width: 3px; background: var(--accent); border-radius: 2px; animation: tp-wave 1s ease-in-out infinite; }

    @keyframes tp-fade-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .tp-fade-in { animation: tp-fade-in 0.3s ease-out; }

    @keyframes tp-scale-in {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }
    .tp-scale-in { animation: tp-scale-in 0.3s cubic-bezier(0.22, 1, 0.36, 1); }

    .tp-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
      z-index: 60; display: flex; align-items: flex-end; justify-content: center; padding: 0;
    }
    .tp-phone .tp-overlay { position: absolute; max-width: 430px; margin: 0 auto; }
    .tp-sheet {
      width: 100%; background: var(--surface);
      border-top-left-radius: 24px; border-top-right-radius: 24px;
      border: 1px solid var(--border); border-bottom: none;
      /* max-height 92vh : la sheet utilise quasi tout l'écran de hauteur
         pour que les boutons "Continuer" / "Payer" rentrent confortablement
         à la fin du contenu sans avoir à scroller pour les atteindre.
         padding-bottom safe-area + 28px : zone tactile généreuse sous le
         bouton final, jamais recouvert par le home indicator iPhone. */
      max-height: 92vh; overflow-y: auto;
      padding-bottom: calc(env(safe-area-inset-bottom) + 28px);
      animation: tp-slide-up 0.3s cubic-bezier(0.22, 1, 0.36, 1);
    }
    @keyframes tp-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
    .tp-grab { width: 36px; height: 4px; background: var(--border); border-radius: 2px; margin: 10px auto 0; }
    .tp-scroll::-webkit-scrollbar { width: 0; }

    .tp-addr-chip {
      padding: 10px 12px; background: var(--surface-2); border: 1px solid var(--border);
      border-radius: 10px; cursor: pointer; transition: all 0.15s; font-size: 13px;
    }
    .tp-addr-chip:hover { border-color: var(--accent-ring); background: var(--surface-3); }

    .tp-pack-card {
      width: 100%; padding: 16px; background: var(--surface-2);
      border: 1.5px solid var(--border); border-radius: 14px;
      cursor: pointer; transition: all 0.2s;
      display: flex; align-items: center; gap: 14px;
      text-align: left; position: relative; overflow: hidden;
    }
    .tp-pack-card:hover { border-color: var(--accent-ring); transform: translateY(-1px); }
    .tp-pack-card.selected {
      border-color: var(--accent);
      background: linear-gradient(135deg, rgba(37,99,235,0.18), rgba(37,99,235,0.04));
      box-shadow: 0 6px 24px -10px rgba(37,99,235,0.6);
    }
    .tp-pack-ribbon {
      position: absolute; top: 10px; right: -28px;
      background: var(--accent); color: var(--accent-on);
      font-size: 9px; font-weight: 800;
      padding: 3px 30px; letter-spacing: 0.08em;
      transform: rotate(35deg); text-transform: uppercase;
      box-shadow: 0 2px 4px rgba(0,0,0,0.4);
    }

    @keyframes tp-spin { to { transform: rotate(360deg); } }

    /* ─── RECHERCHE D'ADRESSES (façon Uber Driver) ──────────────────── */
    .place-panel {
      position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 40;
      background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
      box-shadow: 0 14px 36px rgba(22,23,27,0.16); max-height: 340px; overflow-y: auto;
      padding: 6px; -webkit-overflow-scrolling: touch;
    }
    .place-sec {
      font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
      color: var(--text-dim); padding: 9px 10px 4px; display: flex; align-items: center; gap: 6px;
    }
    .place-card {
      width: 100%; display: flex; align-items: center; gap: 11px; padding: 9px 10px;
      border-radius: 12px; background: transparent; border: none; cursor: pointer; text-align: left;
      transition: background 0.12s ease; animation: place-in 0.18s ease both;
    }
    .place-card:hover { background: var(--surface-2); }
    .place-card:active { transform: scale(0.985); }
    .place-ic {
      width: 38px; height: 38px; border-radius: 11px; background: var(--accent-soft);
      color: var(--accent-ink); display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .place-mid { flex: 1; min-width: 0; }
    .place-name { font-size: 14px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .place-addr { font-size: 11.5px; color: var(--text-dim); margin-top: 2px; display: flex; align-items: center; gap: 6px; min-width: 0; }
    .place-addr > span.addr-txt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .place-right { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; }
    .place-dist { font-size: 12.5px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
    .place-eta { font-size: 11px; color: var(--accent-ink); font-weight: 600; }
    .place-near { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; color: var(--success); background: var(--success-soft); padding: 2px 6px; border-radius: 6px; }
    .place-star { flex-shrink: 0; padding: 6px; background: none; border: none; cursor: pointer; color: var(--muted); display: flex; }
    .place-star.on { color: var(--accent-ink); }
    @keyframes place-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .place-card { animation: none; } }

    /* ─── SPLASH SCREEN (démarrage premium) ─────────────────────────── */
    /* Logo : fondu + léger zoom 0.9 → 1.0, ~600ms, courbe douce. */
    @keyframes splash-logo {
      from { opacity: 0; transform: scale(0.9); }
      to   { opacity: 1; transform: scale(1); }
    }
    /* Sortie : fondu + léger glissement vers le haut (fade + slide). */
    @keyframes splash-exit {
      from { opacity: 1; transform: translateY(0) scale(1); }
      to   { opacity: 0; transform: translateY(-22px) scale(1.02); }
    }
    /* Barre de progression indéterminée, très fine. */
    @keyframes splash-bar {
      0%   { left: -40%; width: 40%; }
      50%  { width: 55%; }
      100% { left: 100%; width: 40%; }
    }
    .splash-logo-in { animation: splash-logo 0.6s cubic-bezier(0.22, 1, 0.36, 1) both; }
    .splash-exit { animation: splash-exit 0.44s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
    .splash-track {
      position: relative; width: 116px; height: 3px; border-radius: 3px;
      background: var(--border); overflow: hidden;
    }
    .splash-track > span {
      position: absolute; top: 0; height: 100%; border-radius: 3px;
      background: var(--accent); animation: splash-bar 1.15s ease-in-out infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .splash-logo-in, .splash-exit { animation: none; opacity: 1; transform: none; }
      .splash-track > span { animation: none; left: 0; width: 100%; }
    }
  `}</style>
);

/* -------------------------------------------------------------------------
   TOP BAR & TOKEN BADGE
   ------------------------------------------------------------------------- */
function TopBar({ title, subtitle, onBack, rightAction }) {
  // Geste de swipe depuis le bord gauche → équivalent du bouton retour.
  // Activé seulement quand onBack est fourni (donc seulement sur les écrans
  // qui ont un retour visible — les écrans racines comme Accueil n'ont pas
  // de retour et ce geste reste désactivé pour ne pas perturber le scroll).
  useEdgeSwipeBack(onBack, !!onBack);

  return (
    // Padding-top minimal : la TopBar est posée juste sous la status bar
    // iOS (gérée par tp-scroll padding-top: env(safe-area-inset-top)).
    // 6px de marge interne suffit pour aérer le titre sans laisser un
    // gros vide entre l'heure/batterie et le contenu.
    <div style={{ padding: "6px 20px 10px", display: "flex", alignItems: "center", gap: 12 }}>
      {onBack && (
        <button onClick={onBack} className="tp-btn tp-btn-ghost" style={{ padding: 8, borderRadius: 10 }}>
          <ChevronLeft size={18} />
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="tp-serif" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.1 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{subtitle}</div>}
      </div>
      {rightAction}
    </div>
  );
}

function TokenBadge({ balance, onClick, compact = false }) {
  const low = balance <= 3;
  return (
    <button
      onClick={onClick}
      className="tp-chip"
      style={{
        cursor: "pointer",
        background: low ? "var(--error-soft)" : "var(--accent-soft)",
        color: low ? "var(--error)" : "var(--accent-ink)",
        borderColor: low ? "rgba(248,113,113,0.3)" : "var(--accent-ring)",
        padding: compact ? "4px 10px" : "6px 12px",
        fontWeight: 700,
      }}
    >
      <Coins size={12}/>
      <span>{balance}</span>
      {!compact && <span style={{ opacity: 0.8, fontWeight: 500 }}> crédits</span>}
    </button>
  );
}

/* -------------------------------------------------------------------------
   HOME / DASHBOARD  —  refonte « TrajetPro Clair »
   ------------------------------------------------------------------------- */

// Temps relatif court et humain (« dans 40 min », « demain », « 12 juil. »).
function relTime(d) {
  const ms = d.getTime() - Date.now();
  if (ms < 0) return "en cours";
  const min = Math.round(ms / 60000);
  if (min < 1) return "maintenant";
  if (min < 60) return `dans ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `dans ${h} h`;
  const days = Math.round(h / 24);
  if (days === 1) return "demain";
  if (days < 7) return `dans ${days} j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// Carte RÉELLE façon Uber : géocode les adresses départ/arrivée, place un
// point A (encre) + un point B (bleu), trace la liaison, et cadre
// automatiquement les 2 points avec `fitBounds` → le zoom est proportionnel à
// la distance (proches = zoom serré, éloignés = dézoom). Tuiles CartoDB
// Positron (claires, gratuites, sans clé). Carte non-interactive (ne capte
// pas le scroll de la page). Si le géocodage échoue (hors-ligne / adresse
// introuvable), appelle `onFail` → le hero retombe sur la map décorative.
// Petit picto voiture blanc (vue de côté) pour le marqueur chauffeur en route.
const CAR_MARKER_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17H3v-5l2-5h11l3 5v5h-2"/><circle cx="7.5" cy="17" r="1.6"/><circle cx="16.5" cy="17" r="1.6"/></svg>';

function RouteMap({ pickup, dropoff, driver, onReady, onFail, onRoute, onDriverRoute }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const pickupPtRef = useRef(null);        // coords géocodées de la prise en charge
  const dropoffPtRef = useRef(null);       // coords géocodées de la dépose
  const driverMarkerRef = useRef(null);    // marqueur voiture (chauffeur)
  const driverLineRef = useRef(null);      // tracé chauffeur → client
  const lastDriverRouteRef = useRef(0);    // throttle du recalcul (timestamp)

  // ── Init carte (une seule fois par couple prise en charge / dépose) ──────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [a, b] = await Promise.all([geocode(pickup), geocode(dropoff)]);
      if (cancelled) return;
      const el = containerRef.current;
      if (!el) return;
      if (!a && !b) { onFail && onFail(); return; }
      pickupPtRef.current = a || null;
      dropoffPtRef.current = b || null;

      const map = L.map(el, {
        zoomControl: false, attributionControl: false,
        dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
        touchZoom: false, boxZoom: false, keyboard: false, tap: false,
        zoomSnap: 0.25,
      });
      mapRef.current = map;

      // Le fond de carte doit suivre le thème : en sombre, le basemap clair
      // faisait un rectangle blanc éblouissant au milieu de l'écran (et le
      // repli décoratif AmbientMap, lui, respecte déjà les tokens de thème).
      const isDarkTheme = document.documentElement.getAttribute('data-theme') !== 'light';
      const basemap = isDarkTheme ? 'dark_all' : 'light_all';
      const markerRing = isDarkTheme ? '#1E2024' : '#fff';
      L.tileLayer(`https://{s}.basemaps.cartocdn.com/${basemap}/{z}/{x}/{y}{r}.png`, {
        subdomains: 'abcd', maxZoom: 19,
      }).addTo(map);

      const mk = (bg, radius) => L.divIcon({
        className: '',
        html: `<div style="width:16px;height:16px;border-radius:${radius};background:${bg};border:3px solid ${markerRing};box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
        iconSize: [16, 16], iconAnchor: [8, 8],
      });

      const pts = [];
      if (a) { L.marker([a.lat, a.lng], { icon: mk('#16171B', '50%') }).addTo(map); pts.push([a.lat, a.lng]); }
      if (b) { L.marker([b.lat, b.lng], { icon: mk('#2563EB', '4px') }).addTo(map); pts.push([b.lat, b.lng]); }

      if (pts.length === 2) map.fitBounds(pts, { padding: [36, 36], maxZoom: 15 });
      else map.setView(pts[0], 14);
      setTimeout(() => { if (!cancelled && mapRef.current) map.invalidateSize(); }, 60);

      if (a && b) {
        const route = await routeBetween(a, b);
        if (cancelled || !mapRef.current) return;
        const line = (route && route.coords.length > 1) ? route.coords : [[a.lat, a.lng], [b.lat, b.lng]];
        L.polyline(line, { color: '#2563EB', weight: 4, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }).addTo(map);
        if (!driver) map.fitBounds(line, { padding: [36, 36], maxZoom: 15 });
        if (route && onRoute) onRoute({ distanceKm: route.distance / 1000, durationMin: route.duration / 60 });
        setTimeout(() => { if (!cancelled && mapRef.current) map.invalidateSize(); }, 30);
      }
      onReady && onReady();
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      driverMarkerRef.current = null; driverLineRef.current = null;
    };
  }, [pickup, dropoff]);

  // ── Suivi chauffeur : marqueur voiture qui bouge + route chauffeur→client ─
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Fin de course : on retire le marqueur / le tracé chauffeur et on recadre
    // la carte sur le trajet complet (prise en charge → dépose).
    if (!driver || !pickupPtRef.current) {
      const hadDriver = !!driverMarkerRef.current;
      if (driverMarkerRef.current) { map.removeLayer(driverMarkerRef.current); driverMarkerRef.current = null; }
      if (driverLineRef.current) { map.removeLayer(driverLineRef.current); driverLineRef.current = null; }
      if (hadDriver && pickupPtRef.current && dropoffPtRef.current) {
        map.fitBounds([[pickupPtRef.current.lat, pickupPtRef.current.lng], [dropoffPtRef.current.lat, dropoffPtRef.current.lng]], { padding: [36, 36], maxZoom: 15 });
      }
      return;
    }

    const carRing = document.documentElement.getAttribute('data-theme') === 'light' ? '#fff' : '#1E2024';
    const carIcon = L.divIcon({
      className: '',
      html: `<div style="width:30px;height:30px;border-radius:50%;background:#2563EB;border:3px solid ${carRing};box-shadow:0 3px 10px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center">${CAR_MARKER_SVG}</div>`,
      iconSize: [30, 30], iconAnchor: [15, 15],
    });
    if (!driverMarkerRef.current) {
      driverMarkerRef.current = L.marker([driver.lat, driver.lng], { icon: carIcon, zIndexOffset: 1000 }).addTo(map);
    } else {
      driverMarkerRef.current.setLatLng([driver.lat, driver.lng]); // déplacement fluide
    }

    // Recalcul route chauffeur→client throttlé (~15s) pour ménager OSRM ; on
    // recadre la carte à ce moment-là (pas à chaque fix GPS → moins de saccades).
    let cancelled = false;
    const p = pickupPtRef.current;
    const now = Date.now();
    if (now - lastDriverRouteRef.current > 15000 || !driverLineRef.current) {
      lastDriverRouteRef.current = now;
      routeBetween(driver, p).then((route) => {
        if (cancelled || !mapRef.current) return;
        const coords = (route && route.coords.length > 1) ? route.coords : [[driver.lat, driver.lng], [p.lat, p.lng]];
        if (driverLineRef.current) driverLineRef.current.setLatLngs(coords);
        else driverLineRef.current = L.polyline(coords, { color: '#2563EB', weight: 4, opacity: 0.6, dashArray: '1 9', lineCap: 'round' }).addTo(map);
        map.fitBounds([[driver.lat, driver.lng], [p.lat, p.lng]], { padding: [42, 42], maxZoom: 16 });
        if (route && onDriverRoute) onDriverRoute({ distanceKm: route.distance / 1000, durationMin: route.duration / 60 });
      });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver?.lat, driver?.lng]);

  return <div ref={containerRef} aria-label="Carte du trajet" style={{ position: "absolute", inset: 0, background: "var(--map-bg)" }} />;
}

// Suivi de la position du chauffeur (GPS). Actif seulement quand `active` est
// vrai (course démarrée). Utilise l'API navigator.geolocation — fonctionne en
// web ET dans la WebView Capacitor (permissions iOS/Android déjà configurées).
function useDriverLocation(active) {
  const [pos, setPos] = useState(null);      // { lat, lng, accuracy } | null
  const [error, setError] = useState(null);  // 'denied' | 'unavailable' | null
  useEffect(() => {
    if (!active) { setPos(null); setError(null); return; }
    if (typeof navigator === "undefined" || !navigator.geolocation) { setError("unavailable"); return; }
    const id = navigator.geolocation.watchPosition(
      (p) => { setError(null); setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }); },
      (err) => { setError(err && err.code === 1 ? "denied" : "unavailable"); },
      { enableHighAccuracy: true, maximumAge: 8000, timeout: 20000 }
    );
    return () => { try { navigator.geolocation.clearWatch(id); } catch { /* noop */ } };
  }, [active]);
  return { pos, error };
}

// Fond « map » ambiant (décoratif, sans dépendance cartographique). Les blocs
// et routes sont des formes CSS ; la ligne d'itinéraire dorée relie un point A
// (encre) à un point B (or). Purement esthétique — les adresses réelles sont
// affichées en texte dans la fiche. Une vraie carte géolocalisée viendra plus
// tard si besoin. Les couleurs suivent les variables de thème (clair/sombre).
function AmbientMap({ withRoute = true }) {
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", background: "var(--map-bg)" }}>
      <div style={{ position: "absolute", width: 128, height: 100, left: -18, top: 18, background: "var(--map-block)", borderRadius: "46% 54% 50% 50%" }}/>
      <div style={{ position: "absolute", width: 92, height: 78, right: -12, bottom: 4, background: "var(--map-block)", borderRadius: "52% 46% 54% 48%" }}/>
      <div style={{ position: "absolute", width: 60, height: 48, left: "44%", top: -14, background: "var(--map-block)", borderRadius: 18 }}/>
      <div style={{ position: "absolute", left: -40, top: 66, width: "170%", height: 12, background: "var(--map-road)", transform: "rotate(-11deg)" }}/>
      <div style={{ position: "absolute", left: "63%", top: -30, width: 12, height: "180%", background: "var(--map-road)", transform: "rotate(8deg)" }}/>
      {withRoute && (
        <>
          <svg viewBox="0 0 320 160" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            <path d="M52 42 C 132 58, 118 118, 250 122" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round"/>
          </svg>
          <span style={{ position: "absolute", left: "16%", top: "26%", width: 15, height: 15, borderRadius: "50%", background: "var(--text)", border: "3px solid var(--surface)", boxShadow: "0 2px 6px rgba(0,0,0,0.25)" }}/>
          <span style={{ position: "absolute", left: "78%", top: "76%", width: 15, height: 15, borderRadius: "50%", background: "var(--accent)", border: "3px solid var(--surface)", boxShadow: "0 2px 6px rgba(0,0,0,0.25)" }}/>
        </>
      )}
    </div>
  );
}

// Hero « prochaine course » : fond map + fiche coulissante (bottom-sheet) qui
// remonte par-dessus. C'est la signature visuelle inspirée des références.
/* -------------------------------------------------------------------------
   NAVIGATION GPS — ouvre Google Maps / Waze / Plans vers une adresse
   ------------------------------------------------------------------------- */
// Détection iOS (pour proposer Apple Plans).
function isIOSPlatform() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const capIOS = typeof window !== "undefined" && window.Capacitor && typeof window.Capacitor.getPlatform === "function" && window.Capacitor.getPlatform() === "ios";
  return /iPad|iPhone|iPod/.test(ua) || !!capIOS;
}

// Liens UNIVERSELS : ouvrent l'app native si installée, sinon le navigateur
// (Google Maps web) — ce qui assure le repli demandé sans code spécifique.
function buildNavUrl(provider, address) {
  const q = encodeURIComponent(address || "");
  switch (provider) {
    case "waze":  return `https://waze.com/ul?q=${q}&navigate=yes`;
    case "apple": return `https://maps.apple.com/?daddr=${q}&dirflg=d`;
    case "google":
    default:      return `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
  }
}

// Ouvre une URL en externe SANS quitter l'app (l'app reste en arrière-plan et
// l'utilisateur la retrouve à l'écran exact où il était).
function openExternalUrl(url) {
  try {
    if (typeof isNativePlatform === "function" && isNativePlatform()) window.open(url, "_system");
    else window.open(url, "_blank", "noopener");
  } catch { try { window.location.href = url; } catch { /* noop */ } }
}

const GPS_OPTIONS = [
  { id: "google", label: "Google Maps" },
  { id: "waze",   label: "Waze" },
  { id: "apple",  label: "Plans (Apple)", iosOnly: true },
];

// Feuille de choix du GPS (bottom sheet). Filtre Apple Plans hors iOS.
function NavSheet({ open, address, onClose, onPick }) {
  if (!open) return null;
  const opts = GPS_OPTIONS.filter(o => !o.iosOnly || isIOSPlatform());
  return (
    <div className="tp-overlay" onClick={onClose}>
      <div className="tp-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: "auto" }}>
        <div className="tp-grab"/>
        <div style={{ padding: "16px 20px 6px" }}>
          <div className="tp-serif" style={{ fontSize: 18, fontWeight: 600 }}>Ouvrir l'itinéraire dans…</div>
          <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}>
            <MapPin size={12} style={{ flexShrink: 0 }}/>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{address}</span>
          </div>
        </div>
        <div style={{ padding: "6px 16px" }}>
          {opts.map(o => (
            <button key={o.id} onClick={() => onPick(o.id)} className="tp-card" style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: 14, marginBottom: 10, cursor: "pointer", background: "var(--surface)", color: "var(--text)", textAlign: "left" }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--accent-soft)", color: "var(--accent-ink)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Navigation size={18}/></div>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{o.label}</span>
              <ChevronRight size={16} style={{ marginLeft: "auto", color: "var(--text-dim)" }}/>
            </button>
          ))}
          <button onClick={onClose} className="tp-btn tp-btn-ghost" style={{ width: "100%", marginTop: 2, marginBottom: 8 }}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

// Hook partagé : gère l'ouverture directe (GPS par défaut) ou la feuille de
// choix, pour le hero ET la fiche détaillée.
function useNavigate(defaultGps) {
  const [nav, setNav] = useState({ open: false, address: "" });
  const start = (address) => {
    if (!address) return;
    if (defaultGps && defaultGps !== "ask") { openExternalUrl(buildNavUrl(defaultGps, address)); return; }
    setNav({ open: true, address });
  };
  const pick = (provider) => { openExternalUrl(buildNavUrl(provider, nav.address)); setNav({ open: false, address: "" }); };
  const close = () => setNav({ open: false, address: "" });
  return { nav, start, pick, close };
}

// Appel téléphonique direct (tel:) — n'interrompt pas l'app.
function callClient(phone) {
  const p = (phone || "").replace(/[^\d+]/g, "");
  if (p) openExternalUrl(`tel:${p}`);
}

// SMS au client (sms:) avec message optionnel pré-rempli. iOS attend `&body=`,
// Android `?body=` — on adapte selon la plateforme.
function smsClient(phone, message) {
  const p = (phone || "").replace(/[^\d+]/g, "");
  if (!p) return;
  const sep = isIOSPlatform() ? "&" : "?";
  const body = message ? `${sep}body=${encodeURIComponent(message)}` : "";
  openExternalUrl(`sms:${p}${body}`);
}

function NextCourseHero({ next, onOpen, onNew, activeTripId, onStartTrip, onEndTrip, defaultGps }) {
  const [mapFailed, setMapFailed] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);       // trajet client→dépose (OSRM)
  const [driverRoute, setDriverRoute] = useState(null);   // chauffeur→client (en route)
  const [, setTick] = useState(0);                        // tick 30s (ETA/compte à rebours live)
  const tripTotalRef = useRef(null);                      // distance de départ (pour la progression)
  const canMap = !!next && !!(next.pickupAddress || next.dropoffAddress);

  // Course en cours (chauffeur en route) = celle affichée dans le hero.
  const enRoute = !!next && !!activeTripId && activeTripId === next.id;
  const { pos: driverPos, error: geoError } = useDriverLocation(enRoute);
  const { nav, start: startNav, pick: pickNav, close: closeNav } = useNavigate(defaultGps);
  // Destination : adresse de prise en charge avant la course, dépose pendant.
  const navDest = enRoute ? (next?.dropoffAddress || next?.pickupAddress) : (next?.pickupAddress || next?.dropoffAddress);

  useEffect(() => { setMapFailed(false); setRouteInfo(null); }, [next?.pickupAddress, next?.dropoffAddress]);
  useEffect(() => { if (!enRoute) { setDriverRoute(null); tripTotalRef.current = null; } }, [enRoute]);
  useEffect(() => {
    const id = setInterval(() => setTick(t => (t + 1) % 1000000), 30000);
    return () => clearInterval(id);
  }, []);

  // ── Calculs façon Uber ────────────────────────────────────────────────
  const pickupDate = next ? new Date(next.dateTime) : null;
  const distKm = routeInfo?.distanceKm ?? (next?.distance ? Number(next.distance) : null);
  const durMin = routeInfo ? Math.round(routeInfo.durationMin) : (next?.duration ? Number(next.duration) : null);
  const etaDate = (pickupDate && durMin != null) ? new Date(pickupDate.getTime() + durMin * 60000) : null;
  const nowD = new Date();
  const isToday = pickupDate && pickupDate.toDateString() === nowD.toDateString();
  const isTomorrow = pickupDate && (() => { const t = new Date(nowD); t.setDate(t.getDate() + 1); return pickupDate.toDateString() === t.toDateString(); })();
  const hhmm = (d) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const fmtKm = (km) => `${km.toFixed(1).replace(".", ",")} km`;

  // En route : distance/temps RESTANTS (chauffeur → client) + ETA = maintenant + restant.
  const remainKm = driverRoute?.distanceKm ?? null;
  const remainMin = driverRoute ? Math.max(0, Math.round(driverRoute.durationMin)) : null;
  const arrivalAtClient = (enRoute && remainMin != null) ? new Date(Date.now() + remainMin * 60000) : null;
  if (enRoute && remainKm != null && (tripTotalRef.current == null || remainKm > tripTotalRef.current)) tripTotalRef.current = remainKm;
  const progress = (enRoute && remainKm != null && tripTotalRef.current) ? Math.min(1, Math.max(0, 1 - remainKm / tripTotalRef.current)) : 0;

  return (
    // `isolation: isolate` crée un contexte d'empilement local : sans lui, les
    // panes internes de Leaflet (z-index jusqu'à 600) et le badge ci-dessous
    // (700) étaient comparés aux z-index de TOUTE la page — la carte et le
    // badge passaient donc PAR-DESSUS les modales et feuilles de l'app.
    <div style={{ position: "relative", isolation: "isolate", borderRadius: 22, overflow: "hidden", border: "1px solid var(--border)", boxShadow: "var(--shadow-hero)", background: "var(--surface)" }}>
      {/* MAP */}
      <div style={{ position: "relative", height: 150 }}>
        {canMap && !mapFailed
          ? <RouteMap pickup={next.pickupAddress} dropoff={next.dropoffAddress} driver={enRoute ? driverPos : null} onFail={() => setMapFailed(true)} onRoute={setRouteInfo} onDriverRoute={setDriverRoute} />
          : <AmbientMap withRoute={!!next} />}
        <div style={{ position: "absolute", top: 12, left: 14, zIndex: 2, display: "inline-flex", alignItems: "center", gap: 6, background: enRoute ? "var(--accent)" : "var(--nav-bg)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", padding: "5px 11px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: enRoute ? "var(--accent-on)" : "var(--accent-ink)", border: enRoute ? "none" : "1px solid var(--border)" }}>
          {enRoute ? <Car size={11}/> : <Navigation size={11}/>} {enRoute ? "En route" : (next ? "Prochaine course" : "Rien de prévu")}
        </div>
      </div>
      {/* FICHE (bottom-sheet) */}
      <div style={{ position: "relative", marginTop: -18, background: "var(--surface)", borderRadius: "22px 22px 0 0", padding: "6px 16px 16px" }}>
        <div style={{ width: 38, height: 4, borderRadius: 3, background: "var(--border)", margin: "0 auto 12px" }}/>
        {next ? (
          <>
            {/* En-tête : heure prévue OU statut « en route » */}
            {enRoute ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--accent-ink)", fontWeight: 700, fontSize: 15 }}>
                  <Car size={16}/> En route vers le client
                </span>
                <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 600 }}>· prise en charge {relTime(pickupDate)}</span>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span className="tp-serif" style={{ fontSize: 24, fontWeight: 600, lineHeight: 1 }}>{hhmm(pickupDate)}</span>
                <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 600 }}>
                  · {relTime(pickupDate)}{next.phone ? ` · ${maskPhone(next.phone)}` : ""}
                </span>
              </div>
            )}

            {/* Adresses (rail A→B) — commun aux deux modes */}
            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--text)" }}/>
                <span style={{ width: 2, flex: 1, minHeight: 20, margin: "3px 0", background: "repeating-linear-gradient(var(--muted) 0 3px, transparent 3px 7px)" }}/>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--accent)" }}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Prise en charge</div>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{next.pickupAddress || "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Dépose</div>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{next.dropoffAddress || "—"}</div>
                </div>
              </div>
            </div>

            {enRoute ? (
              /* ── MODE EN ROUTE : distance/temps RESTANTS + progression live ── */
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                {geoError ? (
                  <div style={{ fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.5 }}>
                    {geoError === "denied"
                      ? "Localisation refusée — activez-la dans les réglages pour le suivi en temps réel."
                      : "Localisation indisponible sur cet appareil."}
                  </div>
                ) : !driverPos ? (
                  <div style={{ fontSize: 12.5, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 8 }}>
                    <Loader2 size={14} style={{ animation: "tp-spin 1s linear infinite", color: "var(--accent-ink)" }}/> Localisation en cours…
                  </div>
                ) : (
                  <>
                    {/* Barre de progression avec voiture à la position du trajet */}
                    <div style={{ position: "relative", height: 12, marginBottom: 12 }}>
                      <div style={{ position: "absolute", top: 5, left: 0, right: 0, height: 3, borderRadius: 3, background: "var(--accent)", opacity: 0.22 }}/>
                      <div style={{ position: "absolute", top: 5, left: 0, width: `${progress * 100}%`, height: 3, borderRadius: 3, background: "var(--accent)" }}/>
                      <span style={{ position: "absolute", top: 1, left: `calc(${progress * 100}% - 6px)`, width: 12, height: 12, borderRadius: "50%", background: "var(--accent)", border: "2px solid var(--surface)", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }}/>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 13, fontWeight: 600 }}>
                        {remainKm != null && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Navigation size={13} style={{ color: "var(--accent-ink)" }}/>{fmtKm(remainKm)} restants</span>}
                        {remainMin != null && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Clock size={13} style={{ color: "var(--accent-ink)" }}/>{remainMin} min</span>}
                      </div>
                      {arrivalAtClient && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--success-soft)", color: "var(--success)", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)" }}/> Arrivée {hhmm(arrivalAtClient)}
                        </span>
                      )}
                    </div>
                  </>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  {next.phone && <button onClick={() => callClient(next.phone)} className="tp-btn tp-btn-ghost" style={{ flex: 1, padding: "11px 6px", fontSize: 13 }}><Phone size={15}/> Appeler</button>}
                  <button onClick={() => startNav(navDest)} className="tp-btn tp-btn-ghost" style={{ flex: 1, padding: "11px 6px", fontSize: 13 }}><Navigation size={15}/> Naviguer</button>
                </div>
                <button onClick={onEndTrip} className="tp-btn tp-btn-primary" style={{ width: "100%", marginTop: 8, padding: 13, borderRadius: 14, fontSize: 14.5 }}><Check size={16}/> Je suis arrivé</button>
              </div>
            ) : (
              /* ── MODE PLANIFIÉ : distance • durée • ETA ── */
              <>
                {(distKm != null || durMin != null) && (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--text)", flexShrink: 0 }}/>
                      <span style={{ flex: 1, height: 3, borderRadius: 3, background: "var(--accent)", opacity: 0.35 }}/>
                      <Car size={14} style={{ color: "var(--accent-ink)", flexShrink: 0 }}/>
                      <span style={{ flex: 1, height: 3, borderRadius: 3, background: "var(--accent)", opacity: 0.35 }}/>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--accent)", flexShrink: 0 }}/>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 13, fontWeight: 600 }}>
                        {distKm != null && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Navigation size={13} style={{ color: "var(--accent-ink)" }}/>{fmtKm(distKm)}</span>}
                        {durMin != null && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Clock size={13} style={{ color: "var(--accent-ink)" }}/>{durMin} min</span>}
                      </div>
                      {etaDate && isToday && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--success-soft)", color: "var(--success)", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)" }}/> Arrivée estimée {hhmm(etaDate)}
                        </span>
                      )}
                    </div>
                    {etaDate && !isToday && (
                      <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--text-dim)", fontWeight: 600 }}>
                        Départ {isTomorrow ? "demain" : `le ${pickupDate.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`} à {hhmm(pickupDate)} · Arrivée estimée {hhmm(etaDate)}
                      </div>
                    )}
                  </div>
                )}

                {/* Prix + client */}
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginTop: 14 }}>
                  <span className="tp-serif" style={{ fontSize: 24, fontWeight: 600 }}>{eur(next.price)}</span>
                  <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "55%" }}>{next.customerName}</span>
                </div>
                {/* Actions rapides : Appeler · Naviguer · Ouvrir */}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {next.phone && <button onClick={() => callClient(next.phone)} className="tp-btn tp-btn-ghost" style={{ flex: 1, padding: "11px 6px", fontSize: 13 }}><Phone size={15}/> Appeler</button>}
                  <button onClick={() => startNav(navDest)} className="tp-btn tp-btn-ghost" style={{ flex: 1, padding: "11px 6px", fontSize: 13 }}><Navigation size={15}/> Naviguer</button>
                  <button onClick={() => onOpen(next)} className="tp-btn tp-btn-ghost" style={{ flex: 1, padding: "11px 6px", fontSize: 13 }}>Ouvrir <ChevronRight size={15}/></button>
                </div>
                {isToday && onStartTrip && (
                  <button onClick={() => onStartTrip(next)} className="tp-btn tp-btn-primary" style={{ width: "100%", marginTop: 8, padding: 13, borderRadius: 14, fontSize: 14.5 }}>
                    <Car size={16}/> Démarrer la course
                  </button>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: "var(--text-dim)", textAlign: "center", marginBottom: 12, lineHeight: 1.5 }}>
              Aucune course à venir.<br/>Dictez votre prochaine course en 5 secondes.
            </div>
            <button onClick={onNew} className="tp-btn tp-btn-primary" style={{ width: "100%", padding: 13, borderRadius: 14, fontSize: 14.5 }}>
              <Mic size={17}/> Nouveau bon vocal
            </button>
          </>
        )}
      </div>
      {typeof document !== "undefined" && createPortal(
        <NavSheet open={nav.open} address={nav.address} onClose={closeNav} onPick={pickNav}/>,
        document.querySelector(".tp-phone") || document.body
      )}
    </div>
  );
}

function HomeScreen({ bookings, invoices, tokenBalance, isGuest, currentUser, onQuickVoice, onNewBooking, onOpenBooking, onGoTab, onOpenPurchase, onPromptSignup, setAgendaOpen, activeTripId, onStartTrip, onEndTrip, defaultGps }) {
  const today = new Date();
  const todayBookings = bookings.filter(b => new Date(b.dateTime).toDateString() === today.toDateString());
  const weekRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);

  // Courses futures triées : la prochaine sert de hero, le reste alimente la liste.
  const now = Date.now();
  const upcoming = bookings
    .filter(b => new Date(b.dateTime).getTime() > now)
    .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))
    .slice(0, 20);
  // La course EN COURS reste le hero même une fois son heure de prise en
  // charge dépassée (retard, trajet d'approche) : sinon, à 14h03 pour une
  // course de 14h00 démarrée à 13h50, le suivi GPS et le bouton
  // « Je suis arrivé » disparaissaient et la course devenait interminable.
  const activeTrip = activeTripId ? bookings.find(b => b.id === activeTripId) : null;
  const next = activeTrip || upcoming[0] || null;
  const rest = upcoming.filter(b => b.id !== next?.id);

  return (
    // Scroll unique (comme les apps de référence), plus simple et plus aéré
    // que l'ancien header fixe + liste. La BottomNav reste gérée par le parent.
    <div className="tp-fade-in" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <div style={{
        flex: 1,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        overscrollBehavior: "contain",
        paddingTop: "calc(env(safe-area-inset-top) + 12px)",
        paddingBottom: "calc(110px + env(safe-area-inset-bottom))",
        paddingLeft: 20, paddingRight: 20,
        minHeight: 0,
      }}>
        {/* Salutation + crédits */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>
              {today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            <h1 className="tp-serif" style={{ fontSize: 30, fontWeight: 600, margin: "6px 0 0", lineHeight: 1.1 }}>
              Bonjour,{" "}
              <span style={{ color: "var(--accent-ink)" }}>{currentUser?.name?.split(' ')[0] || DRIVER_PROFILE.firstName}</span>.
            </h1>
          </div>
          <TokenBadge balance={tokenBalance} onClick={() => onGoTab("tokens")}/>
        </div>

        {isGuest && <div style={{ marginTop: 12 }}><GuestBanner onSignup={onPromptSignup}/></div>}

        {/* HERO : prochaine course sur fond map */}
        <div style={{ marginTop: 16 }}>
          <NextCourseHero next={next} onOpen={onOpenBooking} onNew={onQuickVoice} activeTripId={activeTripId} onStartTrip={onStartTrip} onEndTrip={onEndTrip} defaultGps={defaultGps}/>
        </div>

        {/* Stats */}
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="tp-card" style={{ padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-dim)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <Calendar size={12} /> Aujourd'hui
            </div>
            <div className="tp-serif" style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>{todayBookings.length}</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>course{todayBookings.length > 1 ? "s" : ""} prévue{todayBookings.length > 1 ? "s" : ""}</div>
          </div>
          <div className="tp-card" style={{ padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-dim)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <TrendingUp size={12} /> CA encaissé
            </div>
            <div className="tp-serif" style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>{eur(weekRevenue)}</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>cette semaine</div>
          </div>
        </div>

        {/* Vocal */}
        <div style={{ marginTop: 12 }}>
          <button onClick={onQuickVoice} className="tp-card" style={{
            width: "100%", padding: 16, display: "flex", alignItems: "center", gap: 14,
            cursor: "pointer", textAlign: "left", border: "1px solid var(--accent-ring)",
            background: "linear-gradient(135deg, var(--accent-soft), transparent)",
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent)", color: "var(--accent-on)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px -6px var(--accent-ring)", flexShrink: 0 }}>
              <Mic size={22} strokeWidth={2.2}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>Nouveau bon vocal</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
                Dictez votre course · <span style={{ color: "var(--accent-ink)", fontWeight: 600 }}>1 crédit</span>
              </div>
            </div>
            <Sparkles size={18} style={{ color: "var(--accent-ink)", flexShrink: 0 }}/>
          </button>
        </div>

        {/* Actions rapides */}
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[
            { icon: Plus, label: "Manuel", onClick: onNewBooking },
            { icon: Car, label: "Courses", onClick: () => onGoTab("bookings") },
            { icon: Receipt, label: "Factures", onClick: () => onGoTab("invoices") },
            { icon: Calendar, label: "Agenda", onClick: () => setAgendaOpen(true) },
          ].map((a, i) => (
            <button key={i} onClick={a.onClick} className="tp-card" style={{ padding: "12px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <a.icon size={20} style={{ color: "var(--accent-ink)" }}/>
              <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.01em" }}>{a.label}</span>
            </button>
          ))}
        </div>

        {/* Reste des prochaines courses */}
        {rest.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "20px 0 10px" }}>
              <div className="tp-serif" style={{ fontSize: 18, fontWeight: 600 }}>À suivre</div>
              <button onClick={() => onGoTab("bookings")} style={{ fontSize: 12, color: "var(--accent-ink)", fontWeight: 600, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 2 }}>
                Tout voir <ArrowUpRight size={12}/>
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rest.map(b => <BookingCard key={b.id} booking={b} onClick={() => onOpenBooking(b)} />)}
            </div>
          </>
        )}

        {/* Conformité */}
        <div style={{ marginTop: 16 }}>
          <div className="tp-card" style={{ padding: 14, display: "flex", gap: 12, alignItems: "center", background: "linear-gradient(135deg, var(--success-soft), transparent)", border: "1px solid var(--success-soft)" }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--success-soft)", color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Shield size={18}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em" }}>Conformité décret 2017-483</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2, lineHeight: 1.4 }}>Tous vos bons comportent les mentions obligatoires</div>
            </div>
            <CheckCircle2 size={18} style={{ color: "var(--success)", flexShrink: 0 }}/>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   BOOKING CARD
   ------------------------------------------------------------------------- */
function BookingCard({ booking, onClick }) {
  const d = new Date(booking.dateTime);
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const day = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  const isPending = booking.status === "pending";

  return (
    <button onClick={onClick} className="tp-card" style={{
      width: "100%", padding: 14, display: "flex", gap: 12,
      textAlign: "left", cursor: "pointer", background: "var(--surface)", alignItems: "stretch",
    }}>
      <div style={{ width: 54, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRight: "1px solid var(--border)", paddingRight: 10 }}>
        <div className="tp-serif" style={{ fontSize: 20, fontWeight: 600, lineHeight: 1, color: "var(--accent-ink)" }}>{time}</div>
        <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{day}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{booking.customerName}</div>
          <span className={`tp-chip ${isPending ? "tp-chip-warn" : "tp-chip-success"}`}>{isPending ? "En attente" : "Confirmée"}</span>
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          {/* Rail A → B (encre → bleu), cohérent avec le hero et le formulaire */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--text)", flexShrink: 0 }}/>
            <span style={{ width: 2, flex: 1, minHeight: 8, margin: "2px 0", background: "repeating-linear-gradient(var(--muted) 0 2px, transparent 2px 5px)" }}/>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--accent)", flexShrink: 0 }}/>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{booking.pickupAddress}</span>
            <span style={{ fontSize: 12, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{booking.dropoffAddress}</span>
          </div>
        </div>
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "var(--text-dim)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Users size={11}/> {booking.passengers}</span>
          {booking.hasLuggage && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Briefcase size={11}/> Bagages</span>}
          <span style={{ marginLeft: "auto", color: "var(--accent-ink)", fontWeight: 700, fontSize: 13 }}>{eur(booking.price)}</span>
        </div>
      </div>
    </button>
  );
}

/* -------------------------------------------------------------------------
   VOICE CAPTURE MODAL
   ------------------------------------------------------------------------- */
function VoiceCapture({ open, onClose, onConfirm }) {
  // ---- États ----
  const [listening, setListeningState] = useState(false);
  // Miroir en ref : `r.onend` (posé dans startNewRecognition) capture la valeur
  // de `listening` AU MOMENT où la session est créée — or start() crée la
  // session AVANT setListening(true), donc la closure voyait toujours `false`
  // et le redémarrage automatique après une coupure Chrome (~2 s de silence)
  // ne se déclenchait jamais : la suite de la dictée était perdue.
  const listeningRef = useRef(false);
  const setListening = (v) => { listeningRef.current = v; setListeningState(v); };
  const [transcript, setTranscript] = useState("");        // texte cumulé (final + interim)
  const [finalTranscript, setFinalTranscript] = useState(""); // que les chunks finalisés
  const [parsed, setParsed] = useState(null);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState("");
  const [silenceCountdown, setSilenceCountdown] = useState(0); // 5..0 quand on s'approche du timeout

  // ---- Raffinement IA via Claude (Edge Function voice-extract) ----
  // Stratégie : le parser local (parseVoiceCommandV2) tourne en preview live
  // pendant que l'ASR transcrit (instantané, gratuit). Quand l'ASR finalise,
  // on appelle Claude pour nettoyer la transcription et corriger les noms à
  // accents étrangers + lieux phonétiquement bruités. Si Claude échoue, on
  // garde le résultat local (déjà rendu) — l'utilisateur n'est jamais bloqué.
  const [aiLoading, setAiLoading] = useState(false);   // un appel cloud est en cours
  const [aiResult, setAiResult] = useState(null);      // dernier JSON Claude { transcription_corrigee, champs_incertains, confiance, ... }
  const [aiError, setAiError] = useState("");          // message d'erreur cloud (silencieux UI, pour debug)
  const aiCallIdRef = useRef(0);                       // identifiant pour ignorer les réponses obsolètes (race condition)

  // ---- Refs (n'invoquent pas le re-render) ----
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const finalTranscriptRef = useRef("");
  const isStoppingRef = useRef(false);     // évite la double-fermeture

  // Durée de silence avant arrêt automatique. L'API SpeechRecognition de
  // Chrome/Safari coupe parfois après ~2s de silence ; on contrebalance en
  // relançant la session quand 'onend' arrive trop tôt, et on tient notre
  // propre minuterie pour décider du vrai arrêt.
  const SILENCE_TIMEOUT_MS = 5000;

  // ----- Cleanup quand on ferme la modale -----
  useEffect(() => {
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) setSupported(false);
    return () => cleanupAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) {
      cleanupAll();
      setTranscript("");
      setFinalTranscript("");
      finalTranscriptRef.current = "";
      setParsed(null);
      setError("");
      setListening(false);
      setSilenceCountdown(0);
      setAiLoading(false);
      setAiResult(null);
      setAiError("");
      aiCallIdRef.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function cleanupAll() {
    isStoppingRef.current = true;
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
    try { recognitionRef.current?.stop(); } catch(_) {}
    try { recognitionRef.current?.abort?.(); } catch(_) {}
    recognitionRef.current = null;
  }

  // Reset du timer de silence : à chaque nouveau résultat (interim ou final),
  // on relance le compte à rebours de 5s. Si rien n'arrive pendant 5s, on
  // arrête proprement.
  function resetSilenceTimer() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setSilenceCountdown(0);

    // Lance un compte à rebours visuel à partir de 3 secondes restantes
    // (= 2 secondes après le dernier mot, on commence à afficher le countdown)
    silenceTimerRef.current = setTimeout(() => {
      // 2s écoulées sans son, on commence à afficher 3..2..1
      let remaining = 3;
      setSilenceCountdown(remaining);
      countdownTimerRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
          setSilenceCountdown(0);
          stopAndFinalize();   // arrêt automatique
        } else {
          setSilenceCountdown(remaining);
        }
      }, 1000);
    }, 2000);
  }

  function startNewRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return null; }
    const r = new SR();
    r.lang = "fr-FR";
    // continuous=true permet de garder la session ouverte tant qu'il y a du son
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onstart = () => {
      isStoppingRef.current = false;
      resetSilenceTimer();
    };

    r.onresult = (e) => {
      // Cumule les segments FINAUX dans finalTranscriptRef et reconstruit
      // l'affichage = final + dernier interim courant.
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const seg = e.results[i];
        if (seg.isFinal) {
          finalTranscriptRef.current = (finalTranscriptRef.current + " " + seg[0].transcript).trim();
        } else {
          interim += seg[0].transcript;
        }
      }
      setFinalTranscript(finalTranscriptRef.current);
      const fullText = (finalTranscriptRef.current + " " + interim).trim();
      setTranscript(fullText);
      // On parse en live pour donner du feedback visuel
      if (fullText.length > 4) setParsed(parseVoiceCommandV2(fullText));
      // Tout son perçu = on relance le timer
      resetSilenceTimer();
    };

    r.onerror = (e) => {
      // 'no-speech' arrive très souvent quand l'utilisateur fait une pause.
      // On ne traite ça PAS comme une erreur — on laisse la session se
      // terminer puis on la relance dans onend si on n'a pas demandé l'arrêt.
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("Microphone non autorisé. Active-le dans les réglages de l'app.");
        cleanupAll();
        setListening(false);
      } else if (e.error === "no-speech") {
        // ignoré, géré par onend
      } else if (e.error === "audio-capture") {
        setError("Aucun micro détecté.");
        cleanupAll();
        setListening(false);
      } else if (e.error !== "aborted") {
        setError(`Erreur reconnaissance vocale : ${e.error}`);
      }
    };

    r.onend = () => {
      // Si l'utilisateur n'a pas explicitement demandé l'arrêt, on relance
      // une nouvelle session : Chrome tronque parfois à ~2s de silence.
      if (!isStoppingRef.current && listeningRef.current) {
        try {
          recognitionRef.current = startNewRecognition();
          recognitionRef.current?.start();
        } catch (_) { /* déjà running, ignore */ }
      }
    };

    return r;
  }

  function start() {
    setError("");
    finalTranscriptRef.current = "";
    setFinalTranscript("");
    setTranscript("");
    setParsed(null);

    const r = startNewRecognition();
    if (!r) return;
    recognitionRef.current = r;
    try {
      r.start();
      setListening(true);
    } catch (e) {
      setError("Impossible de démarrer la dictée. Réessayez.");
      setListening(false);
    }
  }

  function stopAndFinalize() {
    isStoppingRef.current = true;
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
    setSilenceCountdown(0);
    try { recognitionRef.current?.stop(); } catch(_) {}
    setListening(false);
    // Parse final (local, instantané — sert de base + de fallback)
    const finalText = finalTranscriptRef.current.trim();
    if (finalText) {
      setTranscript(finalText);
      const localParsed = parseVoiceCommandV2(finalText);
      setParsed(localParsed);
      // Lance le raffinement IA en arrière-plan (~1-2s)
      refineWithAi(finalText, localParsed);
    }
  }

  // Fusionne le résultat Claude (snake_case, partiel) avec le résultat local
  // (camelCase, complet). Claude couvre : nom/prénom, lieux, distance, prix.
  // Local couvre en plus : time, passengers, hasLuggage. On garde les
  // valeurs locales pour les champs que Claude ne traite pas.
  function mergeAiAndLocal(ai, local) {
    if (!ai) return local;
    const fullName = [ai.client_prenom, ai.client_nom]
      .filter((s) => s && String(s).trim())
      .join(" ")
      .trim();
    return {
      ...local,
      // Champs traités par Claude (priorité au cloud)
      customerName: fullName || local?.customerName || "",
      pickupAddress: ai.lieu_prise_en_charge || local?.pickupAddress || "",
      dropoffAddress: ai.lieu_depose || local?.dropoffAddress || "",
      distance: typeof ai.distance_km === "number" ? ai.distance_km : (local?.distance ?? null),
      price: typeof ai.prix_euros === "number" ? ai.prix_euros : (local?.price ?? null),
      // Champs intacts (Claude ne les extrait pas)
      time: local?.time || "",
      passengers: local?.passengers ?? 1,
      hasLuggage: local?.hasLuggage ?? false,
      intent: local?.intent || "creation_course_vtc",
      confidence: local?.confidence || {},
    };
  }

  async function refineWithAi(text, localParsed) {
    if (!text || text.trim().length < 4) return;
    const callId = ++aiCallIdRef.current;
    setAiLoading(true);
    setAiError("");
    try {
      const ai = await extractBookingFromVoice(text);
      // Une nouvelle dictée a peut-être démarré entre-temps — on ignore
      // la réponse obsolète pour éviter d'écraser un parse plus récent.
      if (callId !== aiCallIdRef.current) return;
      setAiResult(ai);
      setParsed(mergeAiAndLocal(ai, localParsed));
    } catch (err) {
      if (callId !== aiCallIdRef.current) return;
      console.warn("[VoiceCapture] Refine IA échoué (fallback local):", err?.message);
      setAiError(err?.message || "Service IA indisponible");
      // On garde `parsed` tel qu'il est (résultat local) — l'utilisateur
      // n'est jamais bloqué.
    } finally {
      if (callId === aiCallIdRef.current) setAiLoading(false);
    }
  }

  const useExample = () => {
    const example = "dupont marseille avignon tgv 100 bornes 180 balles 12h30 ils seront 3 avec valises";
    setTranscript(example);
    finalTranscriptRef.current = example;
    setFinalTranscript(example);
    const localParsed = parseVoiceCommandV2(example);
    setParsed(localParsed);
    refineWithAi(example, localParsed);
  };

  const onManualEdit = (e) => {
    const v = e.target.value;
    setTranscript(v);
    finalTranscriptRef.current = v;
    if (v.length > 4) setParsed(parseVoiceCommandV2(v));
    else setParsed(null);
    // L'édition manuelle n'appelle PAS Claude (anti-spam). L'utilisateur peut
    // réutiliser le bouton "Réanalyser avec IA" ci-dessous s'il veut un raffinement
    // après modification du texte.
    setAiResult(null);
  };

  // Bouton manuel "Réanalyser avec IA" affiché si l'utilisateur a édité le
  // texte ou si la confiance Claude est basse.
  const reAnalyzeAi = () => {
    const text = finalTranscriptRef.current.trim();
    if (!text) return;
    refineWithAi(text, parsed);
  };

  const confirm = () => {
    if (!parsed) return;
    const today = new Date();
    const [h,m] = (parsed.time || "09:00").split(":");
    today.setHours(parseInt(h||"9"), parseInt(m||"0"), 0, 0);
    if (today < new Date()) today.setDate(today.getDate() + 1);
    const iso = toLocalInput(today);
    onConfirm({
      customerName: parsed.customerName || "",
      pickupAddress: parsed.pickupAddress || "",
      dropoffAddress: parsed.dropoffAddress || "",
      dateTime: iso,
      passengers: parsed.passengers || 1,
      hasLuggage: parsed.hasLuggage || false,
      distance: parsed.distance ?? undefined,    // utilisé par estimatePrice si rempli
      price: parsed.price ?? undefined,
    });
  };

  if (!open) return null;

  return (
    <div className="tp-overlay" onClick={onClose}>
      <div className="tp-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="tp-grab"/>
        <div style={{ padding: "16px 20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div>
              <div className="tp-serif" style={{ fontSize: 22, fontWeight: 600 }}>Dictée intelligente</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>Parlez naturellement, tout est rempli</div>
            </div>
            <button onClick={onClose} className="tp-btn tp-btn-ghost" style={{ padding: 8, borderRadius: 10 }}><X size={18}/></button>
          </div>

          <div style={{ padding: "24px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <button
              onClick={listening ? stopAndFinalize : start}
              disabled={!supported}
              className={listening ? "tp-pulse" : ""}
              aria-label={listening ? "Arrêter la dictée" : "Démarrer la dictée"}
              style={{
                width: 100, height: 100, borderRadius: "50%",
                background: listening ? "var(--error)" : "var(--accent)", color: "var(--accent-on)", border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: supported ? "pointer" : "not-allowed",
                boxShadow: "0 12px 40px -8px rgba(37,99,235,0.4)", opacity: supported ? 1 : 0.5,
                position: "relative",
              }}
            >
              {listening ? <MicOff size={36}/> : <Mic size={36}/>}
              {/* Anneau de countdown silence (apparaît à 3s avant arrêt auto) */}
              {listening && silenceCountdown > 0 && (
                <div style={{
                  position: "absolute", top: -8, right: -8,
                  width: 30, height: 30, borderRadius: "50%",
                  background: "var(--accent)", color: "var(--accent-on)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 14,
                  border: "2px solid #0B0B0D",
                  animation: "tp-pulse 1s ease-in-out infinite",
                }}>{silenceCountdown}</div>
              )}
            </button>

            {listening && (
              <div style={{ display: "flex", gap: 3, height: 24, alignItems: "center" }}>
                {[0,0.1,0.2,0.3,0.4,0.3,0.2,0.1,0].map((d,i) => (
                  <div key={i} className="tp-wave-bar" style={{ height: 20, animationDelay: `${d}s` }}/>
                ))}
              </div>
            )}

            <div style={{ textAlign: "center", minHeight: 20 }}>
              {listening ? (
                <div style={{ fontSize: 13, color: "var(--accent-ink)", fontWeight: 600 }}>
                  {silenceCountdown > 0
                    ? `Silence détecté — arrêt dans ${silenceCountdown}s`
                    : "À l'écoute… parlez naturellement"}
                </div>
              ) : supported ? (
                <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
                  Appuyez pour parler. Arrêt auto après 5s de silence.
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--error)" }}>
                  Votre navigateur ne supporte pas la dictée vocale
                </div>
              )}
              {error && <div style={{ fontSize: 12, color: "var(--error)", marginTop: 4 }}>{error}</div>}
            </div>

            {/* Bouton secondaire : arrêt manuel explicite */}
            {listening && (
              <button
                onClick={stopAndFinalize}
                className="tp-btn tp-btn-outline"
                style={{ fontSize: 13, padding: "8px 16px" }}
              >
                <Check size={14}/> J'ai fini
              </button>
            )}
          </div>

          <div>
            {/* Bandeau "Transcription corrigée par IA" — affiché si Claude a renvoyé
                une version reformulée différente de l'original. Utile pour que le
                chauffeur voit ce que l'IA a interprété. */}
            {aiResult?.transcription_corrigee && aiResult.transcription_corrigee.trim() && (
              <div style={{ marginBottom: 10, padding: "8px 10px", background: "rgba(37,99,235,0.06)", borderRadius: 8, border: "1px solid rgba(37,99,235,0.15)" }}>
                <div style={{ fontSize: 10, color: "var(--accent-ink)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}>
                  <Sparkles size={10}/> Compris par l'IA
                </div>
                <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.4, fontStyle: "italic" }}>
                  {aiResult.transcription_corrigee}
                </div>
              </div>
            )}

            <div className="tp-label" style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              Transcription
              {aiLoading && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--accent-ink)", fontWeight: 600, marginLeft: 4 }}>
                  <Loader2 size={11} style={{ animation: "tp-spin 1s linear infinite" }}/>
                  Raffinement IA…
                </span>
              )}
            </div>
            <textarea className="tp-input" rows={3}
              placeholder="Ex : Je voudrais récupérer un Aurélien Matro à Avignon centre pour la gare TGV à 12h50 ils seront 3 avec valises..."
              value={transcript} onChange={onManualEdit} style={{ resize: "vertical", minHeight: 72 }}/>
            {!supported && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>Vous pouvez taper manuellement la phrase ci-dessus.</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button onClick={useExample} className="tp-btn tp-btn-outline" style={{ fontSize: 12, padding: "8px 12px" }}>
                <Sparkles size={12}/> Tester l'exemple
              </button>
              {transcript && (
                <button onClick={() => { setTranscript(""); setParsed(null); setAiResult(null); }} className="tp-btn tp-btn-ghost" style={{ fontSize: 12, padding: "8px 12px" }}>Effacer</button>
              )}
              {transcript && !aiLoading && (
                <button onClick={reAnalyzeAi} className="tp-btn tp-btn-ghost" style={{ fontSize: 12, padding: "8px 12px" }} title="Re-soumet le texte à l'IA pour un nouveau parsing">
                  <Sparkles size={12}/> Réanalyser avec IA
                </button>
              )}
            </div>
          </div>

          {parsed && (
            <div className="tp-fade-in" style={{ marginTop: 20 }}>
              <div className="tp-label" style={{ marginBottom: 10 }}>Champs détectés</div>
              <div className="tp-card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12, background: "var(--surface-2)" }}>
                {/* Mapping des noms de champs Claude → champs UI pour les warnings ⚠️.
                    aiResult.champs_incertains contient des chaînes comme "client_prenom",
                    "lieu_prise_en_charge", etc. (cf. system prompt). */}
                {(() => {
                  const incert = new Set(aiResult?.champs_incertains || []);
                  const isUncertain = (...keys) => keys.some(k => incert.has(k));
                  return (
                    <>
                      <FieldRow icon={UserIcon} label="Client" value={parsed.customerName || "—"} detected={!!parsed.customerName} uncertain={isUncertain("client_prenom", "client_nom")}/>
                      <FieldRow icon={MapPin} label="Prise en charge" value={parsed.pickupAddress || "—"} detected={!!parsed.pickupAddress} uncertain={isUncertain("lieu_prise_en_charge")}/>
                      <FieldRow icon={Navigation} label="Destination" value={parsed.dropoffAddress || "—"} detected={!!parsed.dropoffAddress} uncertain={isUncertain("lieu_depose")}/>
                      <FieldRow icon={Clock} label="Heure" value={parsed.time || "—"} detected={!!parsed.time}/>
                      <FieldRow icon={Users} label="Passagers" value={String(parsed.passengers)} detected/>
                      <FieldRow icon={Briefcase} label="Bagages" value={parsed.hasLuggage ? "Oui" : "Non"} detected/>
                      <FieldRow icon={Car} label="Distance" value={parsed.distance != null ? `${parsed.distance} km` : "—"} detected={parsed.distance != null} uncertain={isUncertain("distance_km")}/>
                      <FieldRow icon={Euro} label="Tarif" value={parsed.price != null ? `${parsed.price} €` : "—"} detected={parsed.price != null} uncertain={isUncertain("prix_euros")}/>
                    </>
                  );
                })()}
              </div>
              {/* Bouton "Réenregistrer" affiché si confiance basse selon l'IA — laisse
                  le chauffeur reprendre rapidement sans avoir à fermer la modale.
                  La fonction startListening + reset s'appellent via les helpers existants. */}
              {aiResult?.confiance === "basse" && (
                <div className="tp-card" style={{ marginTop: 12, padding: 10, background: "rgba(248,113,113,0.08)", borderColor: "rgba(248,113,113,0.25)" }}>
                  <div style={{ fontSize: 11, color: "var(--error, #f87171)", display: "flex", alignItems: "flex-start", gap: 6, lineHeight: 1.4, marginBottom: 8 }}>
                    <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }}/>
                    <span>L'IA n'est pas sûre du résultat. Vérifiez les champs ⚠️ ou réenregistrez.</span>
                  </div>
                  <button
                    onClick={() => {
                      // Reset complet et relancement immédiat de la dictée
                      setAiResult(null);
                      setAiError("");
                      // start() s'occupe déjà de réinitialiser transcript / finalTranscript /
                      // finalTranscriptRef / error en interne (cf. ligne 898+).
                      start();
                    }}
                    className="tp-btn tp-btn-outline"
                    style={{ width: "100%", padding: "10px 14px", fontSize: 13 }}
                  >
                    <Mic size={14}/> Réenregistrer la dictée
                  </button>
                </div>
              )}

              <button onClick={confirm} className="tp-btn tp-btn-primary" style={{ width: "100%", marginTop: 14, padding: "14px 16px", fontSize: 15 }}>
                <Check size={18}/> Créer le bon de course
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldRow({ icon: Icon, label, value, detected, uncertain }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: uncertain ? "rgba(251,191,36,0.15)" : (detected ? "var(--accent-soft)" : "var(--surface-3)"),
        color: uncertain ? "var(--warn, #fbbf24)" : (detected ? "var(--accent)" : "var(--muted)"),
        display: "flex", alignItems: "center", justifyContent: "center",
      }}><Icon size={15}/></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 6 }}>
          {label}
          {uncertain && <span title="Ce champ pourrait être incorrect — vérifiez avant de valider" style={{ color: "var(--warn, #fbbf24)" }}>⚠️</span>}
        </div>
        <div style={{ fontSize: 13, fontWeight: detected ? 600 : 400, color: detected ? "var(--text)" : "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      </div>
      {detected && !uncertain && <Check size={14} style={{ color: "var(--success)", flexShrink: 0 }}/>}
    </div>
  );
}

/* -------------------------------------------------------------------------
   RECHERCHE D'ADRESSES — champ intelligent façon Uber Driver
   ------------------------------------------------------------------------- */
// Position GPS courante (one-shot, mise en cache par le système). Sert à
// biaiser la recherche et calculer les distances. Repli silencieux si refusé.
function useCurrentPosition() {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (p) => { if (!cancelled) setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      () => { /* refusé / indispo → repli côté places.js */ },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 8000 }
    );
    return () => { cancelled = true; };
  }, []);
  return pos;
}

// Icône lucide par catégorie de lieu.
const PLACE_ICONS = {
  train: TrainFront, plane: Plane, hotel: Hotel, hospital: Cross, food: Utensils,
  shopping: ShoppingBag, fuel: Fuel, school: GraduationCap, landmark: Landmark,
  city: Building2, home: Home, business: Building2, default: MapPin,
};
const PlaceIcon = ({ cat, size = 18 }) => {
  const Ico = PLACE_ICONS[cat?.key] || MapPin;
  return <Ico size={size}/>;
};

// Champ de recherche d'adresse : suggestions temps réel en cartes (nom en gras,
// adresse en dessous, icône catégorie, distance + temps à droite, badge
// "À proximité"), + récentes / favorites / fréquentes quand le champ est vide.
function AddressSearchField({ value, onChange, placeholder, near, frequent = [] }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recents, setRecents] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const abortRef = useRef(null);
  const debRef = useRef(null);
  const blurRef = useRef(null);

  useEffect(() => { setQuery(value || ""); }, [value]);
  useEffect(() => { loadRecents().then(setRecents); loadFavorites().then(setFavorites); }, []);

  const runSearch = (q) => {
    if (abortRef.current) abortRef.current.abort();
    if ((q || "").trim().length < 2) { setResults([]); setLoading(false); return; }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    searchPlaces(q, near, ctrl.signal)
      .then((r) => { setResults(r); setLoading(false); })
      .catch((e) => { if (!e || e.name !== "AbortError") { setResults([]); setLoading(false); } });
  };

  const onType = (v) => {
    setQuery(v);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => runSearch(v), 320);
  };

  const commit = (place) => {
    const val = place.value || place.name;
    setQuery(val);
    onChange(val);
    setOpen(false);
    if (place.lat != null) addRecent(place).then(setRecents);
  };

  const onStar = (e, place) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(place).then(setFavorites);
  };

  const Card = ({ place, showStar = true }) => {
    const nearby = place.distanceKm != null && place.distanceKm <= 8;
    const fav = isFavorite(favorites, place);
    return (
      <div className="place-card" role="button" tabIndex={0}
        onMouseDown={(e) => e.preventDefault()}   /* évite le blur avant le clic */
        onClick={() => commit(place)}>
        <div className="place-ic"><PlaceIcon cat={place.category}/></div>
        <div className="place-mid">
          <div className="place-name">{place.name}</div>
          {(nearby || place.address) && (
            <div className="place-addr">
              {nearby && <span className="place-near">À proximité</span>}
              {place.address && <span className="addr-txt">{place.address}</span>}
            </div>
          )}
        </div>
        {place.distanceKm != null && (
          <div className="place-right">
            <div className="place-dist">{fmtDistance(place.distanceKm)}</div>
            {place.etaMin != null && <div className="place-eta">{place.etaMin} min</div>}
          </div>
        )}
        {showStar && place.lat != null && (
          <button className={`place-star ${fav ? "on" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={(e) => onStar(e, place)} aria-label="Favori">
            <Star size={16} fill={fav ? "currentColor" : "none"}/>
          </button>
        )}
      </div>
    );
  };

  // Enrichit un lieu d'historique (récente/favorite) avec la distance/temps
  // depuis la position courante, s'il a des coordonnées.
  const enrich = (p) => {
    if (p.lat != null && near) {
      const dk = placeDistanceKm(near, { lat: p.lat, lng: p.lng });
      return { ...p, distanceKm: dk, etaMin: placeEtaMinutes(dk) };
    }
    return { ...p, distanceKm: null, etaMin: null };
  };

  const showEmptyState = query.trim().length < 2;
  const hasHistory = favorites.length || recents.length || frequent.length;

  return (
    <div style={{ position: "relative" }}>
      <input
        className="tp-input"
        placeholder={placeholder}
        value={query}
        onChange={(e) => onType(e.target.value)}
        onFocus={() => { if (blurRef.current) clearTimeout(blurRef.current); setOpen(true); if (query.trim().length >= 2 && !results.length) runSearch(query); }}
        onBlur={() => {
          blurRef.current = setTimeout(() => {
            setOpen(false);
            // Accepte aussi une adresse tapée à la main sans sélection.
            if (query.trim() && query !== value) onChange(query.trim());
          }, 160);
        }}
      />
      {open && (
        <div className="place-panel tp-fade-in">
          {showEmptyState ? (
            hasHistory ? (
              <>
                {favorites.length > 0 && <>
                  <div className="place-sec"><Star size={11}/> Favoris</div>
                  {favorites.slice(0, 4).map((p) => <Card key={"f" + p.value} place={enrich(p)}/>)}
                </>}
                {recents.length > 0 && <>
                  <div className="place-sec"><History size={11}/> Récentes</div>
                  {recents.slice(0, 5).map((p) => <Card key={"r" + p.value} place={enrich(p)}/>)}
                </>}
                {frequent.length > 0 && <>
                  <div className="place-sec"><TrendingUp size={11}/> Fréquentes</div>
                  {frequent.slice(0, 4).map((p) => <Card key={"q" + p.value} place={p} showStar={false}/>)}
                </>}
              </>
            ) : (
              <div style={{ padding: "16px 12px", fontSize: 12.5, color: "var(--text-dim)", textAlign: "center" }}>
                Tapez une adresse, un lieu (« Gare », « Aéroport », « Hôpital »…) ou une ville.
              </div>
            )
          ) : loading && results.length === 0 ? (
            <div style={{ padding: "16px 12px", fontSize: 12.5, color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
              <Loader2 size={15} style={{ animation: "tp-spin 1s linear infinite", color: "var(--accent-ink)" }}/> Recherche…
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: "16px 12px", fontSize: 12.5, color: "var(--text-dim)", textAlign: "center" }}>Aucun résultat près de vous.</div>
          ) : (
            results.map((p) => <Card key={p.id} place={p}/>)
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
   BOOKING FORM
   ------------------------------------------------------------------------- */
function BookingForm({ initial, bookings = [], onCancel, onSave }) {
  const [form, setForm] = useState({
    customerName: "", phone: "", pickupAddress: "", dropoffAddress: "",
    dateTime: toLocalInput(new Date()),
    passengers: 1, hasLuggage: false, distance: 10, duration: 20,
    price: 0, notes: "", type: "forfait",
    ...(initial || {}),
  });
  const [saving, setSaving] = useState(false);
  // Id stable pour un nouveau bon : garantit qu'un double envoi ne peut pas
  // produire deux bons distincts (cf. commentaire sur le bouton d'envoi).
  const newIdRef = useRef(genId());
  const [pickupSuggestOpen, setPickupSuggestOpen] = useState(false);
  const [dropoffSuggestOpen, setDropoffSuggestOpen] = useState(false);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);

  // ─── Liste de clients récurrents auto-construite depuis les bookings
  // précédents (groupé par customerName, trié par fréquence puis date la
  // plus récente). Évite à l'utilisateur de re-saisir les coordonnées
  // d'un client habituel à chaque nouvelle course.
  const recurrentClients = useMemo(() => {
    const map = new Map();
    for (const b of bookings) {
      if (!b.customerName) continue;
      const key = b.customerName.trim().toLowerCase();
      if (!key) continue;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        if (new Date(b.createdAt || b.dateTime) > new Date(existing.lastSeen)) {
          existing.lastSeen = b.createdAt || b.dateTime;
          // Mettre à jour avec les infos les plus récentes
          if (b.phone) existing.phone = b.phone;
          if (b.pickupAddress) existing.lastPickup = b.pickupAddress;
          if (b.dropoffAddress) existing.lastDropoff = b.dropoffAddress;
        }
      } else {
        map.set(key, {
          name: b.customerName,
          phone: b.phone || '',
          lastPickup: b.pickupAddress || '',
          lastDropoff: b.dropoffAddress || '',
          count: 1,
          lastSeen: b.createdAt || b.dateTime || new Date().toISOString(),
        });
      }
    }
    return Array.from(map.values())
      .sort((a, b) => (b.count - a.count) || (new Date(b.lastSeen) - new Date(a.lastSeen)))
      .slice(0, 8); // top 8 clients les plus fréquents/récents
  }, [bookings]);

  const estimatedPrice = useMemo(() => estimatePrice(form.distance, form.duration), [form.distance, form.duration]);

  useEffect(() => { if (!form.price) setForm(f => ({ ...f, price: Math.round(estimatedPrice) })); }, []); // eslint-disable-line

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Position GPS courante → biaise la recherche d'adresses + distances.
  const userPos = useCurrentPosition();

  // Adresses les plus fréquentes du chauffeur (depuis ses courses passées) —
  // proposées quand un champ d'adresse est vide.
  const frequentAddresses = useMemo(() => {
    const m = new Map();
    for (const b of bookings) {
      for (const addr of [b.pickupAddress, b.dropoffAddress]) {
        const k = (addr || "").trim();
        if (k) m.set(k, (m.get(k) || 0) + 1);
      }
    }
    return [...m.entries()]
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, count]) => ({ name, address: `${count} course${count > 1 ? "s" : ""}`, value: name, category: { key: "history" } }));
  }, [bookings]);

  const filterAddrs = (q) => {
    const s = (q || "").toLowerCase().trim();
    if (!s) return KNOWN_ADDRESSES.slice(0, 6);
    return KNOWN_ADDRESSES.filter(a =>
      a.label.toLowerCase().includes(s) || a.detail.toLowerCase().includes(s) ||
      a.aliases.some(al => al.includes(s))
    ).slice(0, 6);
  };

  return (
    <div className="tp-scroll tp-fade-in">
      <TopBar title={initial?.id ? "Modifier le bon" : "Nouveau bon de course"} subtitle="Conforme décret 2017-483" onBack={onCancel}/>

      <div style={{ padding: "8px 20px 0", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div className="tp-label" style={{ marginBottom: 8 }}>Type de prestation</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[{ v: "forfait", l: "Forfait" }, { v: "miseadispo", l: "Mise à disposition" }].map(opt => (
              <button key={opt.v} onClick={() => update("type", opt.v)} className="tp-card" style={{
                padding: 12, cursor: "pointer",
                background: form.type === opt.v ? "var(--accent-soft)" : "var(--surface)",
                borderColor: form.type === opt.v ? "var(--accent-ring)" : "var(--border)",
                color: form.type === opt.v ? "var(--accent-ink)" : "var(--text)",
                fontWeight: 600, fontSize: 13,
              }}>{opt.l}</button>
            ))}
          </div>
        </div>

        <div>
          <div className="tp-label" style={{ marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Client</span>
            {recurrentClients.length > 0 && (
              <button type="button"
                onClick={() => setClientPickerOpen(v => !v)}
                style={{
                  fontSize: 10, color: "var(--accent-ink)", background: "none", border: "none",
                  cursor: "pointer", fontWeight: 600, padding: 0, display: "flex",
                  alignItems: "center", gap: 4,
                }}>
                <UserPlus size={11}/> {clientPickerOpen ? "Fermer" : `Mes clients (${recurrentClients.length})`}
              </button>
            )}
          </div>

          {/* Picker de clients récurrents — pré-remplit nom + tel + adresses
              à partir des bookings précédents. Un clic = gain de 30 secondes
              de saisie pour un client habituel. */}
          {clientPickerOpen && recurrentClients.length > 0 && (
            <div className="tp-card tp-fade-in" style={{
              marginBottom: 10, padding: 8, background: "var(--surface)",
              maxHeight: 220, overflowY: "auto",
            }}>
              {recurrentClients.map((c) => (
                <button key={c.name} type="button"
                  onClick={() => {
                    setForm(f => ({
                      ...f,
                      customerName: c.name,
                      phone: c.phone || f.phone,
                      pickupAddress: c.lastPickup || f.pickupAddress,
                      dropoffAddress: c.lastDropoff || f.dropoffAddress,
                    }));
                    setClientPickerOpen(false);
                  }}
                  style={{
                    width: "100%", padding: "10px 12px", display: "flex",
                    alignItems: "center", gap: 10, textAlign: "left",
                    background: "transparent", border: "none", cursor: "pointer",
                    borderBottom: "1px solid var(--border)",
                  }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: "var(--accent-soft)",
                    color: "var(--accent-ink)", display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 13, flexShrink: 0,
                  }}>
                    {c.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 1 }}>
                      {c.count} course{c.count > 1 ? 's' : ''} · {c.phone || 'sans tél.'}
                    </div>
                  </div>
                  <ChevronRight size={14} style={{ color: "var(--text-dim)", flexShrink: 0 }}/>
                </button>
              ))}
              <div style={{ fontSize: 9, color: "var(--text-dim)", padding: "6px 12px 0", lineHeight: 1.4 }}>
                Clients construits automatiquement à partir de vos courses précédentes. Un clic remplit nom, téléphone et adresses habituelles.
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input className="tp-input" placeholder="Nom et prénom (ex. Jean Dupont)" value={form.customerName} onChange={e => update("customerName", e.target.value)}/>
            <input className="tp-input" placeholder="Téléphone (facultatif)" value={form.phone} onChange={e => update("phone", e.target.value)}/>
            <input className="tp-input" type="email" placeholder="Email client (facultatif)" value={form.customerEmail || ""} onChange={e => update("customerEmail", e.target.value)}/>
            <input className="tp-input" placeholder="Adresse de facturation (facultatif)" value={form.customerAddress || ""} onChange={e => update("customerAddress", e.target.value)}/>
            <input className="tp-input" placeholder="Société / entreprise (si facturation pro)" value={form.customerCompany || ""} onChange={e => update("customerCompany", e.target.value)}/>
            <div style={{ fontSize: 10, color: "var(--text-dim)", padding: "0 2px", lineHeight: 1.4 }}>
              💡 Si vous facturez une entreprise, renseignez le nom de société. Il apparaîtra en titre dans la section "Facturé à" du PDF, avec votre client comme contact.
            </div>
          </div>
        </div>

        {/* ─── TRAJET — flow départ → arrivée façon transfert d'argent ─── */}
        <div>
          <div className="tp-label" style={{ marginBottom: 8 }}>Trajet</div>
          <div className="tp-card-elevated" style={{ padding: 14 }}>
            <div style={{ display: "flex", gap: 12 }}>
              {/* Rail A → B */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 30 }}>
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--text)", flexShrink: 0 }}/>
                <span style={{ width: 2, flex: 1, minHeight: 30, margin: "5px 0", background: "repeating-linear-gradient(var(--muted) 0 3px, transparent 3px 6px)" }}/>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--accent)", flexShrink: 0 }}/>
              </div>
              {/* Champs départ / arrivée — recherche intelligente (cartes, catégories, distance/temps) */}
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Départ</div>
                  <AddressSearchField
                    value={form.pickupAddress}
                    onChange={(v) => update("pickupAddress", v)}
                    placeholder="Adresse de départ"
                    near={userPos}
                    frequent={frequentAddresses}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Arrivée</div>
                  <AddressSearchField
                    value={form.dropoffAddress}
                    onChange={(v) => update("dropoffAddress", v)}
                    placeholder="Adresse d'arrivée"
                    near={userPos}
                    frequent={frequentAddresses}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="tp-label" style={{ marginBottom: 6 }}>Date et heure de prise en charge</div>
          <input className="tp-input" type="datetime-local" value={form.dateTime} onChange={e => update("dateTime", e.target.value)}/>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div className="tp-label" style={{ marginBottom: 6 }}>Passagers</div>
            <input className="tp-input" type="number" min={1} max={9} value={form.passengers} onChange={e => update("passengers", parseInt(e.target.value)||1)}/>
          </div>
          <div>
            <div className="tp-label" style={{ marginBottom: 6 }}>Bagages</div>
            <button className="tp-input" style={{ textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
              onClick={() => update("hasLuggage", !form.hasLuggage)}>
              <span>{form.hasLuggage ? "Oui" : "Non"}</span>
              <div style={{
                width: 36, height: 20, borderRadius: 999,
                background: form.hasLuggage ? "var(--accent)" : "var(--surface-3)",
                position: "relative", transition: "background 0.15s",
              }}>
                <div style={{
                  position: "absolute", top: 2, left: form.hasLuggage ? 18 : 2,
                  width: 16, height: 16, borderRadius: "50%", background: "#fff",
                  transition: "left 0.15s",
                }}/>
              </div>
            </button>
          </div>
        </div>

        {/* ─── MONTANT — grand chiffre façon transfert d'argent ─── */}
        <div className="tp-card-elevated" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div className="tp-label">Montant de la course · TTC</div>
            <button onClick={() => update("price", Math.round(estimatedPrice))}
              className="tp-chip" style={{ cursor: "pointer", background: "var(--accent-soft)", color: "var(--accent-ink)", borderColor: "var(--accent-ring)", fontWeight: 700 }}>
              <Zap size={11}/> Estimer
            </button>
          </div>
          {/* Grand montant éditable */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <input
              className="tp-serif"
              type="number" inputMode="decimal" step="0.01" min="0" placeholder="0"
              aria-label="Montant de la course en euros"
              style={{ flex: 1, minWidth: 0, width: "100%", background: "transparent", border: "none", outline: "none", color: "var(--text)", fontSize: 44, fontWeight: 600, letterSpacing: "-0.02em", padding: "2px 0" }}
              /* value vide tant que 0 → évite l'affichage "05" quand on tape */
              value={form.price === 0 ? "" : form.price}
              onChange={e => { const v = e.target.value; update("price", v === "" ? 0 : parseFloat(v) || 0); }}
            />
            <span className="tp-serif" style={{ fontSize: 30, fontWeight: 600, color: "var(--text-dim)", flexShrink: 0 }}>€</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>Estimation : {eur(estimatedPrice)} (2,50 €/km + horaire)</div>

          <div className="tp-divider" style={{ margin: "14px 0 12px" }}/>

          {/* Détails du calcul */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>Distance (km)</div>
              <input
                className="tp-input" type="number" inputMode="decimal" step="0.1" min="0" placeholder="0"
                value={form.distance === 0 ? "" : form.distance}
                onChange={e => {
                  const v = e.target.value;
                  update("distance", v === "" ? 0 : parseFloat(v) || 0);
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>Durée (min)</div>
              <input
                className="tp-input" type="number" inputMode="numeric" min="0" placeholder="0"
                value={form.duration === 0 ? "" : form.duration}
                onChange={e => {
                  const v = e.target.value;
                  update("duration", v === "" ? 0 : parseInt(v) || 0);
                }}
              />
            </div>
          </div>
        </div>

        <div>
          <div className="tp-label" style={{ marginBottom: 6 }}>Observations</div>
          <textarea className="tp-input" rows={2} placeholder="Informations complémentaires (siège bébé, animal, etc.)" value={form.notes} onChange={e => update("notes", e.target.value)} style={{ resize: "vertical" }}/>
        </div>

        <div className="tp-card" style={{ padding: 12, display: "flex", gap: 10, background: "var(--surface)" }}>
          <Shield size={16} style={{ color: "var(--success)", flexShrink: 0, marginTop: 2 }}/>
          <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>
            Mentions obligatoires ajoutées automatiquement : SIRET <b>{DRIVER_PROFILE.siret}</b>, n° VTC <b>{DRIVER_PROFILE.vtcNumber}</b>, carte pro <b>{DRIVER_PROFILE.proCardNumber}</b>, immatriculation <b>{DRIVER_PROFILE.vehiclePlate}</b>.
          </div>
        </div>

        {!initial?.id && (
          <div className="tp-card" style={{ padding: 12, display: "flex", gap: 10, background: "var(--accent-soft)", borderColor: "var(--accent-ring)" }}>
            <Coins size={16} style={{ color: "var(--accent-ink)", flexShrink: 0, marginTop: 2 }}/>
            <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>
              La création de ce bon consomme <b>1 crédit</b>.
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, paddingBottom: 20 }}>
          <button onClick={onCancel} disabled={saving} className="tp-btn tp-btn-ghost" style={{ flex: 1 }}>Annuler</button>
          {/* ⚠️ Deux protections contre le double-tap sur réseau lent (3G, tunnel),
              qui créait 2 bons et consommait 2 crédits :
              1. `saving` désactive le bouton et montre que ça travaille ;
              2. l'id est tiré d'une ref STABLE (newIdRef) et non d'un genId()
                 rappelé à chaque clic — même si deux appels passaient malgré
                 tout, ils porteraient le même id et non deux bons distincts. */}
          <button
            onClick={async () => {
              if (saving) return;
              setSaving(true);
              try {
                await onSave({ ...form, id: form.id || newIdRef.current, status: "confirmed", createdAt: form.createdAt || new Date().toISOString() });
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            className="tp-btn tp-btn-primary"
            style={{ flex: 2, opacity: saving ? 0.7 : 1 }}>
            {saving
              ? <><Loader2 size={16} style={{ animation: "tp-spin 1s linear infinite" }}/> Enregistrement…</>
              : <><Check size={16}/> Enregistrer le bon</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   BOOKING DETAIL
   ------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------
   BOOKING DETAIL SHEET — fiche "Bon de course" réductible par glissement
   -------------------------------------------------------------------------
   Habille l'écran BookingDetail (inchangé, réutilisé tel quel) dans une
   feuille coulissante façon Apple Maps / Uber Driver : un bandeau compact
   toujours visible (heure, client, trajet, statut) sert à la fois de
   poignée de glissement ET de résumé quand la fiche est réduite. Glisser
   vers le haut/bas — ou simplement toucher le bandeau — bascule entre les
   deux états. Le drag est piloté en impératif (refs, pas de re-render React
   à chaque frame) pour garantir 60 fps quel que soit le coût du reste de
   l'arbre — seul l'état final (replié/déplié) déclenche un re-render, pour
   l'animation de repos (transition CSS). */
function BookingDetailSheet({ booking, invoiced, onBack, ...rest }) {
  const [expanded, setExpanded] = useState(true);   // ouvre toujours en plein écran (comportement d'origine)
  const wrapRef = useRef(null);       // conteneur mesuré (= hauteur de .tp-phone)
  const sheetRef = useRef(null);      // feuille translatée (transform piloté en direct)
  const backdropRef = useRef(null);   // voile derrière la feuille (opacité liée à la progression)
  const [dims, setDims] = useState({ phoneH: 0, handleH: 92 });
  const drag = useRef({ active: false, startY: 0, startPos: 0, lastY: 0, lastT: 0, velocity: 0, moved: 0 });

  // Mesure la hauteur du conteneur "téléphone" + celle du bandeau, pour
  // calculer les 2 positions de repos (0 = déplié, phoneH - handleH = replié).
  useEffect(() => {
    const phoneEl = wrapRef.current?.closest('.tp-phone');
    const handleEl = wrapRef.current?.querySelector('[data-sheet-handle]');
    if (!phoneEl) return;
    const measure = () => setDims({
      phoneH: phoneEl.clientHeight,
      handleH: handleEl?.offsetHeight || 92,
    });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(phoneEl);
    if (handleEl) ro.observe(handleEl);
    return () => ro.disconnect();
  }, []);

  const EXPANDED_Y = 0;
  const PEEK_Y = Math.max(0, dims.phoneH - dims.handleH);
  const DISMISS_SLACK = 90; // marge élastique au-delà du replié avant de fermer complètement

  const applyTransform = (y) => {
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${y}px)`;
    if (backdropRef.current) {
      const progress = PEEK_Y > 0 ? 1 - Math.min(1, Math.max(0, y / PEEK_Y)) : (y <= 0 ? 1 : 0);
      backdropRef.current.style.opacity = String(progress * 0.32);
      backdropRef.current.style.pointerEvents = progress > 0.05 ? 'auto' : 'none';
    }
  };

  // Repositionne sur l'état de repos courant à chaque changement (resize,
  // toggle programmatique) — avec transition CSS puisqu'on n'est plus en drag.
  useEffect(() => {
    if (drag.current.active) return;
    if (sheetRef.current) sheetRef.current.style.transition = 'transform 320ms cubic-bezier(0.32,0.72,0,1)';
    if (backdropRef.current) backdropRef.current.style.transition = 'opacity 320ms cubic-bezier(0.32,0.72,0,1)';
    applyTransform(expanded ? EXPANDED_Y : PEEK_Y);
  }, [expanded, dims.phoneH, dims.handleH]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerDown = (e) => {
    // setPointerCapture peut lever (WebView/pointerId non "actif" selon le
    // navigateur) — jamais bloquant pour le geste, juste une amélioration
    // (garde le pointeur capté même si le doigt sort de la zone du bandeau).
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* best effort */ }
    drag.current = { active: true, startY: e.clientY, startPos: expanded ? EXPANDED_Y : PEEK_Y, lastY: e.clientY, lastT: Date.now(), velocity: 0, moved: 0 };
    if (sheetRef.current) sheetRef.current.style.transition = 'none';
    if (backdropRef.current) backdropRef.current.style.transition = 'none';
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d.active) return;
    const delta = e.clientY - d.startY;
    d.moved = Math.max(d.moved, Math.abs(delta));
    const now = Date.now();
    const dt = now - d.lastT;
    if (dt > 0) d.velocity = (e.clientY - d.lastY) / dt; // px/ms, signe = sens
    d.lastY = e.clientY; d.lastT = now;
    const rawY = Math.min(PEEK_Y + DISMISS_SLACK, Math.max(EXPANDED_Y, d.startPos + delta));
    applyTransform(rawY);
  };

  const onPointerUp = () => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    const currentY = sheetRef.current ? parseFloat(sheetRef.current.style.transform.replace(/[^0-9.-]/g, '')) || 0 : 0;

    // Un simple tap (quasi aucun déplacement) bascule l'état — accessible
    // même sans comprendre le geste de glissement (iPhone comme Android).
    if (d.moved < 6) { setExpanded(v => !v); return; }

    // Glissé bien au-delà du replié → fermeture complète (comme le chevron retour).
    if (currentY > PEEK_Y + 40) { onBack(); return; }

    // Sinon on retient la position + la vélocité pour choisir l'état le plus naturel.
    const mid = PEEK_Y / 2;
    const goingDown = d.velocity > 0.35;
    const goingUp = d.velocity < -0.35;
    if (goingDown) setExpanded(false);
    else if (goingUp) setExpanded(true);
    else setExpanded(currentY < mid);
  };

  const d = new Date(booking.dateTime);
  const isPending = booking.status === "pending";

  return (
    <div ref={wrapRef} style={{ position: "absolute", inset: 0, zIndex: 900 }}>
      <div ref={backdropRef} onClick={() => setExpanded(false)} style={{ position: "absolute", inset: 0, background: "#000", opacity: 0, pointerEvents: "none" }}/>
      <div ref={sheetRef} style={{ position: "absolute", inset: 0, background: "var(--bg)", borderRadius: "22px 22px 0 0", boxShadow: "0 -12px 40px rgba(0,0,0,0.18)", overflow: "hidden", display: "flex", flexDirection: "column", willChange: "transform" }}>
        {/* Bandeau compact — poignée de drag ET résumé replié (heure/client/trajet/statut) */}
        <div
          data-sheet-handle
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ touchAction: "none", cursor: "grab", flexShrink: 0, background: "var(--surface)", borderBottom: expanded ? "1px solid var(--border)" : "none", padding: "8px 18px calc(10px + env(safe-area-inset-bottom))" }}
        >
          <div style={{ width: 38, height: 4, borderRadius: 3, background: "var(--border)", margin: "0 auto 10px" }}/>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="tp-serif" style={{ fontSize: 17, fontWeight: 600, flexShrink: 0 }}>
              {d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
              {booking.customerName}
            </span>
            {invoiced
              ? <Lock size={13} style={{ color: "var(--warn)", flexShrink: 0 }}/>
              : <span className={`tp-chip ${isPending ? "tp-chip-warn" : "tp-chip-success"}`} style={{ flexShrink: 0 }}>{isPending ? "En attente" : "Confirmée"}</span>}
            {expanded ? <ChevronDown size={16} style={{ color: "var(--muted)", flexShrink: 0 }}/> : <ChevronUp size={16} style={{ color: "var(--muted)", flexShrink: 0 }}/>}
          </div>
          {/* ⚠️ minWidth: 0 obligatoire sur les adresses : avec whiteSpace nowrap,
              un flex item refuse sinon de rétrécir sous la largeur de son texte
              → une adresse longue poussait toute la ligne hors de l'écran. */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 12, color: "var(--text-dim)", overflow: "hidden" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text)", flexShrink: 0 }}/>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flexShrink: 1 }}>{booking.pickupAddress}</span>
            <ChevronRight size={11} style={{ color: "var(--muted)", flexShrink: 0 }}/>
            <span style={{ width: 6, height: 6, borderRadius: 2, background: "var(--accent)", flexShrink: 0 }}/>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flexShrink: 1 }}>{booking.dropoffAddress}</span>
          </div>
        </div>

        {/* Contenu complet — BookingDetail inchangé, scrolle sous le bandeau */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <BookingDetail booking={booking} invoiced={invoiced} onBack={onBack} {...rest}/>
        </div>
      </div>
    </div>
  );
}

function BookingDetail({ booking, onBack, onEdit, onDelete, onInvoice, onDuplicate, defaultGps, activeTripId, invoiced, currentUser }) {
  const { nav, start: startNav, pick: pickNav, close: closeNav } = useNavigate(defaultGps);
  if (!booking) return null;

  // Bandeau "Bon de transport réglementaire" : priorité aux vraies infos du
  // compte connecté (éditées via Profil → Modifier mes informations), pas
  // aux valeurs d'exemple de DRIVER_PROFILE (utilisées seulement en mode invité
  // ou tant qu'un champ n'a pas encore été renseigné).
  const driverInfo = {
    companyName: currentUser?.companyName || DRIVER_PROFILE.companyName,
    siret: currentUser?.siret || DRIVER_PROFILE.siret,
    vtcNumber: currentUser?.evtcNumber || DRIVER_PROFILE.vtcNumber,
    proCardNumber: currentUser?.proCardNumber || DRIVER_PROFILE.proCardNumber,
    vehicleModel: currentUser?.vehicleModel || DRIVER_PROFILE.vehicleModel,
    vehiclePlate: currentUser?.vehiclePlate || DRIVER_PROFILE.vehiclePlate,
  };

  // Destination GPS : dépose si la course est en cours, sinon prise en charge.
  const enRoute = !!activeTripId && activeTripId === booking.id;
  const navDest = enRoute ? (booking.dropoffAddress || booking.pickupAddress) : (booking.pickupAddress || booking.dropoffAddress);

  // ─── Handlers branchés sur les helpers Capacitor / Web Share / mailto ──
  const summary = booking
    ? `Bon de course TrajetPro\n\nClient : ${booking.customerName}\n${formatDateTime(booking.dateTime)}\nDe : ${booking.pickupAddress}\nÀ : ${booking.dropoffAddress}\nDistance : ${booking.distance} km · ${booking.duration} min\nPrix TTC : ${eur(booking.price)}\n\nChauffeur : ${DRIVER_PROFILE.firstName || ''} ${DRIVER_PROFILE.lastName || ''}\nSIRET ${DRIVER_PROFILE.siret} · VTC ${DRIVER_PROFILE.vtcNumber}\n${DRIVER_PROFILE.email || ''}`
    : '';

  const onShareBooking = async () => {
    await shareGeneric({
      title: `Course pour ${booking.customerName}`,
      text: summary,
      dialogTitle: 'Partager le bon de course',
    });
  };

  const onEmailClient = () => {
    openMailto({
      subject: `Confirmation de votre course du ${formatDate(booking.dateTime)}`,
      body: `Bonjour ${booking.customerName},\n\nJe vous confirme votre course :\n\n${summary}\n\nÀ très bientôt,\n${DRIVER_PROFILE.firstName || ''} ${DRIVER_PROFILE.lastName || ''}`,
    });
  };

  const onAgenda = () => {
    if (!booking.dateTime) {
      alert("Cette course n'a pas de date — impossible de l'ajouter au calendrier.");
      return;
    }
    const start = new Date(booking.dateTime);
    const end = new Date(start.getTime() + (booking.duration || 60) * 60 * 1000);
    downloadIcs({
      title: `VTC : ${booking.customerName} (${booking.pickupAddress} → ${booking.dropoffAddress})`,
      start,
      end,
      location: booking.pickupAddress,
      description: summary,
      uid: `trajetpro-${booking.id}@trajetpro.fr`,
    });
  };

  return (
    <div className="tp-scroll tp-no-scroll tp-fade-in">
      <TopBar title="Bon de course" subtitle={`Réf. ${booking.id.toUpperCase()}`} onBack={onBack}
        rightAction={invoiced
          ? <button onClick={() => alert("Ce bon a déjà été facturé : ses informations ne peuvent plus être modifiées (conformité fiscale).\n\nPour une nouvelle course, utilisez « Dupliquer ».")} className="tp-btn tp-btn-ghost" style={{ padding: 8, borderRadius: 10, opacity: 0.65 }} title="Bon facturé — verrouillé"><Lock size={16}/></button>
          : <button onClick={() => onEdit(booking)} className="tp-btn tp-btn-ghost" style={{ padding: 8, borderRadius: 10 }}><Edit3 size={16}/></button>}/>

      <div style={{ padding: "8px 20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {invoiced && (
          <div className="tp-card" style={{ padding: 12, display: "flex", gap: 10, alignItems: "flex-start", background: "var(--warn-soft)", borderColor: "var(--warn)" }}>
            <Lock size={15} style={{ color: "var(--warn)", flexShrink: 0, marginTop: 1 }}/>
            <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>
              <b>Bon facturé — verrouillé.</b> Ses informations ne peuvent plus être modifiées (conformité fiscale). Pour une nouvelle course, utilisez <b>Dupliquer</b> ci-dessous.
            </div>
          </div>
        )}
        <div className="tp-card-elevated" style={{ padding: 20, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 4, background: "var(--accent)" }}/>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Shield size={14} style={{ color: "var(--accent-ink)" }}/>
            <div style={{ fontSize: 10, color: "var(--accent-ink)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Bon de transport réglementaire</div>
          </div>

          <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>Réservation préalable</div>
          <div className="tp-serif" style={{ fontSize: 18, fontWeight: 600, marginBottom: 14 }}>{formatDateTime(booking.createdAt)}</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <Info2 label="Client" value={booking.customerName}/>
            <Info2 label="Passagers" value={`${booking.passengers} pers.`}/>
          </div>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginBottom: 14 }}>
            <Info2 label="Prise en charge" value={booking.pickupAddress}/>
            <div style={{ height: 10 }}/>
            <Info2 label="Heure prévue" value={formatDateTime(booking.dateTime)} accent/>
            <div style={{ height: 10 }}/>
            <Info2 label="Destination" value={booking.dropoffAddress}/>
          </div>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Prix TTC</div>
              <div className="tp-serif" style={{ fontSize: 30, fontWeight: 600, color: "var(--accent-ink)", lineHeight: 1 }}>{eur(booking.price)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Forfait</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>TVA {DRIVER_PROFILE.vatRate}% incluse</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{booking.distance} km · {booking.duration} min</div>
            </div>
          </div>

          <div style={{ marginTop: 16, padding: 12, background: "var(--surface-2)", borderRadius: 10, fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6 }}>
            <div style={{ color: "var(--text)", fontWeight: 700, marginBottom: 4 }}>{driverInfo.companyName}</div>
            <div>SIRET : {driverInfo.siret}</div>
            <div>Inscription VTC : {driverInfo.vtcNumber}</div>
            <div>Carte pro. conducteur : {driverInfo.proCardNumber}</div>
            <div>Véhicule : {driverInfo.vehicleModel} · {driverInfo.vehiclePlate}</div>
          </div>
        </div>

        {booking.notes && (
          <div className="tp-card" style={{ padding: 14, background: "var(--surface)" }}>
            <div className="tp-label" style={{ marginBottom: 4 }}>Observations</div>
            <div style={{ fontSize: 13 }}>{booking.notes}</div>
          </div>
        )}

        {/* Contacter le client : Appeler · SMS */}
        {booking.phone && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => callClient(booking.phone)} className="tp-btn tp-btn-ghost" style={{ flex: 1 }}><Phone size={15}/> Appeler</button>
            <button onClick={() => smsClient(booking.phone, `Bonjour ${booking.customerName || ""}, je suis votre chauffeur VTC pour la course de ${new Date(booking.dateTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}.`)} className="tp-btn tp-btn-ghost" style={{ flex: 1 }}><MessageSquare size={15}/> SMS</button>
          </div>
        )}
        {/* Lancer la navigation GPS */}
        <button onClick={() => startNav(navDest)} className="tp-btn tp-btn-primary" style={{ width: "100%" }}><Navigation size={15}/> Naviguer</button>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button className="tp-btn tp-btn-ghost" onClick={() => onInvoice(booking)}><Receipt size={15}/> Facturer</button>
          <button onClick={() => onDuplicate && onDuplicate(booking)} className="tp-btn tp-btn-ghost"><Copy size={15}/> Dupliquer</button>
          <button onClick={onShareBooking} className="tp-btn tp-btn-ghost"><Share2 size={15}/> Partager</button>
          <button onClick={onEmailClient} className="tp-btn tp-btn-ghost"><Send size={15}/> Email client</button>
          <button onClick={onAgenda} className="tp-btn tp-btn-ghost" style={{ gridColumn: "1 / span 2" }}><Calendar size={15}/> Ajouter à l'agenda (.ics)</button>
        </div>

        <button onClick={() => onDelete(booking)} className="tp-btn" style={{ color: "var(--error)", background: "var(--error-soft)", border: "1px solid rgba(248,113,113,0.25)" }}>
          <Trash2 size={15}/> Supprimer le bon
        </button>
      </div>
      <NavSheet open={nav.open} address={nav.address} onClose={closeNav} onPick={pickNav}/>
    </div>
  );
}

function Info2({ label, value, accent }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: accent ? "var(--accent-ink)" : "var(--text)" }}>{value}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   BOOKINGS LIST SCREEN
   ------------------------------------------------------------------------- */
function BookingsScreen({ bookings, tokenBalance, onOpenBooking, onNewBooking, onQuickVoice, onGoTab }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = bookings.filter(b => {
    const matchSearch = !search ||
      b.customerName.toLowerCase().includes(search.toLowerCase()) ||
      b.pickupAddress.toLowerCase().includes(search.toLowerCase()) ||
      b.dropoffAddress.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || b.status === filter;
    return matchSearch && matchFilter;
  }).sort((a,b) => new Date(a.dateTime) - new Date(b.dateTime));

return (
    /* Layout type "app native" (Uber/Deliveroo) :
       - wrapper flex column qui occupe toute la hauteur disponible dans tp-phone
       - header (TopBar + recherche + filtres) en flex-shrink:0 → ne bouge jamais
       - liste en flex:1 + overflow-y:auto → SEULE zone scrollable verticalement
       - La BottomNav reste fixe en dehors (gérée par le parent App).
       On n'utilise PAS tp-scroll ici car on veut un layout sticky personnalisé. */
    <div className="tp-fade-in" style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",                       // bloque le scroll global du screen
      paddingTop: "calc(env(safe-area-inset-top) + 14px)",   // sous la status bar iPhone
      minHeight: 0,                             // permet à flex:1 de scroller à l'intérieur
    }}>
      {/* ─── HEADER FIXE ─────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, background: "var(--bg-gradient)", paddingBottom: 14 }}>
        <TopBar title="Mes courses" subtitle={`${bookings.length} bon${bookings.length>1?"s":""} au total`}
          rightAction={
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <TokenBadge balance={tokenBalance} onClick={() => onGoTab("tokens")} compact/>
              <button onClick={onNewBooking} className="tp-btn tp-btn-ghost" style={{ padding: 8, borderRadius: 10 }}><Plus size={18}/></button>
            </div>
          }/>

        <div style={{ padding: "0 20px" }}>
          <div style={{ position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 14, top: 13, color: "var(--muted)" }}/>
            <input className="tp-input" style={{ paddingLeft: 38 }} placeholder="Rechercher un client, une adresse..." value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
        </div>

        <div style={{ padding: "12px 20px 0", display: "flex", gap: 8, overflowX: "auto" }}>
          {[{ v: "all", l: "Toutes" }, { v: "confirmed", l: "Confirmées" }, { v: "pending", l: "En attente" }].map(f => (
            <button key={f.v} onClick={() => setFilter(f.v)}
              className={`tp-chip ${filter === f.v ? "tp-chip-accent" : ""}`}
              style={{ cursor: "pointer", border: "1px solid var(--border)", padding: "6px 14px", fontSize: 12, flexShrink: 0 }}>{f.l}</button>
          ))}
        </div>
      </div>

      {/* ─── LISTE SCROLLABLE INDÉPENDAMMENT ─────────────────────── */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",        // scroll inertiel iOS
        overscrollBehavior: "contain",           // pas de "rebond" qui leak vers le body
        padding: "14px 20px calc(110px + env(safe-area-inset-bottom)) 20px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 0,
      }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-dim)" }}>
            <Car size={32} style={{ opacity: 0.3, margin: "0 auto 10px" }}/>
            <div style={{ fontSize: 13 }}>Aucune course pour l'instant</div>
            <button onClick={onQuickVoice} className="tp-btn tp-btn-primary" style={{ marginTop: 16 }}>
              <Mic size={14}/> Créer par dictée
            </button>
          </div>
        ) : (
          filtered.map(b => <BookingCard key={b.id} booking={b} onClick={() => onOpenBooking(b)}/>)
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   INVOICES SCREEN
   ------------------------------------------------------------------------- */
function InvoicesScreen({ invoices, bookings, tokenBalance, onOpenInvoice, onGoTab }) {
  const [search, setSearch] = useState("");
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s,i) => s+i.amount, 0);
  const totalPending = invoices.filter(i => i.status === "pending").reduce((s,i) => s+i.amount, 0);
  const filtered = invoices.filter(i => !search || i.customerName.toLowerCase().includes(search.toLowerCase()) || i.number.includes(search));

  return (
    /* Layout type "app native" : header (TopBar + stats + recherche +
       export CSV) FIXE, liste des factures = SEULE zone scrollable. */
    <div className="tp-fade-in" style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      paddingTop: "calc(env(safe-area-inset-top) + 14px)",
      minHeight: 0,
    }}>
      {/* ─── HEADER FIXE ─────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, background: "var(--bg-gradient)", paddingBottom: 14 }}>
        <TopBar title="Factures" subtitle={`Numérotation chronologique garantie`}
          rightAction={<TokenBadge balance={tokenBalance} onClick={() => onGoTab("tokens")} compact/>}/>

        <div style={{ padding: "0 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="tp-card-elevated" style={{ padding: 14 }}>
            <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Encaissé</div>
            <div className="tp-serif" style={{ fontSize: 22, fontWeight: 600, marginTop: 4, color: "var(--success)" }}>{eur(totalPaid)}</div>
          </div>
          <div className="tp-card-elevated" style={{ padding: 14 }}>
            <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>En attente</div>
            <div className="tp-serif" style={{ fontSize: 22, fontWeight: 600, marginTop: 4, color: "var(--warn)" }}>{eur(totalPending)}</div>
          </div>
        </div>

        <div style={{ padding: "14px 20px 0" }}>
          <div style={{ position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 14, top: 13, color: "var(--muted)" }}/>
            <input className="tp-input" style={{ paddingLeft: 38 }} placeholder="Rechercher N° ou client..." value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
        </div>

        {/* Export comptable mensuel — utile pour le comptable du chauffeur */}
        <div style={{ padding: "12px 20px 0" }}>
          <button onClick={() => {
            const result = exportInvoicesCsv(invoices, bookings, new Date());
            if (result.count === 0) {
              alert("Aucune facture sur le mois en cours.");
            } else {
              alert(`✅ Export CSV téléchargé : ${result.count} facture(s), ${eur(result.totalTTC)} TTC.\n\nFichier prêt à être envoyé à votre comptable.`);
            }
          }} className="tp-btn tp-btn-ghost" style={{ width: "100%", justifyContent: "center", fontSize: 13 }}>
            <Download size={15}/> Exporter le mois en CSV (pour comptable)
          </button>
        </div>
      </div>

      {/* ─── LISTE FACTURES SCROLLABLE INDÉPENDAMMENT ────────────── */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        overscrollBehavior: "contain",
        padding: "14px 20px calc(110px + env(safe-area-inset-bottom)) 20px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 0,
      }}>
        {filtered.map(inv => (
          <button key={inv.id} onClick={() => onOpenInvoice(inv)} className="tp-card"
            style={{ padding: 14, textAlign: "left", cursor: "pointer", background: "var(--surface)", display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent-ink)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Receipt size={18}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{inv.customerName}</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{inv.number} · {formatDate(inv.date)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="tp-serif" style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>{eur(inv.amount)}</div>
              <div className={`tp-chip ${inv.status === "paid" ? "tp-chip-success" : "tp-chip-warn"}`} style={{ marginTop: 4, fontSize: 10, padding: "2px 8px" }}>
                {inv.status === "paid" ? "Encaissée" : "En attente"}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   INVOICE DETAIL
   ------------------------------------------------------------------------- */
function InvoiceDetail({ invoice, booking, onBack, invoiceSettings = {}, currentUser = null, onStatusChanged }) {
  // ⚠️ Règle des hooks : TOUS les hooks avant tout early-return. Ces états
  // (aperçu PDF) vivaient après le `return null` → violation détectée par le
  // lint (crash potentiel si `invoice` change de nullité en cours de vie).
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  if (!invoice) return null;

  // Profil "en dur" pour le PDF : on prend les VRAIES données du compte
  // utilisateur connecté (currentUser depuis Supabase) en priorité.
  // Les valeurs hardcodées de DRIVER_PROFILE ne sont PLUS utilisées sur
  // la facture — elles servaient juste de démo pour le mode invité.
  const realProfile = currentUser ? {
    name: currentUser.name || '',
    email: currentUser.email || '',
    phone: currentUser.phone || '',
    siret: currentUser.siret || '',
    // Taux réel de la facture (10 % course / 20 % achat de crédits) plutôt
    // qu'un 10 % figé, sinon le PDF affichait un taux incohérent avec le
    // montant de TVA effectivement inscrit.
    vatRate: invoice.vatRate ?? 10,
    // Tous les autres champs (companyName, vtcNumber, proCardNumber,
    // vehicleModel, vehiclePlate, address) viennent de invoiceSettings
    // car ils ne sont pas stockés dans la table users.
  } : DRIVER_PROFILE; // fallback démo pour mode invité uniquement

  // ─── Handlers branchés sur jsPDF + Capacitor Share + URL schemes ──────
  // Ils marchent sur web (téléchargement direct + Web Share API si dispo)
  // ET sur mobile (menu de partage natif iOS/Android avec PDF en pièce jointe).
  const filename = `${invoice.number || 'facture'}.pdf`;

  // Date de la prestation : on prend en priorité le booking lié, sinon
  // la date d'émission de la facture comme fallback (jamais vide).
  const prestationDate = booking?.dateTime
    ? formatDate(booking.dateTime)
    : (invoice.date ? formatDate(invoice.date) : 'date non renseignée');

  const summaryText = `Bonjour ${invoice.customerName || ''},\n\nVoici votre facture ${invoice.number} d'un montant de ${eur(invoice.amount)} pour la course du ${prestationDate}.\n\nLe PDF de la facture vous est envoyé en pièce jointe (ou disponible sur demande à contact@trajetpro.fr).\n\nMerci de votre confiance,\n${DRIVER_PROFILE.firstName || ''} ${DRIVER_PROFILE.lastName || ''}\nTrajetPro`;

  const onDownload = async () => {
    try {
      await downloadInvoicePdf(invoice, booking, realProfile, invoiceSettings);
    } catch (e) {
      alert("Erreur lors de la génération du PDF : " + (e?.message || e));
    }
  };

  const onShareInvoice = async () => {
    try {
      const blob = await buildInvoicePdf(invoice, booking, realProfile, invoiceSettings);
      await sharePdf(blob, filename, {
        title: `Facture ${invoice.number}`,
        text: summaryText,
      });
    } catch (e) {
      alert("Erreur lors du partage : " + (e?.message || e));
    }
  };

  const onShareLink = async () => {
    // Pas d'URL publique pour l'instant → on partage juste le résumé texte
    await shareGeneric({
      title: `Facture ${invoice.number}`,
      text: summaryText,
      dialogTitle: 'Partager les détails de la facture',
    });
  };

  // Le protocole `mailto:` NE PEUT PAS attacher de fichier — c'est une
  // limitation native du navigateur, pas un bug. Pour contourner, on
  // télécharge le PDF d'abord (il atterrit dans Téléchargements/Downloads),
  // puis on ouvre le client mail avec un texte qui invite l'utilisateur
  // à attacher manuellement. C'est en 2 clics au lieu d'1, mais c'est
  // robuste sur web et évite la frustration d'un email "vide".
  //
  // Sur mobile, le bouton "Envoyer (PDF)" passe par le menu de partage
  // natif qui, lui, attache le PDF automatiquement → meilleure UX.
  const onEmail = async () => {
    try {
      await downloadInvoicePdf(invoice, booking, realProfile, invoiceSettings);
    } catch (_e) { /* on continue même si le download échoue */ }
    openMailto({
      subject: `Facture ${invoice.number} — TrajetPro`,
      body: summaryText + `\n\n──────────\n📎 Le PDF "${filename}" a été téléchargé sur votre appareil. Joignez-le manuellement à cet email avant l'envoi (icône trombone dans votre client mail).`,
    });
  };

  // SMS — limitation OS : le schéma `sms:` ne peut PAS attacher de fichier.
  // Solution : on génère le PDF + on ouvre la feuille de partage iOS native,
  // ─── Envoi WhatsApp ────────────────────────────────────────────────
  // Stratégie : sur mobile, on tente d'abord la feuille de partage iOS
  // qui propose WhatsApp ET attache le PDF en document. C'est le seul
  // chemin qui permet d'envoyer le PDF en pièce jointe — le deep link
  // wa.me/?text=... ne supporte PAS les fichiers, juste un texte.
  //
  // Si la feuille de partage est annulée OU si on est sur web, on
  // bascule sur le deep link wa.me qui ouvre WhatsApp avec le texte
  // prérempli (sans PDF, mais l'utilisateur peut joindre le PDF
  // téléchargé manuellement depuis WhatsApp).
  const onWhatsApp = async () => {
    const messageText = `Bonjour, voici votre facture ${invoice.number} d'un montant de ${eur(invoice.amount)} pour la course du ${prestationDate}.\n\nMerci de votre confiance.\n— TrajetPro`;
    try {
      const blob = await buildInvoicePdf(invoice, booking, realProfile, invoiceSettings);
      const result = await sharePdf(blob, filename, {
        title: `Facture ${invoice.number}`,
        text: messageText,
      });
      // Si le user a annulé OU si la feuille de partage n'est pas dispo
      // (web pur), on tente le deep link wa.me en fallback.
      if (!result?.ok || result?.downloaded) {
        const waUrl = `https://wa.me/?text=${encodeURIComponent(messageText)}`;
        window.open(waUrl, '_blank');
      }
    } catch (e) {
      // En cas d'échec sharePdf, fallback wa.me direct
      const waUrl = `https://wa.me/?text=${encodeURIComponent(messageText)}`;
      window.open(waUrl, '_blank');
    }
  };

  // ─── Aperçu PDF in-app ───────────────────────────────────────────────
  // Génère le PDF en mémoire et l'affiche dans une iframe modale. iOS
  // WKWebView et tous les navigateurs modernes savent rendre les PDF
  // nativement via `application/pdf` MIME type. L'utilisateur peut
  // pinch-zoomer comme dans Aperçu macOS / Files iOS.
  // (états previewOpen/previewUrl/previewLoading déclarés en tête de
  // composant — règle des hooks.)
  const onPreview = async () => {
    setPreviewLoading(true);
    try {
      const blob = await buildInvoicePdf(invoice, booking, realProfile, invoiceSettings);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewOpen(true);
    } catch (e) {
      alert("Erreur lors de la génération de l'aperçu : " + (e?.message || e));
    } finally {
      setPreviewLoading(false);
    }
  };

  // Cleanup du blob URL quand on ferme la preview (sinon fuite mémoire)
  const closePreview = () => {
    setPreviewOpen(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  return (
    <div className="tp-scroll tp-no-scroll tp-fade-in">
      <TopBar title={invoice.number} subtitle={`Émise le ${formatDate(invoice.date)}`} onBack={onBack}
        rightAction={
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={onPreview} disabled={previewLoading} className="tp-btn tp-btn-ghost" style={{ padding: 8, borderRadius: 10 }} title="Aperçu PDF">
              {previewLoading ? <Loader2 size={16} style={{ animation: "tp-spin 1s linear infinite" }}/> : <Eye size={16}/>}
            </button>
            <button onClick={onDownload} className="tp-btn tp-btn-ghost" style={{ padding: 8, borderRadius: 10 }} title="Télécharger le PDF"><Download size={16}/></button>
          </div>
        }/>

      {/* Modal aperçu PDF */}
      {previewOpen && previewUrl && (
        <div className="tp-overlay" onClick={closePreview} style={{ alignItems: "stretch", padding: 0 }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", height: "100%", maxWidth: 430,
            background: "var(--surface)",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{
              padding: "calc(env(safe-area-inset-top) + 10px) 14px 10px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "var(--bg-gradient)", borderBottom: "1px solid var(--border)",
            }}>
              <div className="tp-serif" style={{ fontSize: 16, fontWeight: 600 }}>Aperçu — {invoice.number}</div>
              <button onClick={closePreview} className="tp-btn tp-btn-ghost" style={{ padding: 8, borderRadius: 10 }}>
                <X size={18}/>
              </button>
            </div>
            <iframe
              src={previewUrl}
              title={`Facture ${invoice.number}`}
              style={{ flex: 1, width: "100%", border: "none", background: "#fff" }}
            />
            <div style={{
              padding: "10px 14px calc(env(safe-area-inset-bottom) + 14px)",
              borderTop: "1px solid var(--border)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
            }}>
              <button onClick={onDownload} className="tp-btn tp-btn-ghost" style={{ justifyContent: "center" }}>
                <Download size={15}/> Télécharger
              </button>
              <button onClick={onShareInvoice} className="tp-btn tp-btn-primary" style={{ justifyContent: "center" }}>
                <Send size={15}/> Partager
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: "8px 20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="tp-card-elevated" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <div className="tp-serif" style={{ fontSize: 22, fontWeight: 600, color: "var(--accent-ink)" }}>TrajetPro</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{DRIVER_PROFILE.companyName}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className={`tp-chip ${invoice.status === "paid" ? "tp-chip-success" : "tp-chip-warn"}`}>{invoice.status === "paid" ? "Payée" : "En attente"}</div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div className="tp-label" style={{ marginBottom: 4 }}>Facturé à</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{invoice.customerName}</div>
          </div>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            {booking && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Prestation de transport VTC</div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{booking.pickupAddress} → {booking.dropoffAddress}</div>
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{formatDateTime(booking.dateTime)} · {booking.passengers} pers.</div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
              <span style={{ color: "var(--text-dim)" }}>Montant HT</span>
              <span>{eur(invoice.amount - invoice.vatAmount)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
              <span style={{ color: "var(--text-dim)" }}>TVA ({invoice.vatRate ?? DRIVER_PROFILE.vatRate}%)</span>
              <span>{eur(invoice.vatAmount)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", borderTop: "1px solid var(--border)", marginTop: 6 }}>
              <span className="tp-serif" style={{ fontSize: 16, fontWeight: 600 }}>Total TTC</span>
              <span className="tp-serif" style={{ fontSize: 22, fontWeight: 600, color: "var(--accent-ink)" }}>{eur(invoice.amount)}</span>
            </div>
          </div>

          {/* Bouton Marquer comme encaissée — uniquement si la facture
              est en attente. Pour les paiements espèces/chèque/virement
              hors-Stripe, le chauffeur change le statut manuellement.
              Les factures payées via Stripe sont auto-marquées 'paid'
              par le webhook → ce bouton n'apparaît pas. */}
          {invoice.status !== "paid" && (
            <div style={{ marginTop: 18 }}>
              <button
                onClick={async () => {
                  if (!window.confirm(`Confirmer l'encaissement de la facture ${invoice.number} (${eur(invoice.amount)}) ?`)) return;
                  try {
                    await sbMarkInvoicePaid(invoice.id);
                    // 🔄 Notifie le parent → met à jour l'état local immédiat
                    // (statut + paid_at + liste globale Factures). Sans ce
                    // callback, l'UI affichait toujours "En attente" et le
                    // total "Encaissé" restait à 0 € jusqu'au prochain reload.
                    onStatusChanged?.('paid');
                    alert("✅ Facture marquée comme encaissée.");
                  } catch (e) {
                    alert("Erreur : " + (e?.message || e));
                  }
                }}
                className="tp-btn tp-btn-primary"
                style={{ width: "100%", justifyContent: "center", padding: "12px 16px" }}>
                <CheckCircle2 size={16}/> Marquer comme encaissée
              </button>
              <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 6, textAlign: "center" }}>
                Pour les paiements espèces, chèque ou virement hors-Stripe.
              </div>
            </div>
          )}
          {invoice.status === "paid" && (
            <div style={{ marginTop: 18, textAlign: "center" }}>
              <button
                onClick={async () => {
                  if (!window.confirm("Repasser cette facture en « en attente » ?")) return;
                  try {
                    await sbMarkInvoiceUnpaid(invoice.id);
                    onStatusChanged?.('pending');
                    alert("Facture repassée en attente.");
                  } catch (e) {
                    alert("Erreur : " + (e?.message || e));
                  }
                }}
                style={{ fontSize: 11, color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                Annuler l'encaissement
              </button>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button onClick={onShareInvoice} className="tp-btn tp-btn-primary"><Send size={15}/> Envoyer (PDF)</button>
          <button onClick={onShareLink} className="tp-btn tp-btn-ghost"><Share2 size={15}/> Partager texte</button>
          <button onClick={onEmail} className="tp-btn tp-btn-ghost"><Mail size={15}/> Email</button>
          <button onClick={onWhatsApp} className="tp-btn tp-btn-ghost" style={{ color: "var(--wa-ink)" }}>
            <MessageCircle size={15}/> WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   TOKENS SCREEN — "Gérer mes jetons" (accessible via Profil)
   ------------------------------------------------------------------------- */
function TokensScreen({ tokenBalance, tokenHistory, onOpenPurchase, onOpenPurchaseDetail, onBack }) {
  // On exclut les crédits offerts du total dépensé et du total acheté payant
  const paidHistory = tokenHistory.filter(t => !t.isWelcome);
  const totalSpent = paidHistory.reduce((s, t) => s + t.priceTTC, 0);
  const totalTokensBought = paidHistory.reduce((s, t) => s + t.tokens, 0);
  const hasWelcomeGift = tokenHistory.some(t => t.isWelcome);

  return (
    <div className="tp-scroll tp-fade-in">
      <TopBar title="Gérer mes jetons" subtitle="Rechargez vos crédits" onBack={onBack}/>

      <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Driver info card */}
        <div className="tp-card" style={{ padding: 16, background: "var(--surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: "linear-gradient(135deg, var(--accent), #1E40AF)",
              color: "var(--accent-on)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 700, fontFamily: "'Fraunces', serif",
            }}>
              {DRIVER_PROFILE.firstName[0]}{DRIVER_PROFILE.lastName[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tp-serif" style={{ fontSize: 16, fontWeight: 600 }}>{DRIVER_PROFILE.firstName} {DRIVER_PROFILE.lastName}</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{DRIVER_PROFILE.companyName}</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 11 }}>
            <div>
              <div style={{ color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 10 }}>SIRET</div>
              <div style={{ color: "var(--text)", fontWeight: 600 }}>{DRIVER_PROFILE.siret}</div>
            </div>
            <div>
              <div style={{ color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 10 }}>N° VTC</div>
              <div style={{ color: "var(--text)", fontWeight: 600 }}>{DRIVER_PROFILE.vtcNumber}</div>
            </div>
          </div>
        </div>

        {/* Welcome gift banner */}
        {hasWelcomeGift && paidHistory.length === 0 && (
          <div className="tp-card" style={{ padding: 14, background: "linear-gradient(135deg, rgba(74,222,128,0.12), rgba(74,222,128,0.02))", borderColor: "rgba(74,222,128,0.3)", display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--success-soft)", color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Gift size={18}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--success)" }}>Bienvenue sur TrajetPro !</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2, lineHeight: 1.5 }}>
                {WELCOME_TOKENS} crédits vous ont été offerts pour découvrir l'application.
              </div>
            </div>
          </div>
        )}

        {/* Balance card */}
        <div className="tp-card-elevated" style={{ padding: 24, textAlign: "center", position: "relative", overflow: "hidden", background: "linear-gradient(140deg, rgba(37,99,235,0.15), rgba(37,99,235,0.02) 60%)", borderColor: "var(--accent-ring)" }}>
          <div style={{
            position: "absolute", top: -30, right: -30,
            width: 140, height: 140, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(37,99,235,0.15), transparent 70%)",
            pointerEvents: "none",
          }}/>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
            <Coins size={16} style={{ color: "var(--accent-ink)" }}/>
            <div style={{ fontSize: 11, color: "var(--accent-ink)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>Vous disposez de</div>
          </div>
          <div className="tp-serif" style={{ fontSize: 64, fontWeight: 600, color: "var(--accent-ink)", lineHeight: 1, marginBottom: 6 }}>
            {tokenBalance}
          </div>
          <div style={{ fontSize: 14, color: "var(--text)", fontWeight: 600 }}>
            crédit{tokenBalance > 1 ? "s" : ""}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>
            1 crédit = 1 bon ou 1 facture
          </div>
        </div>

        {/* Buy button */}
        <button onClick={onOpenPurchase} className="tp-btn tp-btn-primary" style={{ width: "100%", padding: "16px", fontSize: 15, boxShadow: "0 8px 24px -10px rgba(37,99,235,0.6)" }}>
          <Plus size={18}/> Acheter des jetons
        </button>

        {/* Quick stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="tp-card" style={{ padding: 14, background: "var(--surface)" }}>
            <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total acheté</div>
            <div className="tp-serif" style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{totalTokensBought} <span style={{ fontSize: 12, color: "var(--text-dim)" }}>crédits</span></div>
          </div>
          <div className="tp-card" style={{ padding: 14, background: "var(--surface)" }}>
            <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Dépensé</div>
            <div className="tp-serif" style={{ fontSize: 20, fontWeight: 600, marginTop: 4, color: "var(--accent-ink)" }}>{eur(totalSpent)}</div>
          </div>
        </div>

        {/* Purchase history */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <History size={14} style={{ color: "var(--text-dim)" }}/>
            <div className="tp-label">Historique de vos achats</div>
          </div>
          {tokenHistory.length === 0 ? (
            <div className="tp-card" style={{ padding: 24, textAlign: "center", color: "var(--text-dim)", fontSize: 13, background: "var(--surface)" }}>
              Aucun achat pour l'instant
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tokenHistory.map(h => (
                <button key={h.id} onClick={() => !h.isWelcome && onOpenPurchaseDetail(h)} className="tp-card"
                  style={{ width: "100%", padding: 14, display: "flex", alignItems: "center", gap: 12, cursor: h.isWelcome ? "default" : "pointer", background: "var(--surface)", textAlign: "left" }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: h.isWelcome ? "var(--success-soft)" : "var(--accent-soft)",
                    color: h.isWelcome ? "var(--success)" : "var(--accent)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    {h.isWelcome ? <Gift size={16}/> : <Coins size={16}/>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                      +{h.tokens} crédits <span style={{ color: "var(--text-dim)", fontWeight: 500, fontSize: 12 }}>· {h.package}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                      {formatDate(h.date)} · {h.invoiceNumber}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {h.isWelcome ? (
                      <div className="tp-chip tp-chip-success" style={{ fontSize: 10, padding: "2px 8px" }}>Offert</div>
                    ) : (
                      <>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent-ink)" }}>{eur(h.priceTTC)}</div>
                        <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
                          {h.vatApplied ? `TVA ${eur(h.vatAmount)}` : "Auto-liquidation"}
                        </div>
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Consumption info */}
        <div className="tp-card" style={{ padding: 14, background: "var(--surface)", display: "flex", gap: 10 }}>
          <TrendingDown size={16} style={{ color: "var(--text-dim)", flexShrink: 0, marginTop: 2 }}/>
          <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6 }}>
            <div style={{ color: "var(--text)", fontWeight: 600, marginBottom: 4, fontSize: 12 }}>Consommation</div>
            Création d'un bon de course : <b style={{ color: "var(--text)" }}>1 crédit</b><br/>
            Émission d'une facture : <b style={{ color: "var(--text)" }}>1 crédit</b><br/>
            Modifier, partager, consulter : <b style={{ color: "var(--success)" }}>gratuit</b>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   PURCHASE MODAL — acheter des jetons
   ------------------------------------------------------------------------- */
function PurchaseModal({ open, onClose, onConfirm }) {
  const [selected, setSelected] = useState("pack40");
  const [vatIntra, setVatIntra] = useState("");
  const [showVatField, setShowVatField] = useState(false);
  const [step, setStep] = useState("choose");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const pack = TOKEN_PACKAGES.find(p => p.id === selected);
  const validIntra = isValidVatIntra(vatIntra);
  const applyReverseCharge = showVatField && validIntra && !vatIntra.toUpperCase().startsWith("FR");

  const priceTTC = pack.priceTTC;
  const priceHT = +(priceTTC / 1.2).toFixed(2);
  const vatAmount = +(priceTTC - priceHT).toFixed(2);
  const finalPrice = applyReverseCharge ? priceHT : priceTTC;

  useEffect(() => {
    if (!open) {
      setStep("choose"); setSelected("pack40");
      setVatIntra(""); setShowVatField(false);
      setLoading(false); setResult(null);
    }
  }, [open]);

  const handleConfirm = async () => {
    setLoading(true);
    // On déclare l'objet purchase pour le mode invité (et comme fallback UI).
    const purchase = {
      id: genId(),
      packageId: pack.id,
      invoiceNumber: `TRP-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      date: new Date().toISOString().slice(0, 10),
      package: pack.label,
      tokens: pack.tokens,
      priceTTC: finalPrice,
      priceHT: priceHT,
      vatAmount: applyReverseCharge ? 0 : vatAmount,
      vatApplied: !applyReverseCharge,
      vatIntra: showVatField ? vatIntra.toUpperCase() : "",
      paymentMethod:
        isInAppPurchaseAvailable() ? "App Store" :
        paymentMethod === "applepay" ? "Apple Pay" : "Carte bancaire",
    };

    try {
      // onConfirm peut être asynchrone (mode connecté → Stripe Checkout redirect).
      // S'il déclenche un window.location.assign, le code ci-dessous ne s'exécutera pas.
      const result = await Promise.resolve(onConfirm(purchase));
      // Mode invité ou retour synchrone : on affiche le succès en local.
      setResult(result || purchase);
      setLoading(false);
      setStep("success");
    } catch (err) {
      setLoading(false);
      // Si le caller a déjà affiché son propre dialogue (mode invité par
      // exemple : on lui propose la création de compte), on n'affiche pas
      // un alert redondant. Convention : message commençant par "Compte requis".
      if (err?.message?.includes("Compte requis")) {
        return;
      }
      alert(`Paiement impossible : ${err?.message || err}`);
    }
  };

  if (!open) return null;

  return (
    <div className="tp-overlay" onClick={onClose}>
      <div className="tp-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="tp-grab"/>
        <div style={{ padding: "16px 20px 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div className="tp-serif" style={{ fontSize: 22, fontWeight: 600 }}>
                {step === "success" ? "Achat confirmé" : "Recharger mes crédits"}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
                {step === "choose" && "Choisissez le pack qui vous convient"}
                {step === "confirm" && "Vérifiez votre commande"}
                {step === "success" && "Vos crédits ont été ajoutés"}
              </div>
            </div>
            <button onClick={onClose} className="tp-btn tp-btn-ghost" style={{ padding: 8, borderRadius: 10 }}><X size={18}/></button>
          </div>

          {step === "choose" && (
            <>
              {/* Packs (le n° TVA intracommunautaire se renseigne désormais
                  dans Profil → Facturation, et s'applique automatiquement
                  ici si présent — UI épurée pour rester sur une seule page) */}
              <div className="tp-label" style={{ marginBottom: 10 }}>Choisissez un pack</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {TOKEN_PACKAGES.map(p => {
                  const pricePerToken = (p.priceTTC / p.tokens).toFixed(3);
                  const isSelected = selected === p.id;
                  return (
                    <button key={p.id} onClick={() => setSelected(p.id)}
                      className={`tp-pack-card ${isSelected ? "selected" : ""}`}>
                      {p.bestValue && (
                        <div className="tp-pack-ribbon">
                          <Crown size={8} style={{ display: "inline", verticalAlign: "middle", marginRight: 2 }}/>
                          Top
                        </div>
                      )}
                      <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: isSelected ? "var(--accent)" : "var(--surface-3)",
                        color: isSelected ? "#0B0B0D" : "var(--accent)",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        transition: "all 0.2s",
                      }}>
                        <Coins size={20}/>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span className="tp-serif" style={{ fontSize: 22, fontWeight: 600, color: isSelected ? "var(--accent-ink)" : "var(--text)" }}>{p.tokens}</span>
                          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>crédits</span>
                          {p.popular && <span className="tp-chip tp-chip-accent" style={{ fontSize: 9, padding: "2px 7px" }}>Populaire</span>}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 1 }}>
                          {p.label} · {pricePerToken}€ / crédit
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="tp-serif" style={{ fontSize: 20, fontWeight: 600, color: isSelected ? "var(--accent-ink)" : "var(--text)" }}>
                          {eur(applyReverseCharge ? +(p.priceTTC / 1.2).toFixed(2) : p.priceTTC)}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
                          {applyReverseCharge ? "HT" : "TTC"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Conditions d'achat */}
              <div style={{
                padding: 12, background: "var(--surface-2)", border: "1px solid var(--border)",
                borderRadius: 10, fontSize: 10, color: "var(--text-dim)", lineHeight: 1.6, marginBottom: 16,
              }}>
                <div style={{ color: "var(--text)", fontWeight: 700, marginBottom: 4, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 4 }}>
                  <Lock size={10}/> Conditions d'achat
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <div>• Paiement sécurisé via prestataire agréé (Stripe, Apple Pay).</div>
                  <div>• TVA française 20% appliquée. Auto-liquidation possible avec un n° TVA intracommunautaire valide (hors France), art. 283-2 du CGI.</div>
                  <div>• Les crédits achetés <b>n'expirent pas</b> et restent disponibles sans limite de durée.</div>
                  <div>• Achat ferme et définitif. Non remboursable sauf dysfonctionnement technique prouvé imputable à l'éditeur.</div>
                  <div>• Une facture nominative est générée automatiquement et peut être renvoyée par email depuis l'historique.</div>
                  <div>• Aucun abonnement, aucun engagement : paiement à l'unité.</div>
                  <div>• En validant, vous acceptez nos CGV consultables dans Profil &gt; Conditions générales.</div>
                </div>
              </div>

              <button onClick={() => setStep("confirm")} className="tp-btn tp-btn-primary" style={{ width: "100%", padding: "14px", fontSize: 15 }}>
                Continuer · {eur(finalPrice)}
              </button>
            </>
          )}

          {step === "confirm" && (
            <div className="tp-fade-in">
              <div className="tp-card-elevated" style={{ padding: 18, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--accent)", color: "var(--accent-on)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Coins size={22}/>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="tp-serif" style={{ fontSize: 20, fontWeight: 600 }}>{pack.tokens} crédits</div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Pack {pack.label}</div>
                  </div>
                </div>

                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-dim)" }}>Prix HT</span>
                    <span>{eur(priceHT)}</span>
                  </div>
                  {applyReverseCharge ? (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--success)" }}>TVA (auto-liquidée)</span>
                      <span style={{ color: "var(--success)" }}>— {eur(vatAmount)}</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-dim)" }}>TVA 20%</span>
                      <span>{eur(vatAmount)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--border)", marginTop: 4 }}>
                    <span className="tp-serif" style={{ fontSize: 16, fontWeight: 600 }}>Total à payer</span>
                    <span className="tp-serif" style={{ fontSize: 22, fontWeight: 600, color: "var(--accent-ink)" }}>{eur(finalPrice)}</span>
                  </div>
                </div>

                {showVatField && vatIntra && (
                  <div style={{ marginTop: 14, padding: 10, background: "var(--surface-2)", borderRadius: 8, fontSize: 11 }}>
                    <div style={{ color: "var(--text-dim)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, marginBottom: 2 }}>N° TVA intracommunautaire</div>
                    <div style={{ fontFamily: "monospace", fontWeight: 600 }}>{vatIntra.toUpperCase()}</div>
                  </div>
                )}
              </div>

              {isInAppPurchaseAvailable() ? (
                // Sur iOS, l'achat passe par l'App Store (In-App Purchase) —
                // Apple affiche lui-même sa propre sheet de paiement native,
                // pas de choix de moyen de paiement à faire côté app.
                <div className="tp-card" style={{
                  padding: 14, display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
                  background: "var(--surface)",
                }}>
                  <ShieldCheck size={18} style={{ color: "var(--text-dim)" }}/>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>Paiement via l'App Store</span>
                </div>
              ) : (
                <>
                  <div className="tp-label" style={{ marginBottom: 8 }}>Méthode de paiement</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                    {[
                      { v: "card", l: "Carte bancaire", icon: CreditCard },
                    ].map(m => {
                      const isActive = paymentMethod === m.v;
                      return (
                        <button key={m.v} onClick={() => setPaymentMethod(m.v)} className="tp-card" style={{
                          padding: 14, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left",
                          borderColor: isActive ? "var(--accent)" : "var(--border)",
                          background: isActive ? "var(--accent-soft)" : "var(--surface)",
                        }}>
                          <m.icon size={18} style={{ color: isActive ? "var(--accent-ink)" : "var(--text-dim)" }}/>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{m.l}</span>
                          {isActive && <Check size={16} style={{ color: "var(--accent-ink)" }}/>}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setStep("choose")} className="tp-btn tp-btn-ghost" style={{ flex: 1 }} disabled={loading}>Retour</button>
                <button onClick={handleConfirm} disabled={loading} className="tp-btn tp-btn-primary" style={{ flex: 2 }}>
                  {loading ? <><Loader2 size={16} style={{ animation: "tp-spin 1s linear infinite" }}/> Traitement...</> : <><Lock size={15}/> Payer {eur(finalPrice)}</>}
                </button>
              </div>
            </div>
          )}

          {step === "success" && result && (
            <div className="tp-scale-in">
              <div style={{ textAlign: "center", padding: "20px 0 24px" }}>
                <div style={{
                  width: 72, height: 72, margin: "0 auto 16px",
                  borderRadius: "50%", background: "var(--success-soft)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "2px solid var(--success)",
                }}>
                  <CheckCircle2 size={36} style={{ color: "var(--success)" }}/>
                </div>
                <div className="tp-serif" style={{ fontSize: 26, fontWeight: 600, marginBottom: 6 }}>
                  +{result.tokens} crédits
                </div>
                <div style={{ fontSize: 13, color: "var(--text-dim)" }}>
                  Ajoutés à votre compte instantanément
                </div>
              </div>

              <div className="tp-card" style={{ padding: 14, background: "var(--surface)", marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: "var(--text-dim)" }}>Facture</span>
                  <span style={{ fontWeight: 600, fontFamily: "monospace" }}>{result.invoiceNumber}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: "var(--text-dim)" }}>Montant</span>
                  <span style={{ fontWeight: 600 }}>{eur(result.priceTTC)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "var(--text-dim)" }}>Paiement</span>
                  <span style={{ fontWeight: 600 }}>{result.paymentMethod}</span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <button className="tp-btn tp-btn-ghost"><Mail size={15}/> Par email</button>
                <button className="tp-btn tp-btn-ghost"><Download size={15}/> Télécharger</button>
              </div>

              <button onClick={onClose} className="tp-btn tp-btn-primary" style={{ width: "100%" }}>Terminer</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   PURCHASE DETAIL MODAL
   ------------------------------------------------------------------------- */
function PurchaseDetailModal({ open, purchase, onClose }) {
  const fingerprint = useMemo(() => genFingerprint(), [purchase?.id]);
  if (!open || !purchase) return null;
  return (
    <div className="tp-overlay" onClick={onClose}>
      <div className="tp-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="tp-grab"/>
        <div style={{ padding: "16px 20px 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div>
              <div className="tp-serif" style={{ fontSize: 22, fontWeight: 600 }}>Facture d'achat</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{purchase.invoiceNumber}</div>
            </div>
            <button onClick={onClose} className="tp-btn tp-btn-ghost" style={{ padding: 8, borderRadius: 10 }}><X size={18}/></button>
          </div>

          <div className="tp-card-elevated" style={{ padding: 18, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div className="tp-serif" style={{ fontSize: 20, fontWeight: 600, color: "var(--accent-ink)" }}>TrajetPro</div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>Éditeur de logiciel VTC</div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 6, lineHeight: 1.5 }}>
                  TrajetPro SAS · 12 rue de la République<br/>
                  84000 Avignon · France<br/>
                  SIRET : 909 123 456 00018<br/>
                  TVA : FR45 909123456
                </div>
              </div>
              <span className="tp-chip tp-chip-success">Payée</span>
            </div>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginBottom: 12 }}>
              <div className="tp-label" style={{ marginBottom: 4 }}>Facturé à</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{DRIVER_PROFILE.companyName}</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2, lineHeight: 1.5 }}>
                SIRET : {DRIVER_PROFILE.siret}<br/>
                N° VTC : {DRIVER_PROFILE.vtcNumber}
                {purchase.vatIntra && <><br/>TVA intra : {purchase.vatIntra}</>}
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Pack {purchase.package}</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{purchase.tokens} crédits TrajetPro</div>
                </div>
                <div style={{ fontWeight: 600 }}>{eur(purchase.priceHT)}</div>
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                <span style={{ color: "var(--text-dim)" }}>Sous-total HT</span>
                <span>{eur(purchase.priceHT)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                <span style={{ color: "var(--text-dim)" }}>
                  {purchase.vatApplied ? "TVA 20%" : "TVA auto-liquidée"}
                </span>
                <span>{purchase.vatApplied ? eur(purchase.vatAmount) : "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--border)", marginTop: 4 }}>
                <span className="tp-serif" style={{ fontSize: 16, fontWeight: 600 }}>Total</span>
                <span className="tp-serif" style={{ fontSize: 22, fontWeight: 600, color: "var(--accent-ink)" }}>{eur(purchase.priceTTC)}</span>
              </div>
            </div>

            {!purchase.vatApplied && (
              <div style={{ marginTop: 12, padding: 8, background: "var(--surface-2)", borderRadius: 8, fontSize: 10, color: "var(--text-dim)", lineHeight: 1.5 }}>
                TVA auto-liquidée par le preneur — art. 283-2 du CGI. Opération intracommunautaire.
              </div>
            )}

            <div style={{ marginTop: 14, padding: 12, background: "var(--surface-2)", borderRadius: 10, display: "flex", gap: 12, alignItems: "center" }}>
              <PseudoQR seed={fingerprint} size={64}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Date de paiement</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{formatDate(purchase.date)}</div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{purchase.paymentMethod}</div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button className="tp-btn tp-btn-primary"><Mail size={15}/> Envoyer par email</button>
            <button className="tp-btn tp-btn-ghost"><Download size={15}/> Télécharger</button>
            <button className="tp-btn tp-btn-ghost"><Share2 size={15}/> Partager</button>
            <button className="tp-btn tp-btn-ghost" style={{ color: "var(--wa-ink)" }}>
              <MessageCircle size={15}/> WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   INSUFFICIENT TOKENS MODAL
   ------------------------------------------------------------------------- */
function InsufficientModal({ open, onClose, onBuy, action, currentBalance }) {
  if (!open) return null;
  return (
    <div className="tp-overlay" onClick={onClose}>
      <div className="tp-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="tp-grab"/>
        <div style={{ padding: "24px 20px 28px" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 72, height: 72, margin: "0 auto 16px",
              borderRadius: "50%", background: "var(--error-soft)",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid rgba(248,113,113,0.3)",
            }}>
              <AlertCircle size={36} style={{ color: "var(--error)" }}/>
            </div>
            <div className="tp-serif" style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
              Vous n'avez plus de crédits
            </div>
            <div style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.6, marginBottom: 8, padding: "0 8px" }}>
              Pour pouvoir {action || "continuer"}, vous devez <b style={{ color: "var(--text)" }}>recharger votre compte</b>.
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>
              Solde actuel : <b style={{ color: "var(--error)" }}>{currentBalance ?? 0} crédit</b>
            </div>
          </div>

          {/* Quick packs preview */}
          <div className="tp-card" style={{ padding: 14, background: "var(--surface)", marginBottom: 16 }}>
            <div className="tp-label" style={{ marginBottom: 10, textAlign: "center" }}>Packs disponibles</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {TOKEN_PACKAGES.map(p => (
                <div key={p.id} style={{
                  padding: "10px 8px", background: "var(--surface-2)", borderRadius: 8,
                  textAlign: "center", border: "1px solid var(--border)",
                  position: "relative",
                }}>
                  {p.bestValue && (
                    <div style={{ position: "absolute", top: -6, right: -4, background: "var(--accent)", color: "var(--accent-on)", fontSize: 8, fontWeight: 800, padding: "1px 6px", borderRadius: 6, textTransform: "uppercase" }}>Top</div>
                  )}
                  <div className="tp-serif" style={{ fontSize: 18, fontWeight: 600, color: "var(--accent-ink)" }}>{p.tokens}</div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: -2 }}>crédits</div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{eur(p.priceTTC)}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={onBuy} className="tp-btn tp-btn-primary" style={{ padding: "14px", fontSize: 15 }}>
              <Coins size={16}/> Recharger mes crédits
            </button>
            <button onClick={onClose} className="tp-btn tp-btn-ghost">Plus tard</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   PROFILE SCREEN
   ------------------------------------------------------------------------- */
// ----------------------------------------------------------------------------
// EditProfileModal — édition des champs métier du chauffeur
// ----------------------------------------------------------------------------
// Permet de modifier : nom, téléphone, entreprise, n° VTC, carte pro,
// véhicule, IBAN, n° TVA intra. Le SIRET et l'email ne sont PAS éditables
// ici (le SIRET est unique anti-fraude → demande de re-vérif INSEE ; l'email
// passe par un flow auth séparé).
/* -------------------------------------------------------------------------
   AVATAR PICKER — sélection / remplacement / suppression de la photo
   -------------------------------------------------------------------------
   Affiche l'avatar actuel (ou les initiales) au-dessus du formulaire avec
   2 actions :
     - "Choisir une photo" / "Remplacer" : <input type="file"> caché qui
       déclenche le picker système iOS (Photo Library / Take Photo) ou
       le file picker web sur PC.
     - "Supprimer" : efface l'avatar Storage + remet avatar_url=null.

   Upload immédiat (pas en attente du Save du formulaire) → l'utilisateur
   voit le résultat tout de suite + l'avatar est synchronisé même s'il
   ferme la modale sans enregistrer les autres champs.
   ------------------------------------------------------------------------- */
function AvatarPicker({ currentUser }) {
  const fileInputRef = useRef(null);
  const [localUrl, setLocalUrl] = useState(currentUser?.avatarUrl || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const initials = (currentUser?.name || '?').split(' ').map(w => w[0]).join('').substring(0, 2);

  const onFileChosen = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      const url = await sbUploadAvatar(currentUser.id, file);
      setLocalUrl(url);
      // Mutation locale du currentUser pour refléter l'avatar dans tout
      // l'écran Profil (sans recharger la page). Le prochain loadUserData
      // récupérera l'URL canonique depuis la DB.
      currentUser.avatarUrl = url;
    } catch (err) {
      setError(err?.message || 'Erreur upload');
    } finally {
      setLoading(false);
      // Reset l'input pour permettre de re-sélectionner le même fichier
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onDelete = async () => {
    if (!window.confirm('Supprimer votre photo de profil ?')) return;
    setError('');
    setLoading(true);
    try {
      await sbDeleteAvatar(currentUser.id);
      setLocalUrl(null);
      currentUser.avatarUrl = null;
    } catch (err) {
      setError(err?.message || 'Erreur suppression');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
      {/* Aperçu — photo si dispo, sinon initiales */}
      {localUrl ? (
        <img
          src={localUrl}
          alt="Avatar"
          style={{
            width: 72, height: 72, borderRadius: 18,
            objectFit: 'cover',
            border: '2px solid var(--accent-ring)',
            flexShrink: 0,
          }}
        />
      ) : (
        <div style={{
          width: 72, height: 72, borderRadius: 18,
          background: 'linear-gradient(135deg, var(--accent), #1E40AF)',
          color: 'var(--accent-on)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, fontWeight: 700, fontFamily: "'Fraunces', serif",
          flexShrink: 0,
        }}>
          {initials}
        </div>
      )}

      {/* Actions */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
          Photo de profil (max 2 Mo)
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="tp-btn tp-btn-ghost"
            style={{ fontSize: 12, padding: '6px 10px' }}>
            {loading ? <Loader2 size={12} style={{ animation: 'tp-spin 1s linear infinite' }}/> : <Camera size={12}/>}
            {localUrl ? ' Remplacer' : ' Choisir une photo'}
          </button>
          {localUrl && !loading && (
            <button
              onClick={onDelete}
              className="tp-btn tp-btn-ghost"
              style={{ fontSize: 12, padding: '6px 10px', color: 'var(--error)' }}>
              <Trash2 size={12}/> Supprimer
            </button>
          )}
        </div>
        {error && (
          <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 6 }}>
            <AlertCircle size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}/>
            {error}
          </div>
        )}
      </div>

      {/* Input file caché — accept image/* déclenche le picker système iOS
          (Photo Library / Take Photo / Choose File) sur Capacitor WKWebView */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileChosen}
        style={{ display: 'none' }}
      />
    </div>
  );
}

/* Badge de validation : ✅ vert / ❌ rouge / ⏳ doré (en cours) / rien (idle).
   Utilisé à côté du label SIRET et VTC dans EditProfileModal pour donner
   un retour visuel immédiat pendant la saisie. */
function ValidationBadge({ state }) {
  if (!state || state.status === 'idle') return null;
  if (state.status === 'checking') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--accent-ink)', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>
        <Loader2 size={11} style={{ animation: 'tp-spin 1s linear infinite' }}/> Vérification…
      </span>
    );
  }
  if (state.status === 'valid') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--success)', fontWeight: 700, textTransform: 'none', letterSpacing: 0 }}>
        <CheckCircle2 size={11}/> Vérifié
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--error)', fontWeight: 700, textTransform: 'none', letterSpacing: 0 }}>
      <AlertCircle size={11}/> Invalide
    </span>
  );
}

function EditProfileModal({ open, currentUser, onClose, onSave }) {
  const [form, setForm] = useState({
    name: "", phone: "", email: "", siret: "", companyName: "", evtcNumber: "",
    proCardNumber: "", vehicleModel: "", vehiclePlate: "",
    iban: "", vatIntra: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Message de succès séparé : utilisé quand l'email change a déclenché
  // l'envoi d'un mail de confirmation Supabase (le profil est sauvegardé,
  // mais le nouveau mail n'est validé qu'après clic sur le lien Supabase).
  const [pendingEmailNotice, setPendingEmailNotice] = useState("");
  // Validation automatique SIRET (INSEE) et carte VTC (regex format).
  //   'idle' | 'checking' | 'valid' | 'invalid' (+ reason)
  const [siretValidation, setSiretValidation] = useState({ status: 'idle', reason: '' });
  const [vtcValidation, setVtcValidation] = useState({ status: 'idle', reason: '' });


  // Pré-remplir avec les valeurs actuelles à chaque ouverture
  useEffect(() => {
    if (open && currentUser) {
      setForm({
        name: currentUser.name || "",
        phone: currentUser.phone || "",
        email: currentUser.email || "",
        siret: currentUser.siret || "",
        companyName: currentUser.companyName || "",
        evtcNumber: currentUser.evtcNumber || "",
        proCardNumber: currentUser.proCardNumber || "",
        vehicleModel: currentUser.vehicleModel || "",
        vehiclePlate: currentUser.vehiclePlate || "",
        iban: currentUser.iban || "",
        vatIntra: currentUser.vatIntra || "",
      });
      setError("");
      setPendingEmailNotice("");
      setLoading(false);
      // Init des validations selon le statut connu en base
      setSiretValidation({
        status: currentUser.siretVerified ? 'valid' : 'idle',
        reason: '',
      });
      setVtcValidation({ status: 'idle', reason: '' });
    }
  }, [open, currentUser]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // ─── Validation automatique SIRET (debounced 700ms) ──────────────────
  // Quand l'utilisateur tape ou modifie son SIRET, on attend 700ms après
  // sa dernière frappe puis on appelle l'Edge Function verify-siret
  // (API INSEE). Ça évite de spammer l'API à chaque keystroke.
  useEffect(() => {
    if (!open) return;
    const cleanSiret = form.siret.replace(/\s/g, '');
    if (cleanSiret.length === 0) {
      setSiretValidation({ status: 'idle', reason: '' });
      return;
    }
    if (!/^\d{14}$/.test(cleanSiret)) {
      setSiretValidation({ status: 'invalid', reason: 'Doit contenir exactement 14 chiffres.' });
      return;
    }
    // Si la valeur n'a pas changé depuis le dernier check OK, skip l'appel API
    if (cleanSiret === (currentUser?.siret || '').replace(/\s/g, '') && currentUser?.siretVerified) {
      setSiretValidation({ status: 'valid', reason: '' });
      return;
    }
    setSiretValidation({ status: 'checking', reason: '' });
    const timer = setTimeout(async () => {
      try {
        const result = await sbVerifySiret(cleanSiret);
        if (result?.valid) {
          setSiretValidation({ status: 'valid', reason: '' });
        } else {
          setSiretValidation({
            status: 'invalid',
            reason: result?.reason || "SIRET non reconnu par l'INSEE.",
          });
        }
      } catch (e) {
        setSiretValidation({ status: 'invalid', reason: e?.message || 'Erreur INSEE.' });
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [form.siret, open, currentUser]);

  // ─── Validation automatique carte VTC (permissive) ────────────────────
  // Pas d'API publique pour vérifier qu'un n° VTC existe vraiment dans le
  // registre du Ministère de l'Intérieur. On accepte donc TOUT format
  // tant qu'au moins un caractère est saisi — le chauffeur engage sa
  // responsabilité légale s'il fournit un faux numéro (faux et usage de
  // faux, art. 441-1 CP). La vraie vérif est faite par la Préfecture
  // lors d'un contrôle terrain.
  useEffect(() => {
    if (!open) return;
    const v = form.evtcNumber.trim();
    if (v.length === 0) {
      setVtcValidation({ status: 'idle', reason: '' });
    } else {
      setVtcValidation({ status: 'valid', reason: '' });
    }
  }, [form.evtcNumber, open]);

  const handleSubmit = async () => {
    setError("");
    setPendingEmailNotice("");
    if (!form.name.trim()) { setError("Le nom est requis"); return; }
    if (form.phone.trim() && !isValidPhone(form.phone)) {
      setError("Numéro de téléphone français invalide (ex : +33 6 12 34 56 78)");
      return;
    }
    // Email : format basique. Le vrai check est fait par Supabase Auth.
    const newEmail = form.email.trim().toLowerCase();
    const emailChanged = newEmail && newEmail !== (currentUser?.email || "").toLowerCase();
    if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setError("Format email invalide.");
      return;
    }
    const cleanSiret = form.siret.replace(/\s/g, '');
    if (cleanSiret && !/^\d{14}$/.test(cleanSiret)) {
      setError("SIRET invalide : doit contenir exactement 14 chiffres.");
      return;
    }
    setLoading(true);
    try {
      // 1. Sauvegarder les champs profil "réguliers"
      await onSave({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        siret: cleanSiret || null,
        company_name: form.companyName.trim() || null,
        evtc_number: form.evtcNumber.trim().toUpperCase() || null,
        pro_card_number: form.proCardNumber.trim().toUpperCase() || null,
        vehicle_model: form.vehicleModel.trim() || null,
        vehicle_plate: form.vehiclePlate.trim().toUpperCase() || null,
        iban: form.iban.replace(/\s/g, "").toUpperCase() || null,
        vat_intra: form.vatIntra.trim().toUpperCase() || null,
      });

      // 1bis. Si le SIRET a été validé pendant la saisie (badge vert),
      //       on persiste siret_verified=true via le RPC dédié — comme
      //       ça le statut est conservé après reload.
      if (siretValidation.status === 'valid' && cleanSiret) {
        try {
          await sbMarkSiretVerified(currentUser.id);
        } catch (e) {
          console.warn('[EditProfile] mark_siret_verified failed:', e?.message);
        }
      }

      // 1ter. Carte VTC : marque comme vérifiée dès qu'au moins l'un des
      //       2 champs VTC est renseigné (n° d'inscription VTC OU n° de
      //       carte pro), peu importe le format. La déclaration du
      //       chauffeur engage sa responsabilité légale. Le bandeau de
      //       sécurité en haut du Profil affiche immédiatement la pastille
      //       verte "Carte VTC vérifiée".
      const hasVtcNumber = form.evtcNumber.trim() || form.proCardNumber.trim();
      if (hasVtcNumber && !currentUser.vtcLicenseVerified) {
        try {
          await sbMarkEvtcVerified(currentUser.id);
        } catch (e) {
          console.warn('[EditProfile] mark_evtc_verified failed:', e?.message);
        }
      }

      // 2. Si l'email a changé, déclencher le flow Supabase Auth :
      //    supabase.auth.updateUser envoie automatiquement un mail de
      //    confirmation à la NOUVELLE adresse. L'email n'est mis à jour
      //    dans auth.users qu'après clic sur ce lien.
      if (emailChanged) {
        const { error: emailErr } = await supabase.auth.updateUser({ email: newEmail });
        if (emailErr) {
          // L'erreur la plus fréquente : email déjà utilisé par un autre compte
          throw new Error(`Email : ${emailErr.message}`);
        }
        setPendingEmailNotice(
          `Un email de confirmation a été envoyé à ${newEmail}. ` +
          `Cliquez sur le lien dans ce mail pour valider le changement. ` +
          `En attendant, votre adresse actuelle reste active.`
        );
        setLoading(false);
        // On NE FERME PAS la modale : le user doit voir le message ci-dessus
        return;
      }

      onClose();
    } catch (e) {
      setError(e?.message || "Erreur lors de l'enregistrement");
      setLoading(false);
    }
  };

  if (!open) return null;

  const fieldStyle = { marginBottom: 14 };
  const labelStyle = { fontSize: 11, color: "var(--text-dim)", fontWeight: 600, marginBottom: 6, letterSpacing: "0.5px", textTransform: "uppercase" };

  return (
    <div className="tp-overlay" onClick={onClose}>
      <div className="tp-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>
        <div className="tp-grab"/>
        <div style={{ padding: "16px 20px 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div className="tp-serif" style={{ fontSize: 22, fontWeight: 600 }}>Modifier mes infos</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
                Mettez à jour vos coordonnées pro
              </div>
            </div>
            <button onClick={onClose} className="tp-btn tp-btn-ghost" style={{ padding: 8, borderRadius: 10 }}><X size={18}/></button>
          </div>

          {/* ─── Photo de profil ────────────────────────────────────── */}
          <AvatarPicker currentUser={currentUser}/>

          <div style={fieldStyle}>
            <div style={labelStyle}>Nom complet</div>
            <input className="tp-input" value={form.name} onChange={e => update("name", e.target.value)} placeholder="Jean Dupont"/>
          </div>

          <div style={fieldStyle}>
            <div style={labelStyle}>Téléphone</div>
            <input className="tp-input" value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="+33 6 12 34 56 78"/>
          </div>

          <div style={fieldStyle}>
            <div style={{ ...labelStyle, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>SIRET (14 chiffres)</span>
              <ValidationBadge state={siretValidation}/>
            </div>
            <input
              className="tp-input"
              value={form.siret}
              onChange={e => update("siret", e.target.value.replace(/[^0-9 ]/g, ""))}
              placeholder="ex. 123 456 789 00012"
              inputMode="numeric"
              style={{
                borderColor: siretValidation.status === 'valid' ? "var(--success)" :
                             siretValidation.status === 'invalid' ? "var(--error)" : undefined,
              }}
            />
            {siretValidation.status === 'invalid' && siretValidation.reason && (
              <div style={{ fontSize: 11, color: "var(--error)", marginTop: 4, display: "flex", alignItems: "flex-start", gap: 4 }}>
                <AlertCircle size={11} style={{ flexShrink: 0, marginTop: 1 }}/>
                <span>{siretValidation.reason}</span>
              </div>
            )}
            {siretValidation.status === 'valid' && (
              <div style={{ fontSize: 11, color: "var(--success)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                <CheckCircle2 size={11}/> SIRET vérifié auprès de l'INSEE
              </div>
            )}
          </div>

          <div style={fieldStyle}>
            <div style={labelStyle}>Mon entreprise</div>
            <input className="tp-input" value={form.companyName} onChange={e => update("companyName", e.target.value)} placeholder="ex. Auto-Entrepreneur Dupont"/>
          </div>

          <div style={fieldStyle}>
            <div style={{ ...labelStyle, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>N° d'inscription VTC</span>
              <ValidationBadge state={vtcValidation}/>
            </div>
            <input
              className="tp-input"
              value={form.evtcNumber}
              onChange={e => update("evtcNumber", e.target.value.toUpperCase())}
              placeholder="ex. EVTC084220001"
              style={{
                borderColor: vtcValidation.status === 'valid' ? "var(--success)" :
                             vtcValidation.status === 'invalid' ? "var(--error)" : undefined,
              }}
            />
            {vtcValidation.status === 'invalid' && vtcValidation.reason && (
              <div style={{ fontSize: 11, color: "var(--error)", marginTop: 4, display: "flex", alignItems: "flex-start", gap: 4 }}>
                <AlertCircle size={11} style={{ flexShrink: 0, marginTop: 1 }}/>
                <span>{vtcValidation.reason}</span>
              </div>
            )}
            {vtcValidation.status === 'valid' && (
              <div style={{ fontSize: 11, color: "var(--success)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                <CheckCircle2 size={11}/> Numéro accepté (vérification terrain par la Préfecture)
              </div>
            )}
          </div>

          <div style={fieldStyle}>
            <div style={labelStyle}>Carte professionnelle</div>
            <input className="tp-input" value={form.proCardNumber} onChange={e => update("proCardNumber", e.target.value.toUpperCase())} placeholder="ex. VTC-13-2024-0001"/>
          </div>

          <div style={{ display: "flex", gap: 10, ...fieldStyle }}>
            <div style={{ flex: 2 }}>
              <div style={labelStyle}>Modèle véhicule</div>
              <input className="tp-input" value={form.vehicleModel} onChange={e => update("vehicleModel", e.target.value)} placeholder="ex. Peugeot 508"/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Plaque</div>
              <input className="tp-input" value={form.vehiclePlate} onChange={e => update("vehiclePlate", e.target.value.toUpperCase())} placeholder="ex. AB-123-CD"/>
            </div>
          </div>

          <div style={fieldStyle}>
            <div style={labelStyle}>IBAN (pour les factures)</div>
            <input className="tp-input" value={form.iban} onChange={e => update("iban", e.target.value.toUpperCase())} placeholder="FR76 …"/>
          </div>

          <div style={fieldStyle}>
            <div style={labelStyle}>N° TVA intracommunautaire (optionnel)</div>
            <input className="tp-input" value={form.vatIntra} onChange={e => update("vatIntra", e.target.value.toUpperCase())} placeholder="FR12345678901"/>
          </div>

          <div style={fieldStyle}>
            <div style={labelStyle}>Email</div>
            <input
              className="tp-input"
              type="email"
              autoCapitalize="none"
              autoCorrect="off"
              value={form.email}
              onChange={e => update("email", e.target.value.trim().toLowerCase())}
              placeholder="vous@exemple.com"
            />
            <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 6, lineHeight: 1.4 }}>
              <Info size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 4, color: "var(--accent-ink)" }}/>
              Si vous changez d'email, un lien de confirmation sera envoyé à la
              <b> nouvelle adresse</b>. Le changement est effectif uniquement
              après clic sur ce lien.
            </div>
          </div>

          {pendingEmailNotice && (
            <div className="tp-card" style={{ padding: 10, marginBottom: 14, background: "var(--success-soft)", borderColor: "rgba(74,222,128,0.3)", fontSize: 12, color: "var(--success)", display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.5 }}>
              <Mail size={14} style={{ flexShrink: 0, marginTop: 1 }}/>
              <span>{pendingEmailNotice}</span>
            </div>
          )}

          {error && (
            <div className="tp-card" style={{ padding: 10, marginBottom: 14, background: "var(--error-soft)", borderColor: "rgba(248,113,113,0.3)", fontSize: 12, color: "var(--error)", display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.5 }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }}/>
              <span>{error}</span>
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading} className="tp-btn tp-btn-primary" style={{ width: "100%", padding: 14, fontSize: 15 }}>
            {loading
              ? <><Loader2 size={16} style={{ animation: "tp-spin 1s linear infinite" }}/> Enregistrement…</>
              : <><Check size={16}/> Enregistrer les modifications</>}
          </button>
        </div>
      </div>
    </div>
  );
}


function ProfileScreen({ onGoTab, tokenBalance, currentUser, isGuest, onLogout, onPromptSignup, onEditProfile, biometricEnabled = false }) {
  const lowTokens = tokenBalance <= 3;
  const displayName = currentUser?.name || `${DRIVER_PROFILE.firstName} ${DRIVER_PROFILE.lastName}`;
  const displayEmail = currentUser?.email || DRIVER_PROFILE.email;
  // Lit les valeurs du profil DB (currentUser).
  //   - Mode invité  : fallback sur DRIVER_PROFILE (valeurs démo lisibles).
  //   - Mode connecté : "À remplir" en italique gris pour les champs vides,
  //     pour que l'utilisateur sache qu'il doit les compléter via le bouton
  //     "Modifier mes informations" (et pas voir des fausses données).
  const placeholder = "À remplir";
  const has = (v) => v && String(v).trim().length > 0;
  const fld = (val, demoFallback) => {
    if (has(val)) return { value: val, isPlaceholder: false };
    if (isGuest) return { value: demoFallback, isPlaceholder: false };
    return { value: placeholder, isPlaceholder: true };
  };
  // Véhicule = combo modèle + plaque, à remplir si AU MOINS un des 2 manque
  const vehicleField = (() => {
    const m = currentUser?.vehicleModel;
    const p = currentUser?.vehiclePlate;
    if (has(m) && has(p)) return { value: `${m} · ${p}`, isPlaceholder: false };
    if (isGuest) return { value: `${DRIVER_PROFILE.vehicleModel} · ${DRIVER_PROFILE.vehiclePlate}`, isPlaceholder: false };
    return { value: placeholder, isPlaceholder: true };
  })();
  const items = [
    { icon: Building2, label: "Mon entreprise", ...fld(currentUser?.companyName, DRIVER_PROFILE.companyName) },
    // SIRET : toujours rempli (validé INSEE au signup), pas de cas vide
    { icon: FileCheck, label: "N° SIRET", value: currentUser?.siret || DRIVER_PROFILE.siret, isPlaceholder: false },
    { icon: Shield, label: "Inscription VTC", ...fld(currentUser?.evtcNumber, DRIVER_PROFILE.vtcNumber) },
    { icon: CreditCard, label: "Carte pro.", ...fld(currentUser?.proCardNumber, DRIVER_PROFILE.proCardNumber) },
    { icon: Car, label: "Véhicule", ...vehicleField },
    { icon: Phone, label: "Téléphone", ...fld(currentUser?.phone, DRIVER_PROFILE.phone) },
    // Email : géré par auth, jamais vide pour un compte
    { icon: Mail, label: "Email", value: displayEmail, isPlaceholder: false },
  ];

  return (
    <div className="tp-scroll tp-fade-in">
      <TopBar title="Mon profil" subtitle={isGuest ? "Mode invité" : "Informations légales et contact"}/>

      {isGuest && (
        <div style={{ padding: "0 20px 16px" }}>
          <div className="tp-card" style={{ padding: 14, background: "var(--warn-soft)", borderColor: "rgba(251,191,36,0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <AlertCircle size={16} style={{ color: "var(--warn)", flexShrink: 0 }}/>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--warn)" }}>Vous utilisez le mode invité</div>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5, marginBottom: 10 }}>
              Sans compte, vos courses, factures et crédits ne sont pas sauvegardés. Ils seront perdus si vous changez de téléphone.
            </div>
            <button onClick={onPromptSignup} className="tp-btn tp-btn-primary" style={{ width: "100%", padding: 10, fontSize: 13 }}>
              <UserPlus size={14}/> Créer un compte gratuit
            </button>
          </div>
        </div>
      )}

      <div style={{ padding: "0 20px 16px" }}>
        <div className="tp-card-elevated" style={{ padding: 20, display: "flex", alignItems: "center", gap: 14 }}>
          {/* Avatar : photo si avatarUrl, sinon initiales en fallback.
              On utilise un cercle 60×60 avec object-fit:cover pour cropper
              proprement les photos non-carrées. La bordure dorée subtile
              donne un cadre premium sans éclipser la photo. */}
          {currentUser?.avatarUrl ? (
            <img
              src={currentUser.avatarUrl}
              alt={displayName}
              style={{
                width: 60, height: 60, borderRadius: 16,
                objectFit: "cover",
                border: "1.5px solid var(--accent-ring)",
                flexShrink: 0,
              }}
            />
          ) : (
            <div style={{
              width: 60, height: 60, borderRadius: 16,
              background: "linear-gradient(135deg, var(--accent), #1E40AF)",
              color: "var(--accent-on)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 700, fontFamily: "'Fraunces', serif",
              flexShrink: 0,
            }}>
              {displayName.split(" ").map(w => w[0]).join("").substring(0,2)}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="tp-serif" style={{ fontSize: 18, fontWeight: 600 }}>{displayName}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{isGuest ? "Invité" : displayEmail}</div>
            {!isGuest && (() => {
              // Compte considéré "vérifié" UNIQUEMENT si les 3 vérifs
              // métier sont OK : email + SIRET + carte VTC. L'appareil
              // (device fingerprint) est optionnel — il n'engage pas
              // la responsabilité légale du chauffeur. Si l'une des 3
              // manque, on affiche "Non vérifié" en orange pour inviter
              // l'utilisateur à compléter son profil.
              const fullyVerified =
                currentUser?.emailVerified &&
                currentUser?.siretVerified &&
                currentUser?.vtcLicenseVerified;
              return fullyVerified ? (
                <div className="tp-chip tp-chip-success" style={{ marginTop: 6 }}>
                  <ShieldCheck size={10}/> Compte vérifié
                </div>
              ) : (
                <div className="tp-chip tp-chip-warn" style={{ marginTop: 6 }}>
                  <AlertCircle size={10}/> Compte non vérifié
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Verification badges card - shows anti-fraud verifications */}
      {!isGuest && currentUser && (
        <div style={{ padding: "0 20px 16px" }}>
          <div className="tp-card" style={{ padding: 14, background: "var(--surface)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <ShieldCheck size={14} style={{ color: "var(--success)" }}/>
              <div className="tp-label">Vérifications de sécurité</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { icon: Mail, label: "Email", verified: currentUser.emailVerified },
                { icon: Building2, label: "SIRET", verified: currentUser.siretVerified },
                { icon: Fingerprint, label: "Appareil", verified: !!currentUser.deviceFingerprint },
                { icon: Shield, label: "Carte VTC", verified: currentUser.vtcLicenseVerified },
              ].map(v => (
                <div key={v.label} style={{
                  padding: "8px 10px", borderRadius: 8,
                  background: v.verified ? "var(--success-soft)" : "var(--surface-2)",
                  border: `1px solid ${v.verified ? "rgba(74,222,128,0.25)" : "var(--border)"}`,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <v.icon size={13} style={{ color: v.verified ? "var(--success)" : "var(--muted)", flexShrink: 0 }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: v.verified ? "var(--text)" : "var(--text-dim)" }}>{v.label}</div>
                    <div style={{ fontSize: 9, color: v.verified ? "var(--success)" : "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700 }}>
                      {v.verified ? "✓ Vérifié" : "Non vérifié"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 10, lineHeight: 1.5, display: "flex", gap: 6, alignItems: "flex-start" }}>
              <Info size={11} style={{ flexShrink: 0, marginTop: 1, color: "var(--muted)" }}/>
              <span>Ces vérifications garantissent l'unicité de votre compte et empêchent la fraude. Un seul compte est autorisé par personne.</span>
            </div>
          </div>
        </div>
      )}

      {/* Tokens management card - prominent */}
      <div style={{ padding: "0 20px 10px" }}>
        <button onClick={() => onGoTab("tokens")} className="tp-card-elevated" style={{
          width: "100%", padding: 16, display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
          background: lowTokens
            ? "linear-gradient(135deg, rgba(248,113,113,0.12), rgba(248,113,113,0.02))"
            : "linear-gradient(135deg, rgba(37,99,235,0.12), rgba(37,99,235,0.02))",
          borderColor: lowTokens ? "rgba(248,113,113,0.3)" : "var(--accent-ring)",
          textAlign: "left",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: lowTokens ? "var(--error)" : "var(--accent)",
            color: "var(--accent-on)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Wallet size={22}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Gérer mes jetons</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
              <span className="tp-serif" style={{ fontSize: 18, fontWeight: 700, color: lowTokens ? "var(--error)" : "var(--accent-ink)" }}>
                {tokenBalance}
              </span>
              <span>crédit{tokenBalance > 1 ? "s" : ""} disponible{tokenBalance > 1 ? "s" : ""}</span>
              {lowTokens && <span className="tp-chip tp-chip-error" style={{ fontSize: 9, padding: "1px 6px", marginLeft: 4 }}>Bas</span>}
            </div>
          </div>
          <ChevronRight size={18} style={{ color: "var(--muted)", flexShrink: 0 }}/>
        </button>
      </div>

      {/* Referral card - only for logged in users */}
      {!isGuest && currentUser && (
        <div style={{ padding: "0 20px 16px" }}>
          <button onClick={() => onGoTab("referral")} className="tp-card" style={{
            width: "100%", padding: 14, display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
            background: "var(--surface)", textAlign: "left",
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "var(--accent-soft)", color: "var(--accent-ink)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <HandCoins size={18}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                Parrainage
                <span className="tp-chip tp-chip-accent" style={{ fontSize: 9, padding: "1px 6px" }}>+{REFERRAL_BONUS_REFERRER} crédits</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2, fontFamily: "monospace" }}>
                Code : <b style={{ color: "var(--text)" }}>{currentUser.referralCode}</b>
              </div>
            </div>
            <ChevronRight size={14} style={{ color: "var(--muted)" }}/>
          </button>
        </div>
      )}

      {!isGuest && onEditProfile && (
        <div style={{ padding: "0 20px 12px" }}>
          <button onClick={onEditProfile} className="tp-btn tp-btn-ghost"
            style={{ width: "100%", padding: 12, fontSize: 13, fontWeight: 600, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Edit3 size={14}/> Modifier mes informations
          </button>
        </div>
      )}

      <div style={{ padding: "0 20px" }}>
        <div className="tp-card" style={{ background: "var(--surface)" }}>
          {items.map((it, i) => (
            <div key={it.label} style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: i < items.length-1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--surface-2)", color: "var(--accent-ink)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <it.icon size={15}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{it.label}</div>
                <div style={{
                  fontSize: 13,
                  fontWeight: it.isPlaceholder ? 400 : 600,
                  fontStyle: it.isPlaceholder ? "italic" : "normal",
                  color: it.isPlaceholder ? "var(--text-dim)" : "var(--text)",
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {it.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 20px 0" }}>
        <div className="tp-label" style={{ marginBottom: 8 }}>Paramètres</div>
        <div className="tp-card" style={{ background: "var(--surface)" }}>
          {[
            { icon: Settings, label: "Préférences", onClick: () => onGoTab("settings") },
            {
              icon: Fingerprint,
              label: "Identification biométrique",
              onClick: () => onGoTab("settings"),
              right: biometricEnabled
                ? <span className="tp-chip tp-chip-success">Activée</span>
                : <span className="tp-chip" style={{ background: "var(--surface-3)", color: "var(--text-dim)", fontSize: 10 }}>Désactivée</span>,
            },
            { icon: FileText, label: "Conditions générales", onClick: () => onGoTab("terms") },
            { icon: HelpCircle, label: "Aide et support", onClick: () => onGoTab("help") },
            { icon: LogOut, label: isGuest ? "Créer un compte" : "Déconnexion", danger: !isGuest, accent: isGuest, onClick: onLogout },
          ].map((it, i, arr) => (
            <button key={it.label} onClick={it.onClick} style={{
              width: "100%", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
              borderBottom: i < arr.length-1 ? "1px solid var(--border)" : "none",
              background: "none", border: "none", borderRadius: 0, cursor: "pointer", textAlign: "left",
              color: it.danger ? "var(--error)" : it.accent ? "var(--accent)" : "var(--text)",
            }}>
              <it.icon size={16} style={{ color: it.danger ? "var(--error)" : it.accent ? "var(--accent)" : "var(--text-dim)", flexShrink: 0 }}/>
              <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{it.label}</span>
              {it.right || <ChevronRight size={14} style={{ color: "var(--muted)" }}/>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "24px 20px 0", textAlign: "center", fontSize: 10, color: "var(--muted)" }}>
        TrajetPro · v1.0.0 · Conforme au décret 2017-483
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   AUTH SCREENS — Welcome / Login / Signup / Device Blocked
   ------------------------------------------------------------------------- */
function AuthScreens({ mode, onChangeMode, onLogin, onSignup, onGuest, onDeviceAlreadyUsed, blockedAccountInfo }) {
  if (mode === "welcome") return <WelcomeScreen onChangeMode={onChangeMode} onGuest={onGuest}/>;
  if (mode === "login") return <LoginScreen onChangeMode={onChangeMode} onLogin={onLogin}/>;
  if (mode === "signup") return <SignupScreen onChangeMode={onChangeMode} onSignup={onSignup} onDeviceAlreadyUsed={onDeviceAlreadyUsed}/>;
  if (mode === "device_blocked") return <DeviceBlockedScreen onChangeMode={onChangeMode} info={blockedAccountInfo}/>;
  return null;
}

function DeviceBlockedScreen({ onChangeMode, info }) {
  return (
    <div className="tp-scroll tp-fade-in" style={{ minHeight: "100dvh", padding: "24px", display: "flex", flexDirection: "column" }}>
      <button onClick={() => onChangeMode("welcome")} className="tp-btn tp-btn-ghost" style={{ padding: 10, borderRadius: 10, marginBottom: 16, alignSelf: "flex-start" }}>
        <ChevronLeft size={18}/>
      </button>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "20px 0" }}>
        <div style={{
          width: 84, height: 84, marginBottom: 20,
          borderRadius: 22, background: "var(--error-soft)",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "2px solid rgba(248,113,113,0.3)",
        }}>
          <ShieldCheck size={40} style={{ color: "var(--error)" }}/>
        </div>

        <div className="tp-serif" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.2, marginBottom: 10 }}>
          Cet appareil est déjà associé à un compte
        </div>

        <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6, maxWidth: 340, marginBottom: 24 }}>
          Pour éviter les abus, <b style={{ color: "var(--text)" }}>un seul compte TrajetPro par appareil</b> est autorisé.
          Si c'est votre compte, connectez-vous plutôt que d'en créer un nouveau.
        </div>

        <div className="tp-card" style={{ padding: 14, background: "var(--surface)", width: "100%", maxWidth: 340, textAlign: "left", marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Détails techniques
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.8 }}>
            <div style={{ color: "var(--text-dim)" }}>Compte associé : <b style={{ color: "var(--text)" }}>••••{(info?.accountId || "").slice(-4) || "XXXX"}</b></div>
            <div style={{ color: "var(--text-dim)" }}>Enregistré le : <b style={{ color: "var(--text)" }}>{info?.firstSeen ? formatDate(info.firstSeen.slice(0,10)) : "—"}</b></div>
          </div>
        </div>

        <div className="tp-card" style={{ padding: 12, background: "var(--warn-soft)", borderColor: "rgba(251,191,36,0.3)", width: "100%", maxWidth: 340, textAlign: "left", marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6 }}>
            <b style={{ color: "var(--warn)" }}>Vous partagez votre téléphone ?</b> Contactez le support pour autoriser un second compte sur cet appareil.
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={() => onChangeMode("login")} className="tp-btn tp-btn-primary" style={{ padding: "14px", fontSize: 15 }}>
          <LogIn size={16}/> Me connecter à mon compte
        </button>
        <button onClick={() => onChangeMode("welcome")} className="tp-btn tp-btn-ghost" style={{ padding: "12px" }}>
          Retour
        </button>
        <a href="mailto:contact@trajetpro.fr" style={{
          textAlign: "center", fontSize: 12, color: "var(--accent-ink)",
          padding: 12, textDecoration: "none", fontWeight: 600,
        }}>
          Contacter le support
        </a>
      </div>
    </div>
  );
}

// Logo de marque TrajetPro : monogramme « V » formé par un trajet (points
// départ/arrivée), fond dégradé bleu. SVG autoportant (fond arrondi inclus),
// dimensionnable via `size`. Source : logo-5-monogramme-v-bleu.svg.
function AppLogo({ size = 80 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="TrajetPro">
      <defs>
        <linearGradient id="tp-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2563EB"/>
          <stop offset="1" stopColor="#0B3AA8"/>
        </linearGradient>
        <linearGradient id="tp-logo-v" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF"/>
          <stop offset="1" stopColor="#CFE0FF"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#tp-logo-bg)"/>
      <path d="M150 150L256 372L362 150" fill="none" stroke="url(#tp-logo-v)" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="150" cy="150" r="26" fill="url(#tp-logo-v)"/>
      <circle cx="150" cy="150" r="11" fill="#0B3AA8"/>
      <circle cx="362" cy="150" r="18" fill="url(#tp-logo-v)"/>
    </svg>
  );
}

function WelcomeScreen({ onChangeMode, onGuest }) {
  return (
    <div className="tp-scroll tp-fade-in" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", padding: "40px 24px" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
        {/* Logo */}
        <div style={{ marginBottom: 28, borderRadius: 22, filter: "drop-shadow(0 16px 40px rgba(37,99,235,0.45))" }}>
          <AppLogo size={80}/>
        </div>

        <div className="tp-serif" style={{ fontSize: 42, fontWeight: 600, lineHeight: 1.05, marginBottom: 8 }}>
          TrajetPro
        </div>
        <div style={{ fontSize: 14, color: "var(--text-dim)", maxWidth: 300, lineHeight: 1.6, marginBottom: 40 }}>
          L'application de bons de course et facturation pour les VTC indépendants.
        </div>

        {/* Features bullets */}
        <div style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 10, marginBottom: 36 }}>
          {[
            { icon: Mic, text: "Dictée vocale intelligente" },
            { icon: Shield, text: "Conforme décret 2017-483" },
            { icon: Gift, text: "5 crédits offerts à l'inscription" },
          ].map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: "var(--accent-soft)", color: "var(--accent-ink)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <f.icon size={14}/>
              </div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{f.text}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={() => onChangeMode("signup")} className="tp-btn tp-btn-primary" style={{ padding: "16px", fontSize: 15 }}>
          <UserPlus size={18}/> Créer un compte
        </button>
        <button onClick={() => onChangeMode("login")} className="tp-btn tp-btn-ghost" style={{ padding: "14px" }}>
          <LogIn size={16}/> J'ai déjà un compte
        </button>
        <button onClick={onGuest} style={{
          background: "none", border: "none", color: "var(--text-dim)",
          fontSize: 12, padding: "12px", cursor: "pointer", fontWeight: 500,
        }}>
          Continuer sans compte
        </button>
        <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", marginTop: 4, lineHeight: 1.5 }}>
          En continuant, vous acceptez nos CGU<br/>et notre politique de confidentialité.
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   NOUVEAU MOT DE PASSE — écran affiché au retour du lien de réinitialisation
   ------------------------------------------------------------------------- */
function NewPasswordScreen({ onDone }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    if (pw.length < 8) { setError("8 caractères minimum."); return; }
    if (pw !== pw2) { setError("Les deux mots de passe ne correspondent pas."); return; }
    setLoading(true);
    try {
      // Même contrôle qu'à l'inscription : refus des mots de passe déjà
      // présents dans des fuites publiques (HaveIBeenPwned, k-anonymity).
      if (await isPasswordPwned(pw)) {
        setError("Ce mot de passe apparaît dans des fuites de données connues. Choisissez-en un autre.");
        setLoading(false);
        return;
      }
      await sbUpdatePassword(pw);
      onDone();
    } catch (err) {
      setError(err?.message || "Impossible de mettre à jour le mot de passe.");
      setLoading(false);
    }
  };

  return (
    <div className="tp-scroll tp-fade-in" style={{ minHeight: "100dvh", padding: "24px" }}>
      <div style={{ marginBottom: 28 }}>
        <div className="tp-serif" style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.1 }}>Nouveau mot de passe</div>
        <div style={{ fontSize: 14, color: "var(--text-dim)", marginTop: 8, lineHeight: 1.5 }}>
          Choisissez un nouveau mot de passe pour votre compte TrajetPro.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div className="tp-label" style={{ marginBottom: 6 }}>Nouveau mot de passe</div>
          <div style={{ position: "relative" }}>
            <Lock size={16} style={{ position: "absolute", left: 14, top: 14, color: "var(--muted)" }}/>
            <input className="tp-input" type={showPw ? "text" : "password"} style={{ paddingLeft: 38, paddingRight: 44 }}
              placeholder="••••••••" value={pw} onChange={e => setPw(e.target.value)}/>
            <button onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 8, top: 8, background: "none", border: "none", cursor: "pointer", padding: 6, color: "var(--muted)" }}>
              {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
            </button>
          </div>
        </div>

        <div>
          <div className="tp-label" style={{ marginBottom: 6 }}>Confirmer</div>
          <div style={{ position: "relative" }}>
            <Lock size={16} style={{ position: "absolute", left: 14, top: 14, color: "var(--muted)" }}/>
            <input className="tp-input" type={showPw ? "text" : "password"} style={{ paddingLeft: 38 }}
              placeholder="••••••••" value={pw2} onChange={e => setPw2(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}/>
          </div>
        </div>

        {error && (
          <div className="tp-card" style={{ padding: 10, background: "var(--error-soft)", borderColor: "rgba(248,113,113,0.3)", fontSize: 12, color: "var(--error)", display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.5 }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }}/>
            <span>{error}</span>
          </div>
        )}

        <button onClick={submit} disabled={loading} className="tp-btn tp-btn-primary" style={{ width: "100%", padding: 14, fontSize: 15 }}>
          {loading
            ? <><Loader2 size={16} style={{ animation: "tp-spin 1s linear infinite" }}/> Enregistrement…</>
            : <><Check size={16}/> Valider</>}
        </button>
      </div>
    </div>
  );
}

function LoginScreen({ onChangeMode, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Réinitialisation du mot de passe : "idle" | "sending" | "sent"
  const [resetState, setResetState] = useState("idle");

  const requestPasswordReset = async () => {
    const target = email.trim().toLowerCase();
    if (!target) {
      setError("Saisissez d'abord votre email ci-dessus, puis retouchez « Mot de passe oublié ? ».");
      return;
    }
    setError("");
    setResetState("sending");
    try {
      await sbResetPassword(target);
      // On affiche le même message que l'email existe ou non : ne jamais
      // révéler si une adresse est inscrite (énumération de comptes).
      setResetState("sent");
    } catch (err) {
      setResetState("idle");
      setError(err?.message || "Envoi impossible. Vérifiez votre connexion.");
    }
  };

  const submit = async () => {
    setError("");
    if (!email || !password) { setError("Email et mot de passe requis"); return; }
    setLoading(true);
    try {
      // Connexion via Supabase Auth
      const { user } = await sbSignIn(email.trim().toLowerCase(), password);
      if (!user) {
        throw new Error("Connexion impossible");
      }
      // onLogin va déclencher useEffect qui charge le profil + données depuis Supabase
      onLogin({ id: user.id, email: user.email });
    } catch (err) {
      const msg = err?.message || "";
      if (/invalid login credentials/i.test(msg)) {
        setError("Email ou mot de passe incorrect");
      } else if (/email not confirmed/i.test(msg)) {
        setError("Vous devez d'abord confirmer votre email (lien envoyé à l'inscription)");
      } else {
        setError(msg || "Erreur de connexion");
      }
      setLoading(false);
    }
  };

  return (
    <div className="tp-scroll tp-fade-in" style={{ minHeight: "100dvh", padding: "24px" }}>
      <button onClick={() => onChangeMode("welcome")} className="tp-btn tp-btn-ghost" style={{ padding: 10, borderRadius: 10, marginBottom: 16 }}>
        <ChevronLeft size={18}/>
      </button>

      <div style={{ marginBottom: 32 }}>
        <div className="tp-serif" style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.1 }}>Bon retour</div>
        <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6 }}>Connectez-vous pour retrouver vos données et crédits.</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div className="tp-label" style={{ marginBottom: 6 }}>Email</div>
          <div style={{ position: "relative" }}>
            <Mail size={16} style={{ position: "absolute", left: 14, top: 14, color: "var(--muted)" }}/>
            <input className="tp-input" type="email" style={{ paddingLeft: 38 }}
              placeholder="vous@email.com" value={email} onChange={e => setEmail(e.target.value)}/>
          </div>
        </div>

        <div>
          <div className="tp-label" style={{ marginBottom: 6 }}>Mot de passe</div>
          <div style={{ position: "relative" }}>
            <Lock size={16} style={{ position: "absolute", left: 14, top: 14, color: "var(--muted)" }}/>
            <input className="tp-input" type={showPw ? "text" : "password"} style={{ paddingLeft: 38, paddingRight: 44 }}
              placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}/>
            <button onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 8, top: 8, background: "none", border: "none", cursor: "pointer", padding: 6, color: "var(--muted)" }}>
              {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
            </button>
          </div>
        </div>

        {resetState === "sent" ? (
          <div className="tp-card" style={{ padding: 12, background: "var(--success-soft, rgba(18,183,106,0.10))", borderColor: "rgba(18,183,106,0.3)", fontSize: 12, color: "var(--text)", display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.5 }}>
            <Check size={14} style={{ flexShrink: 0, marginTop: 1, color: "var(--success, #12B76A)" }}/>
            <span>
              Si un compte existe pour <b>{email.trim().toLowerCase()}</b>, un lien de
              réinitialisation vient d'être envoyé. Pensez à vérifier vos spams.
            </span>
          </div>
        ) : (
          <button
            onClick={requestPasswordReset}
            disabled={resetState === "sending"}
            style={{ fontSize: 12, color: "var(--accent-ink)", background: "none", border: "none", cursor: "pointer", textAlign: "right", fontWeight: 600, padding: "4px 2px" }}>
            {resetState === "sending" ? "Envoi…" : "Mot de passe oublié ?"}
          </button>
        )}

        {error && (
          <div className="tp-card" style={{ padding: 10, background: "var(--error-soft)", borderColor: "rgba(248,113,113,0.3)", fontSize: 12, color: "var(--error)", display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.5 }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }}/>
            <span>{error}</span>
          </div>
        )}

        <button onClick={submit} disabled={loading} className="tp-btn tp-btn-primary" style={{ padding: "14px", fontSize: 15, marginTop: 6 }}>
          {loading ? <><Loader2 size={16} style={{ animation: "tp-spin 1s linear infinite" }}/> Connexion...</> : <><LogIn size={16}/> Se connecter</>}
        </button>

        {/* ─── Séparateur "ou" + Sign in with Apple ─────────────────────
            Apple App Store règle 4.8 oblige à proposer Sign in with Apple
            si on offre déjà email/password. Style proche du bouton Apple
            officiel (noir, logo Apple, "Continuer avec Apple"). */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }}/>
          <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500 }}>OU</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }}/>
        </div>

        <button onClick={async () => {
          try {
            await sbSignInWithApple();
            // Redirect géré par Supabase OAuth flow — pas de code après ce point.
          } catch (err) {
            setError("Sign in with Apple échoué : " + (err?.message || err));
          }
        }} className="tp-btn" style={{
          padding: "14px", fontSize: 15, background: "#000", color: "#fff",
          border: "1px solid #000", display: "flex", alignItems: "center",
          justifyContent: "center", gap: 8,
        }}>
          <svg width="16" height="16" viewBox="0 0 384 512" fill="currentColor">
            <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
          </svg>
          Continuer avec Apple
        </button>

        <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-dim)", marginTop: 12 }}>
          Pas encore de compte ?{" "}
          <button onClick={() => onChangeMode("signup")} style={{ color: "var(--accent-ink)", background: "none", border: "none", cursor: "pointer", fontWeight: 700, padding: 0 }}>
            S'inscrire
          </button>
        </div>
      </div>
    </div>
  );
}

function SignupScreen({ onChangeMode, onSignup, onDeviceAlreadyUsed }) {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", siret: "", password: "", referralCode: "", acceptTerms: false,
  });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("form"); // "form" | "email_sent"
  const [pendingUser, setPendingUser] = useState(null);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Validation SIRET (14 chiffres)
  const isValidSiret = (siret) => {
    const clean = (siret || "").replace(/\s/g, "");
    return /^\d{14}$/.test(clean);
  };

  // Validation téléphone français (facultatif — utilisé pour les factures).
  // Accepte tous les séparateurs courants (espaces, points, tirets,
  // parenthèses, slashes) et les préfixes +33, 0033 ou 0.
  const isValidPhone = (phone) => {
    if (!phone) return true; // Facultatif
    // On garde uniquement les chiffres et le "+" en tête
    const clean = phone.replace(/[^\d+]/g, "");
    return /^(?:\+33|0033|0)[1-9]\d{8}$/.test(clean);
  };

  const handleInitialSubmit = async () => {
    setError("");
    if (!form.name) { setError("Votre nom est requis"); return; }
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) { setError("Email invalide"); return; }

    // Bloquer les emails jetables (anti-fraude n°1 sans SMS) — vérification serveur
    try {
      const blocked = await sbIsDisposableEmail(form.email);
      if (blocked) {
        setError("Les emails jetables ne sont pas autorisés. Utilisez votre email professionnel.");
        return;
      }
    } catch (e) {
      // En cas d'erreur réseau, on tombe sur la liste locale (sécurité défensive)
      if (isDisposableEmail(form.email)) {
        setError("Les emails jetables ne sont pas autorisés. Utilisez votre email professionnel.");
        return;
      }
    }

    if (form.phone && !isValidPhone(form.phone)) {
      setError("Numéro de téléphone français invalide (ex : +33 6 12 34 56 78)");
      return;
    }
    if (!isValidSiret(form.siret)) { setError("SIRET invalide (14 chiffres)"); return; }

    // Sécurité du mot de passe : check local (longueur + blacklist) + HIBP
    // (équivalent gratuit du Leaked Password Protection de Supabase Pro).
    const strength = checkPasswordStrength(form.password);
    if (!strength.ok) { setError(strength.reason); return; }

    if (!form.acceptTerms) { setError("Vous devez accepter les CGU"); return; }

    // ANTI-FRAUDE local (device) : même appareil déjà utilisé ?
    const fingerprint = generateDeviceFingerprint();
    const deviceRecord = KNOWN_DEVICES.get(fingerprint);
    if (deviceRecord && deviceRecord.accountsCount >= FRAUD_THRESHOLDS.maxAccountsPerDevice) {
      onDeviceAlreadyUsed(deviceRecord);
      return;
    }

    setLoading(true);
    try {
      // HaveIBeenPwned k-anonymity : on garde le check pour informer
      // l'utilisateur si son mot de passe a déjà fuité dans une autre app
      // (LinkedIn 2012, Adobe 2013…), mais on ne BLOQUE PLUS l'inscription.
      // L'utilisateur reste libre de réutiliser un mot de passe qu'il
      // connaît, et la sécurité de son compte TrajetPro reste assurée par :
      //   - bcrypt côté Supabase Auth
      //   - vérification email obligatoire
      //   - empreinte d'appareil anti-fraude
      //   - HTTPS partout
      // Le warning est juste un avertissement console + log analytics.
      try {
        const pwned = await isPasswordPwned(form.password);
        if (pwned) {
          console.warn(
            "[signup] Le mot de passe choisi figure dans une fuite HIBP. " +
            "L'inscription est autorisée mais l'utilisateur devrait changer ce " +
            "mot de passe sur les autres sites où il l'utilise.",
          );
        }
      } catch (_) { /* HIBP indisponible : on ignore, fail-open */ }

      // Vérification SIRET via Edge Function (déjà déployée — Phase 3)
      // On bloque les SIRETs invalides ou non-VTC
      const siretCheck = await sbVerifySiret(form.siret.replace(/\s/g, ""));
      if (!siretCheck?.valid) {
        const reason = siretCheck?.reason || "SIRET introuvable ou activité non éligible (VTC)";
        setError(`SIRET invalide : ${reason}`);
        setLoading(false);
        return;
      }

      // Si un code de parrainage est fourni, on vérifie qu'il existe
      let referrerInfo = null;
      const refCode = form.referralCode.trim();
      if (refCode) {
        referrerInfo = await findUserByReferralCode(refCode);
        if (!referrerInfo) {
          setError(`Code de parrainage "${refCode}" inconnu.`);
          setLoading(false);
          return;
        }
      }

      // Création du compte via Supabase Auth.
      // Le trigger SQL `handle_new_auth_user` (déployé) crée auto le profil
      // dans public.users + transaction 'welcome' (+5 crédits) — SAUF si
      // ce device a déjà reçu un bonus welcome via un compte précédent ou
      // un mode invité épuisé. Le device_fingerprint est passé en metadata
      // pour que le trigger SQL fasse le contrôle anti-double-bonus.
      await sbSignUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        name: form.name,
        phone: form.phone || null,
        siret: form.siret.replace(/\s/g, ""),
        referredBy: refCode || null,
        deviceFingerprint: fingerprint,
      });

      // Marquer cet appareil comme utilisé (anti-fraude local)
      KNOWN_DEVICES.set(fingerprint, {
        accountId: form.email,
        firstSeen: new Date().toISOString(),
        accountsCount: (KNOWN_DEVICES.get(fingerprint)?.accountsCount || 0) + 1,
      });

      setPendingUser({
        email: form.email,
        name: form.name,
        usedReferralCode: !!refCode,
        referrerName: referrerInfo?.name || null,
      });
      setStep("email_sent");
    } catch (err) {
      const msg = err?.message || "Erreur d'inscription";
      if (/already registered|already exists|user already/i.test(msg)) {
        setError("Un compte existe déjà pour cet email. Essayez de vous connecter.");
      } else if (/password/i.test(msg) && /6|short|weak/i.test(msg)) {
        setError("Mot de passe trop faible (8 caractères minimum)");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // L'utilisateur a vu l'email envoyé : on le redirige vers l'écran de login.
  // Quand il se connectera (après avoir cliqué sur le lien Supabase),
  // le useEffect d'auth state du composant App chargera son profil et
  // créditera le bonus de parrainage si nécessaire.
  const handleValidateEmail = () => {
    onChangeMode("login");
  };

  const hasReferralCode = form.referralCode.trim().length >= 4;

  // === VUE : Email envoyé, en attente de validation ===
  if (step === "email_sent") {
    return (
      <div className="tp-scroll tp-fade-in" style={{ minHeight: "100dvh", padding: "24px" }}>
        <button onClick={() => setStep("form")} className="tp-btn tp-btn-ghost" style={{ padding: 10, borderRadius: 10, marginBottom: 16 }}>
          <ChevronLeft size={18}/>
        </button>

        <div style={{ textAlign: "center", padding: "20px 0 32px" }}>
          <div style={{
            width: 80, height: 80, margin: "0 auto 20px",
            borderRadius: 22, background: "var(--accent-soft)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid var(--accent-ring)",
          }}>
            <Mail size={38} style={{ color: "var(--accent-ink)" }}/>
          </div>
          <div className="tp-serif" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.2, marginBottom: 10 }}>
            Vérifiez votre email
          </div>
          <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6, maxWidth: 320, margin: "0 auto" }}>
            Un email de confirmation a été envoyé à<br/>
            <b style={{ color: "var(--text)" }}>{form.email}</b><br/><br/>
            Cliquez sur le lien reçu pour activer votre compte et recevoir vos <b style={{ color: "var(--accent-ink)" }}>{WELCOME_TOKENS} crédits de bienvenue</b>.
          </div>
        </div>

        <div className="tp-card" style={{ padding: 14, background: "var(--surface-2)", marginBottom: 16, fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <CheckCircle2 size={15} style={{ color: "var(--success)" }}/>
            <b style={{ color: "var(--text)" }}>Compte créé avec succès</b>
          </div>
          Ouvrez votre boîte mail, cliquez sur le lien de confirmation, puis revenez vous connecter ici.
          {pendingUser?.usedReferralCode && (
            <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: "rgba(74,222,128,0.08)", color: "var(--success)" }}>
              <Gift size={11} style={{ display: "inline", verticalAlign: "middle" }}/> Parrainage par <b>{pendingUser?.referrerName || form.referralCode}</b> validé.
              {" "}+{REFERRAL_BONUS_REFEREE} crédits seront ajoutés à votre première connexion.
            </div>
          )}
        </div>

        <button onClick={handleValidateEmail} className="tp-btn tp-btn-primary" style={{ width: "100%", padding: "14px", fontSize: 14 }}>
          <LogIn size={15}/> Aller à la connexion
        </button>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.5 }}>
            Vous n'avez pas reçu l'email ? Vérifiez vos spams ou votre dossier Courrier indésirable.
          </div>
        </div>
      </div>
    );
  }

  // === VUE : Formulaire ===
  return (
    <div className="tp-scroll tp-fade-in" style={{ minHeight: "100dvh", padding: "24px" }}>
      <button onClick={() => onChangeMode("welcome")} className="tp-btn tp-btn-ghost" style={{ padding: 10, borderRadius: 10, marginBottom: 16 }}>
        <ChevronLeft size={18}/>
      </button>

      <div style={{ marginBottom: 24 }}>
        <div className="tp-serif" style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.1 }}>Créer un compte</div>
        <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6 }}>
          <Gift size={12} style={{ display: "inline", verticalAlign: "middle", color: "var(--accent-ink)" }}/> {WELCOME_TOKENS} crédits offerts après vérification email
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div className="tp-label" style={{ marginBottom: 6 }}>Nom complet</div>
          <div style={{ position: "relative" }}>
            <UserIcon size={16} style={{ position: "absolute", left: 14, top: 14, color: "var(--muted)" }}/>
            <input className="tp-input" style={{ paddingLeft: 38 }}
              placeholder="Jean Dupont" value={form.name} onChange={e => update("name", e.target.value)}/>
          </div>
        </div>

        <div>
          <div className="tp-label" style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
            Email professionnel <span className="tp-chip tp-chip-accent" style={{ fontSize: 9, padding: "1px 6px" }}>Vérifié par lien</span>
          </div>
          <div style={{ position: "relative" }}>
            <Mail size={16} style={{ position: "absolute", left: 14, top: 14, color: "var(--muted)" }}/>
            <input className="tp-input" type="email" style={{ paddingLeft: 38 }}
              placeholder="vous@email.com" value={form.email} onChange={e => update("email", e.target.value)}/>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, lineHeight: 1.5 }}>
            Un lien de validation sera envoyé à cette adresse. Les emails jetables sont refusés.
          </div>
        </div>

        <div>
          <div className="tp-label" style={{ marginBottom: 6 }}>
            Téléphone mobile <span style={{ color: "var(--text-dim)", fontWeight: 500, textTransform: "none", fontSize: 10 }}>(facultatif, pour les factures)</span>
          </div>
          <div style={{ position: "relative" }}>
            <Phone size={16} style={{ position: "absolute", left: 14, top: 14, color: "var(--muted)" }}/>
            <input className="tp-input" type="tel" style={{ paddingLeft: 38 }}
              placeholder="+33 6 12 34 56 78" value={form.phone} onChange={e => update("phone", e.target.value)}/>
          </div>
        </div>

        <div>
          <div className="tp-label" style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
            N° SIRET <span className="tp-chip tp-chip-accent" style={{ fontSize: 9, padding: "1px 6px" }}>Vérifié INSEE</span>
          </div>
          <div style={{ position: "relative" }}>
            <Building2 size={16} style={{ position: "absolute", left: 14, top: 14, color: "var(--muted)" }}/>
            <input className="tp-input" style={{ paddingLeft: 38, fontFamily: "monospace" }}
              placeholder="ex. 123 456 789 00012" value={form.siret} onChange={e => update("siret", e.target.value)}/>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, lineHeight: 1.5 }}>
            Votre activité VTC est vérifiée automatiquement via le registre INSEE (gratuit).
          </div>
        </div>

        <div>
          <div className="tp-label" style={{ marginBottom: 6 }}>Mot de passe</div>
          <div style={{ position: "relative" }}>
            <Lock size={16} style={{ position: "absolute", left: 14, top: 14, color: "var(--muted)" }}/>
            <input className="tp-input" type={showPw ? "text" : "password"} style={{ paddingLeft: 38, paddingRight: 44 }}
              placeholder="Minimum 8 caractères" value={form.password} onChange={e => update("password", e.target.value)}/>
            <button onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 8, top: 8, background: "none", border: "none", cursor: "pointer", padding: 6, color: "var(--muted)" }}>
              {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
            </button>
          </div>
        </div>

        {/* Referral code */}
        <div className="tp-card" style={{
          padding: 14,
          background: hasReferralCode ? "linear-gradient(135deg, rgba(74,222,128,0.1), rgba(74,222,128,0.02))" : "var(--surface-2)",
          borderColor: hasReferralCode ? "rgba(74,222,128,0.3)" : "var(--border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <HandCoins size={14} style={{ color: hasReferralCode ? "var(--success)" : "var(--accent-ink)" }}/>
            <div style={{ fontSize: 12, fontWeight: 700, color: hasReferralCode ? "var(--success)" : "var(--text)" }}>
              Code de parrainage {!hasReferralCode && <span style={{ color: "var(--text-dim)", fontWeight: 500 }}>(facultatif)</span>}
            </div>
          </div>
          <input className="tp-input" style={{ fontFamily: "monospace", textTransform: "uppercase", background: "var(--surface)" }}
            placeholder="Ex : TRPV-84XY"
            value={form.referralCode}
            onChange={e => update("referralCode", e.target.value.toUpperCase())}/>
          {hasReferralCode ? (
            <div style={{ fontSize: 11, color: "var(--success)", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
              <CheckCircle2 size={12}/> +{REFERRAL_BONUS_REFEREE} crédits bonus après vérification
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6, lineHeight: 1.5 }}>
              Si un ami vous a parrainé, saisissez son code pour gagner <b style={{ color: "var(--accent-ink)" }}>+{REFERRAL_BONUS_REFEREE} crédits</b>.
            </div>
          )}
        </div>

        {/* Security notice */}
        <div className="tp-card" style={{ padding: 12, background: "var(--surface-2)", display: "flex", gap: 10 }}>
          <Shield size={14} style={{ color: "var(--accent-ink)", flexShrink: 0, marginTop: 2 }}/>
          <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>
            <b style={{ color: "var(--text)" }}>Sécurité :</b> TrajetPro vérifie votre email, votre SIRET et votre appareil pour prévenir les inscriptions frauduleuses. Un seul compte par personne est autorisé.
          </div>
        </div>

        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", padding: "4px 2px" }}>
          <input type="checkbox" checked={form.acceptTerms} onChange={e => update("acceptTerms", e.target.checked)}
            style={{ marginTop: 2, accentColor: "var(--accent)", width: 16, height: 16, flexShrink: 0 }}/>
          <span style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>
            J'accepte les <b style={{ color: "var(--text)" }}>CGU</b>, la <b style={{ color: "var(--text)" }}>politique de confidentialité</b> et je certifie sur l'honneur que mon SIRET est exact.
          </span>
        </label>

        {error && (
          <div className="tp-card" style={{ padding: 10, background: "var(--error-soft)", borderColor: "rgba(248,113,113,0.3)", fontSize: 12, color: "var(--error)", display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.5 }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }}/>
            <span>{error}</span>
          </div>
        )}

        <button onClick={handleInitialSubmit} disabled={loading} className="tp-btn tp-btn-primary" style={{ padding: "14px", fontSize: 15, marginTop: 6 }}>
          {loading ? <><Loader2 size={16} style={{ animation: "tp-spin 1s linear infinite" }}/> Création...</> : <><UserPlus size={16}/> Créer mon compte</>}
        </button>

        <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-dim)", marginTop: 12 }}>
          Déjà inscrit ?{" "}
          <button onClick={() => onChangeMode("login")} style={{ color: "var(--accent-ink)", background: "none", border: "none", cursor: "pointer", fontWeight: 700, padding: 0 }}>
            Se connecter
          </button>
        </div>
      </div>
    </div>
  );
}


/* -------------------------------------------------------------------------
   REFERRAL SCREEN — Parrainage
   ------------------------------------------------------------------------- */
function ReferralScreen({ user, onBack }) {
  const [copied, setCopied] = useState(false);
  const stats = user?.referralStats || { invitedCount: 0, tokensEarned: 0, friends: [] };

  const handleCopy = () => {
    try {
      navigator.clipboard?.writeText(user.referralCode);
    } catch(e){}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    const text = `Je t'invite sur TrajetPro, l'app de bons de course pour VTC indépendants. Utilise mon code ${user.referralCode} pour gagner ${REFERRAL_BONUS_REFEREE} crédits bonus à ton inscription !`;
    if (navigator.share) {
      navigator.share({ title: "TrajetPro", text }).catch(() => {});
    } else {
      try { navigator.clipboard?.writeText(text); } catch(e){}
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="tp-scroll tp-fade-in">
      <TopBar title="Parrainage" subtitle="Invitez vos collègues, gagnez des crédits" onBack={onBack}/>

      <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Hero card with code */}
        <div className="tp-card-elevated" style={{
          padding: 22,
          background: "linear-gradient(135deg, rgba(37,99,235,0.2), rgba(37,99,235,0.02) 70%)",
          borderColor: "var(--accent-ring)",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: -40, right: -40,
            width: 150, height: 150, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(37,99,235,0.2), transparent 70%)",
            pointerEvents: "none",
          }}/>
          <div style={{
            width: 56, height: 56, margin: "0 auto 14px",
            borderRadius: 16, background: "var(--accent)", color: "var(--accent-on)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 24px -6px rgba(37,99,235,0.5)",
          }}>
            <HandCoins size={28}/>
          </div>
          <div style={{ fontSize: 11, color: "var(--accent-ink)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
            Votre code personnel
          </div>
          <div className="tp-serif" style={{ fontSize: 34, fontWeight: 600, color: "var(--text)", fontFamily: "'Fraunces', monospace", letterSpacing: "0.05em", marginBottom: 16 }}>
            {user?.referralCode}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={handleCopy} className="tp-btn tp-btn-ghost" style={{ padding: "12px" }}>
              {copied ? <><Check size={15} style={{ color: "var(--success)" }}/> Copié</> : <><Copy size={15}/> Copier</>}
            </button>
            <button onClick={handleShare} className="tp-btn tp-btn-primary" style={{ padding: "12px" }}>
              <Share2 size={15}/> Partager
            </button>
          </div>
        </div>

        {/* How it works */}
        <div className="tp-card" style={{ padding: 16, background: "var(--surface)" }}>
          <div className="tp-label" style={{ marginBottom: 12 }}>Comment ça marche</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { num: "1", title: "Partagez votre code", desc: "Envoyez votre code personnel à un chauffeur VTC que vous connaissez." },
              { num: "2", title: "Il s'inscrit", desc: `Votre filleul saisit votre code à l'inscription et reçoit ${REFERRAL_BONUS_REFEREE} crédits bonus.` },
              { num: "3", title: "Vous gagnez", desc: `${REFERRAL_BONUS_REFERRER} crédits sont ajoutés à votre compte dès que son inscription est validée.` },
            ].map(s => (
              <div key={s.num} style={{ display: "flex", gap: 12 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 13,
                  background: "var(--accent)", color: "var(--accent-on)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                  fontFamily: "'Fraunces', serif",
                }}>{s.num}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2, lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="tp-card" style={{ padding: 14, background: "var(--surface)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-dim)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <Users size={11}/> Filleuls
            </div>
            <div className="tp-serif" style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>{stats.invitedCount}</div>
          </div>
          <div className="tp-card" style={{ padding: 14, background: "var(--surface)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-dim)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <Coins size={11}/> Gagnés
            </div>
            <div className="tp-serif" style={{ fontSize: 24, fontWeight: 600, marginTop: 4, color: "var(--accent-ink)" }}>+{stats.tokensEarned}</div>
          </div>
        </div>

        {/* Friends list */}
        <div>
          <div className="tp-label" style={{ marginBottom: 10 }}>Vos filleuls</div>
          {stats.friends.length === 0 ? (
            <div className="tp-card" style={{ padding: 28, textAlign: "center", background: "var(--surface)" }}>
              <Users size={28} style={{ color: "var(--muted)", margin: "0 auto 10px", opacity: 0.4 }}/>
              <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Personne pour l'instant</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Partagez votre code pour commencer à gagner</div>
            </div>
          ) : (
            <div className="tp-card" style={{ background: "var(--surface)" }}>
              {stats.friends.map((f, i, arr) => (
                <div key={f.code} style={{
                  padding: 14, display: "flex", alignItems: "center", gap: 12,
                  borderBottom: i < arr.length-1 ? "1px solid var(--border)" : "none",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: "var(--surface-2)", color: "var(--accent-ink)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    fontSize: 13, fontWeight: 700, fontFamily: "'Fraunces', serif",
                  }}>
                    {f.name.split(" ").map(w => w[0]).join("").substring(0,2)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 1 }}>Inscrit le {formatDate(f.joinedAt)}</div>
                  </div>
                  <div className="tp-chip tp-chip-success" style={{ fontSize: 10 }}>
                    +{REFERRAL_BONUS_REFERRER} crédits
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Conditions */}
        <div style={{ padding: 12, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 10, color: "var(--text-dim)", lineHeight: 1.6 }}>
          <div style={{ color: "var(--text)", fontWeight: 700, marginBottom: 4, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Conditions du parrainage
          </div>
          Parrainage valable une seule fois par personne. Les crédits sont crédités automatiquement dès la première connexion validée du filleul. Les comptes frauduleux ou multiples sont exclus. TrajetPro se réserve le droit de modifier les conditions à tout moment.
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   BILLING SCREEN — Configuration des factures (logo, champs toggleables…)
   -------------------------------------------------------------------------
   Page dédiée accessible depuis Préférences → Facturation. Toutes les
   modifications sont mises en attente dans un état local et écrites en
   base seulement après clic sur "Sauvegarder" (vs auto-save de la page
   Préférences pour les toggles légers comme la langue).
   ------------------------------------------------------------------------- */
function BillingScreen({ onBack, invoiceSettings = {}, onUpdateInvoiceSettings }) {
  // Form local, initialisé depuis les paramètres déjà sauvegardés. On
  // garde la référence aux valeurs originales pour calculer le "dirty".
  const [form, setForm] = useState({
    logo_data_url: invoiceSettings.logo_data_url || null,
    legal_form: invoiceSettings.legal_form || '',
    show_legal_form: invoiceSettings.show_legal_form !== false,
    vat_number: invoiceSettings.vat_number || '',
    show_vat_number: invoiceSettings.show_vat_number !== false,
    vehicle_plate: invoiceSettings.vehicle_plate || '',
    show_vehicle_plate: invoiceSettings.show_vehicle_plate !== false,
    vtc_number: invoiceSettings.vtc_number || '',
    pro_card_number: invoiceSettings.pro_card_number || '',
    vehicle_model: invoiceSettings.vehicle_model || '',
    show_siret: invoiceSettings.show_siret !== false,
    show_vtc_number: invoiceSettings.show_vtc_number !== false,
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0); // timestamp pour l'animation "✓ Enregistré"

  // Recalcule l'état "modifié" en comparant avec invoiceSettings entrant
  const isDirty = useMemo(() => {
    const keys = Object.keys(form);
    return keys.some((k) => {
      const a = form[k];
      const b = invoiceSettings[k];
      // Normalise undefined ↔ null ↔ '' pour ne pas dirtify à la 1re saisie
      const norm = (v) => (v === undefined || v === null) ? '' : v;
      // Pour les bool, on compare avec la valeur effective (default true)
      if (typeof a === 'boolean' || k.startsWith('show_')) {
        return Boolean(a) !== Boolean(b !== false);
      }
      return norm(a) !== norm(b);
    });
  }, [form, invoiceSettings]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdateInvoiceSettings(form);
      setSavedAt(Date.now());
      // Dim le feedback visuel après 2 secondes
      setTimeout(() => setSavedAt(0), 2200);
    } catch (err) {
      alert("Erreur lors de la sauvegarde : " + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (isDirty) {
      const confirm = window.confirm(
        "Vous avez des modifications non sauvegardées.\n\nQuitter sans sauvegarder ?"
      );
      if (!confirm) return;
    }
    onBack();
  };

  return (
    <div className="tp-scroll tp-fade-in">
      <TopBar title="Facturation" subtitle="Personnalisez vos factures PDF" onBack={handleBack}/>

      <div style={{ padding: "0 20px 100px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Logo */}
        <div className="tp-card" style={{ padding: 14, background: "var(--surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            {form.logo_data_url ? (
              <img src={form.logo_data_url} alt="Logo"
                style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 8, background: "#fff", padding: 4 }}/>
            ) : (
              <div style={{
                width: 56, height: 56, borderRadius: 8, background: "var(--surface-2)",
                display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)",
              }}>
                <Building2 size={22}/>
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Logo de l'entreprise</div>
              <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2, lineHeight: 1.4 }}>
                {form.logo_data_url
                  ? "Affiché en haut à droite de chaque facture PDF"
                  : "PNG ou JPG, max 2 Mo. S'affichera en haut à droite des PDF."}
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: form.logo_data_url ? "1fr 1fr" : "1fr", gap: 8 }}>
            <label className="tp-btn tp-btn-ghost" style={{ cursor: "pointer", justifyContent: "center", fontSize: 12 }}>
              <Edit3 size={13}/> {form.logo_data_url ? "Changer" : "Ajouter un logo"}
              <input type="file" accept="image/png,image/jpeg" style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) {
                    alert("Logo trop volumineux (max 2 Mo). Compressez-le avant l'upload.");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    const img = new Image();
                    img.onload = () => {
                      const MAX_W = 300;
                      const scale = img.width > MAX_W ? MAX_W / img.width : 1;
                      const canvas = document.createElement('canvas');
                      canvas.width = img.width * scale;
                      canvas.height = img.height * scale;
                      const ctx = canvas.getContext('2d');
                      ctx.fillStyle = '#ffffff';
                      ctx.fillRect(0, 0, canvas.width, canvas.height);
                      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                      const dataUrl = canvas.toDataURL('image/png', 0.92);
                      update('logo_data_url', dataUrl);
                    };
                    img.src = reader.result;
                  };
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }}/>
            </label>
            {form.logo_data_url && (
              <button onClick={() => update('logo_data_url', null)}
                className="tp-btn tp-btn-ghost" style={{ color: "var(--error)", fontSize: 12, justifyContent: "center" }}>
                <Trash2 size={13}/> Retirer
              </button>
            )}
          </div>
        </div>

        {/* Inputs sans toggle (toujours affichés sur la facture si renseignés) */}
        {[
          { id: 'vtc_number', label: 'N° d\'inscription VTC (EVTC)', placeholder: 'EVTCxxxxxxxxxx' },
          { id: 'pro_card_number', label: 'N° de carte pro. conducteur', placeholder: 'VTC-XX-2024-XXXX' },
          { id: 'vehicle_model', label: 'Modèle du véhicule', placeholder: 'Peugeot 508, Mercedes Classe E…' },
        ].map((field) => (
          <div key={field.id} className="tp-card" style={{ padding: 14, background: "var(--surface)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{field.label}</div>
            <input className="tp-input"
              placeholder={field.placeholder}
              value={form[field.id] || ''}
              onChange={(e) => update(field.id, e.target.value)}/>
          </div>
        ))}

        {/* Toggles simples (valeur lue depuis le profil user au moment du PDF) */}
        <div className="tp-card" style={{ background: "var(--surface)", overflow: "hidden" }}>
          {[
            { id: 'show_siret', label: 'Afficher mon SIRET sur les factures' },
            { id: 'show_vtc_number', label: 'Afficher mon n° VTC sur les factures' },
          ].map((t, i, arr) => {
            const value = form[t.id];
            return (
              <div key={t.id} style={{
                padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
                borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t.label}</div>
                </div>
                <button onClick={() => update(t.id, !value)}
                  style={{
                    width: 40, height: 22, borderRadius: 999,
                    background: value ? "var(--accent)" : "var(--surface-3)",
                    position: "relative", transition: "background 0.15s",
                    border: "none", cursor: "pointer", flexShrink: 0,
                  }}>
                  <div style={{
                    position: "absolute", top: 2, left: value ? 20 : 2,
                    width: 18, height: 18, borderRadius: "50%", background: "#fff",
                    transition: "left 0.15s",
                  }}/>
                </button>
              </div>
            );
          })}
        </div>

        {/* Inputs avec toggle d'affichage */}
        {[
          { id: 'legal_form', label: 'Forme juridique', placeholder: 'EI, SASU, EURL, SARL…', toggleId: 'show_legal_form' },
          { id: 'vat_number', label: 'N° TVA intracommunautaire', placeholder: 'FR12345678901', toggleId: 'show_vat_number' },
          { id: 'vehicle_plate', label: 'Immatriculation du véhicule', placeholder: 'AB-123-CD', toggleId: 'show_vehicle_plate' },
        ].map((field) => {
          const value = form[field.id] || '';
          const visible = form[field.toggleId];
          return (
            <div key={field.id} className="tp-card" style={{ padding: 14, background: "var(--surface)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{field.label}</div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
                    {value
                      ? (visible ? "Affiché sur les factures" : "Masqué sur les factures")
                      : "Saisissez une valeur ci-dessous"}
                  </div>
                </div>
                <button onClick={() => update(field.toggleId, !visible)}
                  title={visible ? "Masquer sur les factures" : "Afficher sur les factures"}
                  style={{
                    width: 40, height: 22, borderRadius: 999,
                    background: visible ? "var(--accent)" : "var(--surface-3)",
                    position: "relative", transition: "background 0.15s",
                    border: "none", cursor: "pointer", flexShrink: 0,
                  }}>
                  <div style={{
                    position: "absolute", top: 2, left: visible ? 20 : 2,
                    width: 18, height: 18, borderRadius: "50%", background: "#fff",
                    transition: "left 0.15s",
                  }}/>
                </button>
              </div>
              <input className="tp-input"
                placeholder={field.placeholder}
                value={value}
                onChange={(e) => update(field.id, e.target.value)}/>
            </div>
          );
        })}

        {/* Astuce */}
        <div className="tp-card" style={{ padding: 12, background: "rgba(37,99,235,0.08)", borderColor: "rgba(37,99,235,0.2)" }}>
          <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>
            <Info size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 6, color: "var(--accent-ink)" }}/>
            Le <b>nom de société</b>, le <b>SIRET</b> et l'<b>adresse</b> personnelle sont gérés depuis <b>Profil → Modifier mes infos</b>.
          </div>
        </div>
      </div>

      {/* Barre fixe en bas avec bouton Sauvegarder */}
      <div style={{
        position: "fixed", left: 0, right: 0, bottom: 0,
        background: "linear-gradient(to top, var(--bg) 70%, transparent)",
        padding: "16px 20px 24px", zIndex: 50,
      }}>
        <button onClick={handleSave}
          disabled={saving || !isDirty}
          className="tp-btn tp-btn-primary"
          style={{
            width: "100%", padding: "14px", fontSize: 15,
            opacity: (saving || !isDirty) ? 0.55 : 1,
            cursor: (saving || !isDirty) ? "default" : "pointer",
          }}>
          {saving
            ? <><Loader2 size={16} style={{ animation: "tp-spin 1s linear infinite" }}/> Sauvegarde…</>
            : (Date.now() - savedAt < 2000
              ? <><CheckCircle2 size={16}/> Enregistré</>
              : (isDirty
                ? <><Check size={16}/> Sauvegarder les modifications</>
                : <>Aucune modification à sauvegarder</>))}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   SETTINGS SCREEN — Préférences
   ------------------------------------------------------------------------- */
function SettingsScreen({ onBack, preferences, onChangePref, onDeleteAccount, invoiceSettings = {}, onUpdateInvoiceSettings, onGoTab }) {
  const groups = [
    // Bloc "Affichage" : seul le thème est fonctionnel (sombre ↔ clair),
    // langue et devise sont prévues pour la v1.1 (multi-pays). Le toggle
    // thème applique data-theme="light"/"dark" sur :root → toutes les
    // variables CSS basculent en cascade, en un seul clic.
    {
      title: "Affichage", items: [
        {
          id: "theme",
          icon: Moon,
          label: "Thème",
          type: "toggle",
          value: preferences.theme === "light",
          // Toggle : OFF = sombre (signature), ON = clair
          // (label dynamique pour la lisibilité)
          dynamicLabel: preferences.theme === "light" ? "Clair" : "Sombre",
        },
      ]
    },
    {
      title: "Notifications", items: [
        { id: "notif_rides", icon: Bell, label: "Rappel de courses", type: "toggle", value: preferences.notifRides },
        { id: "notif_invoices", icon: Receipt, label: "Rappel de paiement", type: "toggle", value: preferences.notifInvoices },
        { id: "notif_marketing", icon: Sparkles, label: "Offres et nouveautés", type: "toggle", value: preferences.notifMarketing },
      ]
    },
    {
      title: "Facturation", items: [
        { id: "vat", icon: FileText, label: "Taux de TVA", value: String(preferences.vatRate), options: [{v:"10", l:"10% (transport)"},{v:"20", l:"20% (standard)"},{v:"0", l:"Exonéré"}] },
        { id: "autonum", icon: Shield, label: "Numérotation auto", type: "toggle", value: preferences.autoNumbering },
      ]
    },
    {
      title: "Navigation", items: [
        { id: "defaultGps", icon: Navigation, label: "GPS par défaut", value: preferences.defaultGps || "ask", options: [{v:"ask", l:"Demander"},{v:"google", l:"Google Maps"},{v:"waze", l:"Waze"},{v:"apple", l:"Plans (Apple)"}] },
      ]
    },
    {
      title: "Sécurité & données", items: [
        { id: "bio", icon: Fingerprint, label: "Biométrie", type: "toggle", value: preferences.biometric },
        { id: "backup", icon: Cloud, label: "Sauvegarde automatique", type: "toggle", value: preferences.autoBackup },
      ]
    },
  ];

  return (
    <div className="tp-scroll tp-fade-in">
      <TopBar title="Préférences" subtitle="Personnalisez votre expérience" onBack={onBack}/>

      <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: 20 }}>
        {groups.map(g => (
          <div key={g.title}>
            <div className="tp-label" style={{ marginBottom: 8, padding: "0 2px" }}>{g.title}</div>
            <div className="tp-card" style={{ background: "var(--surface)" }}>
              {g.items.map((it, i, arr) => (
                <div key={it.id} style={{
                  padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
                  borderBottom: i < arr.length-1 ? "1px solid var(--border)" : "none",
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 9,
                    background: "var(--surface-2)", color: "var(--accent-ink)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <it.icon size={15}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{it.label}</div>
                  </div>
                  {it.type === "toggle" ? (
                    <button onClick={() => onChangePref(it.id, !it.value)}
                      style={{
                        width: 40, height: 22, borderRadius: 999,
                        background: it.value ? "var(--accent)" : "var(--surface-3)",
                        position: "relative", transition: "background 0.15s",
                        border: "none", cursor: "pointer", flexShrink: 0,
                      }}>
                      <div style={{
                        position: "absolute", top: 2, left: it.value ? 20 : 2,
                        width: 18, height: 18, borderRadius: "50%", background: "#fff",
                        transition: "left 0.15s",
                      }}/>
                    </button>
                  ) : (
                    <select value={it.value} onChange={e => onChangePref(it.id, e.target.value)}
                      className="tp-input"
                      style={{ width: "auto", padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0, minWidth: 100 }}>
                      {it.options.map(opt => <option key={opt.v} value={opt.v}>{opt.l}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Item cliquable "Facturation" — ouvre la page BillingScreen
            (logo, n° VTC, plaque, toggles, bouton Sauvegarder).
            Le bloc inline d'avant a été déplacé dans la page dédiée. */}
        <div>
          <div className="tp-label" style={{ marginBottom: 8, padding: "0 2px" }}>Facturation</div>
          <button onClick={() => onGoTab && onGoTab("billing")}
            className="tp-card"
            style={{
              width: "100%", padding: "14px 16px", display: "flex",
              alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left",
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 12, color: "var(--text)",
            }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9, background: "var(--accent-soft)",
              color: "var(--accent-ink)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Receipt size={16}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Personnaliser mes factures</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                Logo, n° VTC, plaque, forme juridique…
              </div>
            </div>
            <ChevronRight size={16} style={{ color: "var(--text-dim)", flexShrink: 0 }}/>
          </button>
        </div>

        {/* Sélecteur multi-checkbox des rappels avant course.
            Visible uniquement si "Rappel de courses" est activé. */}
        <div style={{ opacity: preferences.notifRides ? 1 : 0.5, pointerEvents: preferences.notifRides ? "auto" : "none" }}>
          <div className="tp-label" style={{ marginBottom: 8, padding: "0 2px" }}>Quand recevoir les rappels</div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", padding: "0 2px 8px", lineHeight: 1.5 }}>
            Cochez les délais où vous voulez être prévenu avant une course. {!preferences.notifRides && <em>(Activez d'abord "Rappel de courses" ci-dessus.)</em>}
          </div>
          <div className="tp-card" style={{ background: "var(--surface)", overflow: "hidden" }}>
            {ALL_REMINDER_OFFSETS.map((off, i, arr) => {
              const checked = (preferences.reminderOffsets || []).includes(off.key);
              const isLast = i === arr.length - 1;
              return (
                <button key={off.key}
                  onClick={() => {
                    const current = preferences.reminderOffsets || [];
                    const next = checked
                      ? current.filter(k => k !== off.key)
                      : [...current, off.key];
                    onChangePref('reminderOffsets', next);
                  }}
                  style={{
                    width: "100%", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
                    borderBottom: isLast ? "none" : "1px solid var(--border)",
                    background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
                  }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 11,
                    border: checked ? "2px solid var(--accent)" : "2px solid var(--text-dim)",
                    background: checked ? "var(--accent)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    {checked && <Check size={12} color="#0B0B0D" strokeWidth={3}/>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: checked ? 600 : 500, color: checked ? "var(--text)" : "var(--text-dim)" }}>
                      {off.label}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {preferences.notifRides && (preferences.reminderOffsets || []).length === 0 && (
            <div className="tp-card" style={{ padding: 10, marginTop: 8, background: "var(--warn-soft, rgba(251,191,36,0.1))", borderColor: "rgba(251,191,36,0.3)" }}>
              <div style={{ fontSize: 11, color: "var(--warn, #fbbf24)", display: "flex", alignItems: "flex-start", gap: 6, lineHeight: 1.5 }}>
                <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }}/>
                <span>Aucun rappel sélectionné — vous ne recevrez aucune notification avant vos courses.</span>
              </div>
            </div>
          )}
        </div>

        <div className="tp-card" style={{ padding: 14, background: "var(--surface)", display: "flex", gap: 10 }}>
          <Database size={16} style={{ color: "var(--text-dim)", flexShrink: 0, marginTop: 2 }}/>
          <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6 }}>
            Vos données sont chiffrées localement. La sauvegarde automatique synchronise chaque modification avec votre compte TrajetPro pour vous permettre de retrouver toutes vos données sur n'importe quel appareil.
          </div>
        </div>

        <div style={{ padding: "0 4px", marginTop: 4 }}>
          <button onClick={onDeleteAccount} style={{
            fontSize: 12, color: "var(--error)", background: "none", border: "none",
            cursor: "pointer", fontWeight: 600, padding: 6, textDecoration: "underline",
          }}>
            🗑️ Supprimer définitivement mon compte
          </button>
          <div style={{ fontSize: 10, color: "var(--text-dim)", padding: "4px 6px 0", lineHeight: 1.5 }}>
            Action irréversible · supprime tous vos bons, factures et crédits · conformément au RGPD (article 17)
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   TERMS / CGV SCREEN
   ------------------------------------------------------------------------- */
function TermsScreen({ onBack }) {
  const sections = [
    {
      title: "1. Objet",
      content: "TrajetPro est un logiciel de gestion destiné aux chauffeurs VTC indépendants. L'application permet de créer des bons de course réglementaires conformes au décret 2017-483, d'émettre des factures avec empreinte fiscale, et de gérer votre activité au quotidien.",
    },
    {
      title: "2. Accès au service",
      content: "L'accès à TrajetPro nécessite la création d'un compte. Vous devez fournir des informations exactes et à jour. Vous êtes responsable de la confidentialité de votre mot de passe et de toutes les actions effectuées depuis votre compte.",
    },
    {
      title: "3. Système de crédits",
      content: "TrajetPro fonctionne avec un système de crédits (jetons). Chaque création de bon de course ou de facture consomme 1 crédit. Les nouveaux inscrits reçoivent 5 crédits de bienvenue. Des crédits supplémentaires peuvent être achetés via l'application. Les crédits n'expirent pas et sont non remboursables sauf dysfonctionnement technique prouvé.",
    },
    {
      title: "4. Parrainage",
      content: `Chaque utilisateur dispose d'un code de parrainage unique. Lorsqu'un nouvel utilisateur s'inscrit avec votre code, vous recevez ${REFERRAL_BONUS_REFERRER} crédits et votre filleul reçoit ${REFERRAL_BONUS_REFEREE} crédits bonus. Le parrainage est valable une seule fois par personne et soumis à validation anti-fraude.`,
    },
    {
      title: "5. Unicité de compte et anti-fraude",
      content: "Afin de garantir l'équité entre utilisateurs et de prévenir les abus, TrajetPro applique une politique stricte d'un seul compte par personne. Pour cela, nous vérifions : (1) votre adresse email via un lien de confirmation, (2) votre numéro de SIRET via l'API officielle INSEE, (3) votre numéro d'inscription VTC au registre officiel, (4) un identifiant technique unique de votre appareil (Apple DeviceCheck / Google Play Integrity) qui résiste à la désinstallation/réinstallation de l'application. Les domaines d'emails jetables sont refusés. Toute tentative de contournement (création de comptes multiples, désinstallation pour obtenir de nouveaux crédits offerts, faux SIRET, parrainage fictif) entraîne la suspension immédiate et définitive de tous les comptes concernés, sans remboursement. Les crédits gagnés frauduleusement sont annulés.",
    },
    {
      title: "6. Propriété intellectuelle",
      content: "TrajetPro, son design, son code et sa marque sont la propriété exclusive de leur éditeur. Toute reproduction, modification ou redistribution est strictement interdite sans autorisation écrite.",
    },
    {
      title: "6. Données personnelles (RGPD)",
      content: "Vos données sont traitées conformément au RGPD. Elles sont stockées de manière sécurisée et chiffrée. Vous disposez d'un droit d'accès, de rectification et de suppression de vos données à tout moment via votre espace personnel ou par email.",
    },
    {
      title: "7. Responsabilité",
      content: "TrajetPro est fourni « en l'état ». L'éditeur ne peut être tenu responsable des interruptions de service, pertes de données, ou utilisations non conformes de l'application. Le chauffeur reste seul responsable du respect de la réglementation VTC et fiscale applicable.",
    },
    {
      title: "8. Modification des CGV",
      content: "L'éditeur se réserve le droit de modifier les présentes conditions à tout moment. Les utilisateurs seront informés par email et dans l'application au moins 30 jours avant l'entrée en vigueur des modifications.",
    },
    {
      title: "9. Résiliation",
      content: "Vous pouvez supprimer votre compte à tout moment depuis les paramètres. L'éditeur peut suspendre ou résilier un compte en cas de non-respect des présentes CGV, notamment en cas de fraude au parrainage ou d'abus du service.",
    },
    {
      title: "10. Droit applicable",
      content: "Les présentes CGV sont soumises au droit français. En cas de litige, une solution amiable sera recherchée avant tout recours juridictionnel. Les tribunaux de Marseille seront seuls compétents.",
    },
  ];

  return (
    <div className="tp-scroll tp-fade-in">
      <TopBar title="Conditions générales" subtitle="Dernière mise à jour : 23 avril 2026" onBack={onBack}/>

      <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="tp-card" style={{ padding: 14, background: "var(--accent-soft)", borderColor: "var(--accent-ring)", display: "flex", gap: 10 }}>
          <Info size={16} style={{ color: "var(--accent-ink)", flexShrink: 0, marginTop: 2 }}/>
          <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>
            En utilisant TrajetPro, vous reconnaissez avoir lu et accepté les présentes conditions générales.
          </div>
        </div>

        {sections.map(s => (
          <div key={s.title} className="tp-card" style={{ padding: 16, background: "var(--surface)" }}>
            <div className="tp-serif" style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{s.title}</div>
            <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>{s.content}</div>
          </div>
        ))}

        <div style={{ padding: 14, textAlign: "center", fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
          TrajetPro SAS · SIRET 909 123 456 00018<br/>
          12 rue de la République, 84000 Avignon · France<br/>
          contact@trajetpro.fr
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   HELP / SUPPORT SCREEN
   ------------------------------------------------------------------------- */
function HelpScreen({ onBack }) {
  const [openFaq, setOpenFaq] = useState(null);
  const faqs = [
    { q: "Comment fonctionne le système de crédits ?", a: "Chaque bon de course ou facture créé consomme 1 crédit. Les actions gratuites : modifier un bon existant, partager, télécharger, consulter l'historique. Les nouveaux inscrits reçoivent 5 crédits offerts." },
    { q: "Les crédits expirent-ils ?", a: "Non, les crédits achetés ou offerts n'ont aucune date d'expiration. Vous les conservez tant que votre compte reste actif." },
    { q: "Puis-je utiliser TrajetPro sans compte ?", a: "Oui, vous pouvez essayer l'application en mode invité. Attention : sans compte, vos données restent uniquement sur cet appareil et seront perdues si vous changez de téléphone." },
    { q: "Comment récupérer mes données sur un autre téléphone ?", a: "Connectez-vous avec votre email et mot de passe sur le nouvel appareil. Toutes vos données (courses, factures, crédits, historique) sont synchronisées automatiquement." },
    { q: "La dictée vocale ne fonctionne pas, que faire ?", a: "Vérifiez que vous avez autorisé l'accès au micro dans les réglages iOS/Android. La reconnaissance vocale nécessite aussi une connexion internet. En dernier recours, utilisez la saisie manuelle." },
    { q: "Mes factures sont-elles conformes au droit français ?", a: "Oui, TrajetPro intègre toutes les mentions obligatoires (SIRET, VTC, carte pro, empreinte fiscale) et respecte le décret 2017-483 ainsi que les obligations fiscales 2018." },
    { q: "Comment fonctionne le parrainage ?", a: "Partagez votre code unique avec un collègue chauffeur. Quand il s'inscrit avec votre code, vous recevez 10 crédits et il reçoit 5 crédits bonus. Aucune limite au nombre de parrainages." },
    { q: "Puis-je être remboursé de mes crédits ?", a: "Les achats de crédits sont non remboursables sauf en cas de dysfonctionnement technique prouvé imputable à l'éditeur. Contactez le support avec une description détaillée." },
    { q: "Comment modifier mes informations professionnelles ?", a: "Allez dans Profil → Mes informations légales. Vous pouvez mettre à jour votre SIRET, numéro VTC, carte pro, et véhicule. Les factures futures seront automatiquement mises à jour." },
    { q: "Comment supprimer mon compte ?", a: "Allez dans Profil → Préférences → Effacer toutes mes données, puis contactez-nous à contact@trajetpro.fr pour supprimer définitivement votre compte. Vos données seront effacées sous 30 jours conformément au RGPD." },
  ];

  return (
    <div className="tp-scroll tp-fade-in">
      <TopBar title="Aide et support" subtitle="Nous sommes là pour vous" onBack={onBack}/>

      <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Contact card — pleine largeur depuis le retrait du Chat en direct
            (2026-05-06). On laisse uniquement le contact email, qui ouvre le
            client mail natif iOS / Android via mailto. */}
        <div>
          <a href="mailto:contact@trajetpro.fr?subject=Support%20TrajetPro" className="tp-card" style={{
            padding: 18, display: "flex", alignItems: "center", gap: 14,
            background: "var(--surface)", textDecoration: "none", color: "var(--text)", cursor: "pointer",
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 11, background: "var(--accent-soft)",
              color: "var(--accent-ink)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}><Mail size={20}/></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Nous contacter par email</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>contact@trajetpro.fr · réponse sous 24h ouvrées</div>
            </div>
            <ArrowUpRight size={16} style={{ color: "var(--accent-ink)", flexShrink: 0 }}/>
          </a>
        </div>

        {/* Le bloc "Guide d'utilisation / Tutoriels vidéo" a été retiré
            (demande utilisateur, 2026-05-06). On garde la FAQ ci-dessous
            qui couvre les questions fréquentes sans nécessiter de vidéos. */}

        {/* FAQ */}
        <div>
          <div className="tp-label" style={{ marginBottom: 10 }}>Questions fréquentes</div>
          <div className="tp-card" style={{ background: "var(--surface)", overflow: "hidden" }}>
            {faqs.map((f, i) => (
              <div key={i} style={{ borderBottom: i < faqs.length-1 ? "1px solid var(--border)" : "none" }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: "100%", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10,
                    background: "none", border: "none", cursor: "pointer", textAlign: "left", color: "var(--text)",
                  }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{f.q}</div>
                  <ChevronDown size={16} style={{ color: "var(--muted)", transform: openFaq === i ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}/>
                </button>
                {openFaq === i && (
                  <div className="tp-fade-in" style={{ padding: "0 16px 14px", fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 }}>
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bloc "Support urgent" (numéro de téléphone fictif) retiré
            le 2026-05-06 — non requis pour la v1.0 et donnait l'illusion
            d'un support 24/24 qu'on ne peut pas tenir.
            Le contact reste : contact@trajetpro.fr. */}

        <div style={{ textAlign: "center", fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
          TrajetPro v1.0.0 · Build 2026.04.23
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   MONTHLY BONUS TOAST
   ------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------
   AGENDA MODAL — vue calendrier mensuel des courses
   -------------------------------------------------------------------------
   Modal affichée depuis l'Accueil → bouton "Agenda". Montre le mois en
   cours sous forme de grille 7×N : chaque case = un jour ; les jours qui
   ont au moins une course sont marqués d'un point doré + le nombre de
   courses ce jour-là. Permet de naviguer aux mois précédent/suivant et
   de tap sur un jour pour voir la liste des courses détaillée.
   ------------------------------------------------------------------------- */
function AgendaModal({ open, onClose, bookings, onOpenBooking }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(null);

  if (!open) return null;

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  // 1er jour du mois (0 = dim, 1 = lun…). En FR on commence par lundi.
  // J'aligne donc l'offset : si jour US = 0 (dim) → on met 6, sinon on
  // soustrait 1 (lun → 0, mar → 1…).
  const firstDate = new Date(year, month, 1);
  const usWeekday = firstDate.getDay();
  const startOffset = (usWeekday + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Map { 'YYYY-MM-DD' : [bookings] } pour le mois affiché
  const bookingsByDay = {};
  bookings.forEach((b) => {
    const dt = new Date(b.dateTime);
    if (dt.getFullYear() !== year || dt.getMonth() !== month) return;
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    (bookingsByDay[key] = bookingsByDay[key] || []).push(b);
  });

  const todayKey = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  })();

  const monthLabel = cursor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Compléter jusqu'à un multiple de 7 pour aligner la grille
  while (cells.length % 7 !== 0) cells.push(null);

  const monthBookingsCount = Object.values(bookingsByDay).reduce((s, arr) => s + arr.length, 0);

  const goPrev = () => setCursor(new Date(year, month - 1, 1));
  const goNext = () => setCursor(new Date(year, month + 1, 1));

  const dayList = selectedDay ? bookingsByDay[selectedDay] || [] : [];

  return (
    <div className="tp-overlay" onClick={onClose}>
      <div className="tp-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="tp-grab"/>
        <div style={{ padding: "14px 20px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <button onClick={goPrev} className="tp-btn tp-btn-ghost" style={{ padding: 8, borderRadius: 10 }}>
              <ChevronLeft size={18}/>
            </button>
            <div style={{ textAlign: "center" }}>
              <div className="tp-serif" style={{ fontSize: 20, fontWeight: 600, textTransform: "capitalize" }}>{monthLabel}</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                {monthBookingsCount} course{monthBookingsCount > 1 ? "s" : ""} ce mois-ci
              </div>
            </div>
            <button onClick={() => setCursor(new Date(year, month + 1, 1))}
              className="tp-btn tp-btn-ghost" style={{ padding: 8, borderRadius: 10 }}>
              <ArrowUpRight size={18} style={{ transform: "rotate(45deg)" }}/>
            </button>
          </div>

          {/* En-tête jours de la semaine */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginTop: 14 }}>
            {["L", "M", "M", "J", "V", "S", "D"].map((w, i) => (
              <div key={i} style={{ fontSize: 10, textAlign: "center", color: "var(--text-dim)", fontWeight: 700, padding: "4px 0" }}>{w}</div>
            ))}
          </div>

          {/* Grille des jours */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginTop: 4 }}>
            {cells.map((d, i) => {
              if (d === null) return <div key={i}/>;
              const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const dayCount = bookingsByDay[key]?.length || 0;
              const isToday = key === todayKey;
              const isSelected = key === selectedDay;
              return (
                <button key={i} onClick={() => setSelectedDay(isSelected ? null : key)}
                  style={{
                    aspectRatio: "1 / 1",
                    background: isSelected
                      ? "var(--accent)"
                      : isToday ? "var(--accent-soft)" : "var(--surface)",
                    border: "1px solid",
                    borderColor: isSelected
                      ? "var(--accent)"
                      : isToday ? "var(--accent-ring)" : "var(--border)",
                    borderRadius: 10,
                    color: isSelected ? "#0B0B0D" : "var(--text)",
                    cursor: dayCount > 0 ? "pointer" : "default",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 600, gap: 2,
                    transition: "all 0.15s",
                  }}>
                  <span>{d}</span>
                  {dayCount > 0 && (
                    <span style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: isSelected ? "#0B0B0D" : "var(--accent)",
                      background: isSelected ? "rgba(11,11,13,0.15)" : "var(--accent-soft)",
                      padding: "1px 6px",
                      borderRadius: 999,
                    }}>{dayCount}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Liste des courses du jour sélectionné */}
          {selectedDay && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <div className="tp-label" style={{ marginBottom: 8 }}>
                {new Date(selectedDay).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              </div>
              {dayList.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-dim)", textAlign: "center", padding: 12 }}>Aucune course ce jour</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {dayList
                    .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))
                    .map(b => (
                      <button key={b.id}
                        onClick={() => { onClose(); onOpenBooking(b); }}
                        className="tp-card"
                        style={{ padding: 12, display: "flex", gap: 12, alignItems: "center", textAlign: "left", cursor: "pointer", background: "var(--surface)" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent-ink)", minWidth: 50 }}>
                          {new Date(b.dateTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.customerName}</div>
                          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {b.pickupAddress} → {b.dropoffAddress}
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MonthlyBonusToast({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="tp-fade-in" style={{
      position: "fixed", top: 30, left: "50%", transform: "translateX(-50%)",
      zIndex: 70, maxWidth: 380, width: "calc(100% - 32px)",
      padding: "14px 18px",
      background: "linear-gradient(135deg, rgba(74,222,128,0.95), rgba(74,222,128,0.85))",
      color: "#0B0B0D", borderRadius: 14,
      boxShadow: "0 12px 32px -8px rgba(74,222,128,0.5)",
      display: "flex", alignItems: "center", gap: 12,
      backdropFilter: "blur(10px)",
    }}>
      <Gift size={22} strokeWidth={2.4}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.2 }}>+{MONTHLY_BONUS_TOKENS} crédit offert !</div>
        <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, marginTop: 2 }}>Bonus mensuel de fidélité</div>
      </div>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#0B0B0D", padding: 4, opacity: 0.6 }}>
        <X size={16}/>
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------
   GUEST MODE BANNER
   ------------------------------------------------------------------------- */
function GuestBanner({ onSignup }) {
  return (
    <div style={{ padding: "14px 20px 0" }}>
      <button onClick={onSignup} className="tp-card" style={{
        width: "100%", padding: 12, display: "flex", alignItems: "center", gap: 10,
        background: "linear-gradient(135deg, rgba(251,191,36,0.1), rgba(251,191,36,0.02))",
        borderColor: "rgba(251,191,36,0.3)", cursor: "pointer", textAlign: "left",
      }}>
        <AlertCircle size={16} style={{ color: "var(--warn)", flexShrink: 0 }}/>
        <div style={{ flex: 1, minWidth: 0, fontSize: 11, color: "var(--text-dim)", lineHeight: 1.4 }}>
          <b style={{ color: "var(--warn)" }}>Mode invité</b> · Vos données seront perdues si vous changez de téléphone. <b style={{ color: "var(--text)" }}>Créez un compte</b> pour les sauvegarder.
        </div>
        <ChevronRight size={14} style={{ color: "var(--muted)", flexShrink: 0 }}/>
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------
   BOTTOM NAV
   ------------------------------------------------------------------------- */
function BottomNav({ active, onChange, onVoice }) {
  return (
    <nav className="tp-nav">
      <NavItem icon={Home} label="Accueil" active={active === "home"} onClick={() => onChange("home")}/>
      <NavItem icon={FileText} label="Courses" active={active === "bookings"} onClick={() => onChange("bookings")}/>
      <button className="tp-nav-mic" onClick={onVoice} aria-label="Dictée vocale">
        <Mic size={22} strokeWidth={2.2}/>
      </button>
      <NavItem icon={Receipt} label="Factures" active={active === "invoices"} onClick={() => onChange("invoices")}/>
      <NavItem icon={UserIcon} label="Profil" active={active === "profile" || active === "tokens"} onClick={() => onChange("profile")}/>
    </nav>
  );
}

function NavItem({ icon: Icon, label, active, onClick, badge, badgeColor }) {
  return (
    <button className={`tp-nav-item ${active ? "active" : ""}`} onClick={onClick} style={{ background: "none", border: "none", position: "relative" }}>
      <div style={{ position: "relative" }}>
        <Icon size={20} strokeWidth={active ? 2.2 : 1.8}/>
        {badge && (
          <div style={{
            position: "absolute", top: -4, right: -6,
            minWidth: 14, height: 14, borderRadius: 7,
            background: badgeColor === "error" ? "var(--error)" : "var(--accent)",
            color: "var(--accent-on)", fontSize: 9, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
          }}>{badge}</div>
        )}
      </div>
      <span>{label}</span>
    </button>
  );
}

/* -------------------------------------------------------------------------
   MAIN APP
   ------------------------------------------------------------------------- */

// Préférences utilisateur par défaut
const DEFAULT_PREFERENCES = {
  language: "fr", currency: "EUR", theme: "light", defaultGps: "ask",
  notifRides: true, notifInvoices: true, notifMarketing: false,
  // Quand recevoir les rappels avant une course (offsets sélectionnés
  // depuis ALL_REMINDER_OFFSETS dans notifications.js).
  reminderOffsets: ['T3h', 'T1h', 'T15m'],
  vatRate: 10, autoNumbering: true,
  // biometric : par défaut désactivée. Sera lue depuis Capacitor Preferences
  // au démarrage via le useEffect qui appelle isBiometricEnabled() — on ne
  // veut PAS afficher "Activée" sans avoir réellement enregistré une empreinte.
  biometric: false, autoBackup: true,
};

// Convertit une ligne `bookings` Supabase vers le format utilisé côté React.
// Le code historique manipule des objets en camelCase ; la DB est en snake_case.
function bookingFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    customerName: row.customer_name,
    phone: row.customer_phone || "",
    customerEmail: row.customer_email || "",
    customerAddress: row.customer_address || "",
    customerCompany: row.customer_company || "",
    pickupAddress: row.pickup_address,
    dropoffAddress: row.dropoff_address,
    dateTime: row.pickup_datetime ? row.pickup_datetime.slice(0, 16) : "",
    passengers: row.passengers || 1,
    hasLuggage: !!row.has_luggage,
    childSeat: !!row.child_seat,
    distance: row.distance_km ? Number(row.distance_km) : 0,
    duration: row.duration_min || 0,
    price: row.price_ttc ? Number(row.price_ttc) : 0,
    notes: row.notes || "",
    type: row.type || "manual",
    status: row.status || "pending",
    createdAt: row.created_at,
  };
}

function invoiceFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    number: row.invoice_number,
    bookingId: row.booking_id,
    customerName: row.customer_name,
    amount: row.amount_ttc ? Number(row.amount_ttc) : 0,
    vatAmount: row.amount_vat ? Number(row.amount_vat) : 0,
    // Taux réel de la ligne : 10 % pour une course (transport de personnes),
    // 20 % pour un achat de crédits (prestation numérique). Sans ça, le détail
    // et le PDF affichaient « TVA 10 % » sur un montant calculé à 20 %.
    vatRate: row.vat_rate != null ? Number(row.vat_rate) : 10,
    date: row.issued_at ? row.issued_at.slice(0, 10) : "",
    status: row.status || "pending",
    fingerprint: row.fingerprint,
  };
}

// Une facture d'ACHAT de crédits (TRP-…, générée par les webhooks de paiement)
// n'est PAS une facture de vente du chauffeur : il y est le client, pas
// l'émetteur. Elle ne doit donc jamais apparaître dans « Factures », ni dans
// le chiffre d'affaires, ni dans l'export comptable des ventes.
const isSalesInvoice = (inv) => !!inv && (!!inv.bookingId || String(inv.number || '').startsWith('FAC-'));

function tokenTxFromDb(row) {
  if (!row) return null;
  // Mapping vers le format historique côté React (champ "tokens", "package", etc.)
  const isCredit = row.tokens_delta > 0;
  const labels = {
    welcome: "Bienvenue",
    purchase: row.package_id ? `Pack ${row.package_id}` : "Achat de crédits",
    monthly_bonus: "Fidélité mensuelle",
    referral_bonus: "Bonus parrainage",
    admin_credit: "Crédit administrateur",
    consume_booking: "Bon de course créé",
    consume_invoice: "Facture émise",
    refund: "Remboursement",
    expiration: "Expiration",
  };
  return {
    id: row.id,
    invoiceNumber: row.invoice_number || (row.kind === 'welcome' ? 'OFFERT' : (row.kind?.startsWith('consume') ? '—' : 'BONUS')),
    date: row.created_at ? row.created_at.slice(0, 10) : "",
    package: labels[row.kind] || row.kind,
    tokens: row.tokens_delta,
    priceTTC: row.amount_ttc ? Number(row.amount_ttc) : 0,
    priceHT: row.amount_ht ? Number(row.amount_ht) : 0,
    vatAmount: row.amount_vat ? Number(row.amount_vat) : 0,
    vatApplied: !!row.vat_applied,
    vatIntra: row.vat_intra || "",
    paymentMethod: row.payment_method || (isCredit ? "Bonus" : "—"),
    isWelcome: ['welcome', 'monthly_bonus', 'referral_bonus'].includes(row.kind),
    kind: row.kind,
  };
}

function profileFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone || "",
    siret: row.siret,
    // Champs métier éditables — vrai contenu DB, plus DRIVER_PROFILE
    companyName: row.company_name || "",
    evtcNumber: row.evtc_number || "",
    proCardNumber: row.pro_card_number || "",
    vehicleModel: row.vehicle_model || "",
    vehiclePlate: row.vehicle_plate || "",
    iban: row.iban || "",
    vatIntra: row.vat_intra || "",
    // Parrainage / vérifs
    referralCode: row.referral_code,
    referredBy: row.referred_by,
    createdAt: row.created_at,
    lastMonthlyBonus: row.last_monthly_bonus,
    referralStats: {
      invitedCount: row.referrals_count || 0,
      tokensEarned: 0,
      friends: [],
    },
    phoneVerified: false,
    emailVerified: !!row.email_verified,
    siretVerified: !!row.siret_verified,
    vtcLicenseVerified: !!row.evtc_verified,
    avatarUrl: row.avatar_url || null,
    deviceFingerprint: row.device_fingerprint,
    deviceRegisteredAt: row.created_at,
    riskScore: row.risk_score || 0,
    flagged: !!row.flagged,
    tokenBalance: row.token_balance || 0,
  };
}

/* -------------------------------------------------------------------------
   SPLASH SCREEN — démarrage premium (façon Planity / Uber)
   -------------------------------------------------------------------------
   Logo centré (fondu + léger zoom, ~600ms) + barre de progression très fine
   pendant que l'app précharge (session, profil, préférences, thème, données).
   Durée minimale 1s pour une sensation premium, puis sortie fondu + glissement
   vers l'écran suivant (aucun écran blanc : même fond que l'app). Si la
   connexion manque et que le boot cale, affiche un écran de reprise élégant. */
function SplashScreen({ ready, online, onRetry, onFinish }) {
  const [minElapsed, setMinElapsed] = useState(false);   // durée mini premium atteinte
  const [showOffline, setShowOffline] = useState(false); // boot calé + hors-ligne
  const [exiting, setExiting] = useState(false);         // animation de sortie en cours
  const exitStartedRef = useRef(false);                  // garde : sortie déclenchée une seule fois

  // Durée minimale de 1s (sensation premium même si le chargement est instantané).
  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), 1000);
    return () => clearTimeout(t);
  }, []);

  // Filet de sécurité : si le boot n'est pas prêt ET qu'on est hors-ligne
  // depuis > 2,2s, on propose un écran de reprise. Dès que la connexion
  // revient (ou que le boot aboutit), on le masque.
  useEffect(() => {
    if (ready) { setShowOffline(false); return; }
    if (online) { setShowOffline(false); return; }
    const t = setTimeout(() => setShowOffline(true), 2200);
    return () => clearTimeout(t);
  }, [online, ready]);

  // Sortie : prêt + durée mini écoulée + pas d'écran d'erreur → fade + slide.
  // ⚠️ On ne met PAS `exiting` en dépendance et on ne nettoie PAS le timeout :
  // sinon la ré-exécution de l'effet (quand `exiting` passe à true) annulerait
  // le setTimeout avant qu'`onFinish` ne s'exécute → splash bloqué invisible.
  // Le ref garantit un déclenchement unique.
  useEffect(() => {
    if (ready && minElapsed && !showOffline && !exitStartedRef.current) {
      exitStartedRef.current = true;
      setExiting(true);
      setTimeout(() => onFinish(), 440);
    }
  }, [ready, minElapsed, showOffline, onFinish]);

  return (
    <div
      className={exiting ? "splash-exit" : undefined}
      style={{
        position: "absolute", inset: 0, zIndex: 3000,
        background: "var(--bg-gradient)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: 24, textAlign: "center",
        paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="splash-logo-in">
        <AppLogo size={96}/>
      </div>

      {showOffline ? (
        <div className="tp-fade-in" style={{ marginTop: 30, maxWidth: 260 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 12, background: "var(--error-soft)", color: "var(--error)", marginBottom: 12 }}>
            <Cloud size={20}/>
          </div>
          <div className="tp-serif" style={{ fontSize: 18, fontWeight: 600, color: "var(--text)" }}>Pas de connexion</div>
          <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6, lineHeight: 1.5 }}>
            Vérifiez votre connexion Internet, puis réessayez.
          </div>
          <button onClick={onRetry} className="tp-btn tp-btn-primary" style={{ marginTop: 18, padding: "11px 22px", borderRadius: 13 }}>
            <Loader2 size={15}/> Réessayer
          </button>
        </div>
      ) : (
        <div className="splash-track" style={{ marginTop: 30 }} role="progressbar" aria-label="Chargement">
          <span/>
        </div>
      )}
    </div>
  );
}

export default function App() {
  // --- Auth state ---
  // Splash animé au démarrage : reste affiché tant que le boot n'est pas prêt
  // (min. 1s), puis se retire en fondu/glissement pour révéler l'écran suivant.
  const [splashActive, setSplashActive] = useState(true);
  // Course actuellement « en route » (chauffeur en chemin vers le client) →
  // active le suivi GPS live sur le hero de l'Accueil. null = aucune.
  const [activeTripId, setActiveTripId] = useState(null);
  // authScreen: "welcome" | "login" | "signup" | "device_blocked" | null
  const [authScreen, setAuthScreen] = useState("welcome");
  const [currentUser, setCurrentUser] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [blockedAccountInfo, setBlockedAccountInfo] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  // Verrou anti-réentrance sur les actions qui consomment un crédit : sur
  // réseau lent, un double-tap déclenchait deux fois la même action (2 bons
  // créés, 2 crédits débités, ou 2 factures pour une même course).
  const busyActionRef = useRef(null);
  // Retour du lien « Mot de passe oublié » : impose le choix d'un nouveau
  // mot de passe avant tout accès à l'app.
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  // --- Détection réseau (Wi-Fi / cellulaire / hors-ligne) ---
  // Branche @capacitor/network sur mobile, navigator.onLine en web.
  // Affiche un badge "Hors-ligne" en haut quand la connexion tombe.
  useEffect(() => {
    let unsub = () => {};
    let mounted = true;
    watchNetwork((connected) => {
      if (mounted) setIsOnline(connected);
    }).then((u) => { if (mounted) unsub = u; else u(); });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  // --- App state ---
  const [tab, setTab] = useState("home");
  const [bookings, setBookings] = useState(INITIAL_BOOKINGS);
  const [invoices, setInvoices] = useState(INITIAL_INVOICES);
  // Factures de VENTE uniquement (voir isSalesInvoice) : c'est ce qui alimente
  // l'écran Factures, le chiffre d'affaires et l'export comptable. Les factures
  // d'ACHAT de crédits (TRP-) restent consultables dans l'historique Jetons.
  const salesInvoices = useMemo(() => invoices.filter(isSalesInvoice), [invoices]);
  const [tokenBalance, setTokenBalance] = useState(INITIAL_TOKEN_BALANCE);
  const [tokenHistory, setTokenHistory] = useState(INITIAL_TOKEN_HISTORY);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);

  // ─── Paramètres de facturation (logo, toggles SIRET / VTC) ────────────
  // Stockés dans `users.invoice_settings JSONB` côté Supabase.
  // Chargés au login + rafraîchis quand le user les modifie via Settings.
  const [invoiceSettings, setInvoiceSettings] = useState({
    logo_data_url: null,
    show_siret: true,
    show_vtc_number: true,
  });

  // --- UI state ---
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState(null);
  const [detailBooking, setDetailBooking] = useState(null);
  const [detailInvoice, setDetailInvoice] = useState(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [purchaseDetail, setPurchaseDetail] = useState(null);
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [pendingActionLabel, setPendingActionLabel] = useState("");
  const [monthlyBonusOpen, setMonthlyBonusOpen] = useState(false);

  const isAuthenticated = !!currentUser || isGuest;

  // --- Persistance du solde invité ---
  // Dès que tokenBalance change en mode invité, on l'écrit dans Preferences
  // (Capacitor sur mobile, localStorage en web). Comme ça si l'utilisateur
  // ferme l'app, à la réouverture il retrouve son solde réel — pas de remise
  // à 5 gratuite.
  useEffect(() => {
    if (!isGuest) return;
    preferencesSet('guest_token_balance', String(Math.max(0, tokenBalance))).catch(() => {});
  }, [tokenBalance, isGuest]);

  // --- Biométrie : sync l'état "activée/désactivée" depuis Capacitor
  //     Preferences au démarrage de l'app. Sur le web (Vite dev) le helper
  //     retourne toujours false, donc le toggle reste "off" et grisé pour
  //     indiquer que la fonction n'est dispo que sur mobile.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const enabled = await isBiometricEnabled();
      if (cancelled) return;
      setPreferences((p) => ({ ...p, biometric: enabled }));
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Restauration du thème au démarrage ────────────────────────────
  // Le choix sombre/clair est persisté via Capacitor Preferences.
  // On le restaure ici en appliquant data-theme sur :root + en
  // synchronisant l'état React. Sans ce useEffect, l'utilisateur perd
  // son choix à chaque relance d'app.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await preferencesGet('theme');
        if (cancelled) return;
        // Défaut = clair (posé dans main.jsx). On ne bascule en sombre que
        // si l'utilisateur l'a explicitement choisi dans les Réglages.
        if (saved === 'dark') {
          document.documentElement.removeAttribute('data-theme');
          setPreferences((p) => ({ ...p, theme: 'dark' }));
        } else {
          document.documentElement.setAttribute('data-theme', 'light');
          setPreferences((p) => ({ ...p, theme: 'light' }));
        }
        // GPS par défaut (Google Maps / Waze / Plans / demander à chaque fois).
        try {
          const gps = await preferencesGet('defaultGps');
          if (gps && !cancelled) setPreferences((p) => ({ ...p, defaultGps: gps }));
        } catch {}
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // --- Préférence "Rappel de courses" : si désactivée → annule tout,
  //     si réactivée → replanifie tout.
  // 🐛 BUG fixé : `bookings.length` était absent du tableau de deps → l'effet
  // ne se relançait jamais après le chargement des courses depuis Supabase
  // → AUCUNE notification n'était programmée. Ajout de `bookings.length`
  // dans les deps + demande de permission iOS au premier programme de notif
  // (sinon le système rejette silencieusement le schedule).
  useEffect(() => {
    if (!isAuthenticated || isGuest) return;
    const upcoming = bookings.filter((b) => {
      const t = new Date(b.dateTime);
      return t.getTime() > Date.now() && b.status !== 'cancelled' && b.status !== 'completed';
    });
    // Demande explicite de la permission notification quand on a quelque
    // chose à programmer. Sans ça, iOS bloque silencieusement les schedule
    // si l'utilisateur n'a jamais accepté la popup système au démarrage.
    if (preferences.notifRides && upcoming.length > 0) {
      ensureNotificationPermission().catch(() => {});
    }
    rescheduleAllBookings(upcoming, {
      enabled: !!preferences.notifRides,
      selectedKeys: preferences.reminderOffsets,
    })
      .catch((e) => console.warn('reschedule on prefs change:', e?.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences.notifRides, preferences.reminderOffsets, bookings.length]);

  // --- Chargement des données utilisateur depuis Supabase ---
  // Appelé après login (ou au reload si la session existait déjà).
  // Charge profil + bookings + invoices + token_transactions.
  // Crédite aussi le bonus de parrainage si c'est la première connexion d'un filleul.
  // Retourne true si le chargement a abouti (currentUser set), false sinon.
  // Le caller doit utiliser ce retour pour décider de quitter l'écran welcome.
  const loadUserData = async (authUserId) => {
    if (!authUserId) return false;
    setDataLoading(true);
    try {
      // Profil (avec retry court : le trigger SQL crée le profil juste après le signup,
      // mais à la 1re connexion il peut y avoir 100-300ms de race)
      let profileRow = null;
      for (let attempt = 0; attempt < 5 && !profileRow; attempt++) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUserId)
          .maybeSingle();
        if (!error && data) profileRow = data;
        else if (attempt < 4) await new Promise(r => setTimeout(r, 250));
      }
      if (!profileRow) {
        console.error("Profil introuvable après login — trigger handle_new_auth_user a peut-être échoué");
        setDataLoading(false);
        return false;
      }
      const profile = profileFromDb(profileRow);

      // Crédit du bonus de parrainage si c'est la 1re connexion d'un filleul.
      // `profile.referredBy` est l'UUID du parrain (resolu côté trigger SQL
      // à partir du code saisi). On crédite si ce filleul n'a pas encore reçu
      // de transaction `referral_bonus`.
      if (profile.referredBy && profile.referredBy !== authUserId) {
        const { data: existing } = await supabase
          .from('token_transactions')
          .select('id')
          .eq('user_id', authUserId)
          .eq('kind', 'referral_bonus')
          .limit(1);
        if (!existing || existing.length === 0) {
          try {
            await creditReferralBonus(profile.referredBy, authUserId);
          } catch (e) {
            console.warn("Crédit parrainage échoué :", e?.message);
          }
        }
      }

      // Bonus mensuel (le helper signIn() l'appelle déjà côté login,
      // mais on rappelle ici au cas où on rentre via session restaurée)
      try {
        await supabase.rpc('credit_monthly_bonus', { p_user_id: authUserId });
      } catch (_) { /* silencieux */ }

      // Recharge le profil pour avoir le solde à jour (après bonus parrainage/mensuel)
      const { data: refreshed } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUserId)
        .single();
      const finalProfile = profileFromDb(refreshed || profileRow);

      // ─── Verrou biométrie : empêcher la connexion d'un AUTRE compte ──
      // Si la biométrie a été activée pour un user spécifique sur cet
      // appareil, on refuse toute autre session. Cas typique : l'utilisateur
      // a activé Face ID sur le compte A, se déconnecte, et redéclenche
      // Sign-in with Apple. Apple/iCloud peut suggérer un autre Apple ID
      // (compte B) → ici on bloque et on force un sign-out + message clair.
      const lockedUserId = await getBiometricUserId();
      if (lockedUserId && lockedUserId !== finalProfile.id) {
        alert(
          'Cet appareil est verrouillé par Face ID pour un autre compte ' +
          'TrajetPro.\n\nDeux options :\n' +
          '• Vous reconnecter au compte d\'origine.\n' +
          '• OU désactiver Face ID dans Profil → Préférences → Biométrie ' +
          'depuis ce compte d\'origine.'
        );
        await supabase.auth.signOut();
        setDataLoading(false);
        return false;
      }

      // Bookings + Invoices + Token transactions en parallèle
      const [bookingRows, invoiceRows, tokenRows] = await Promise.all([
        sbLoadBookings(authUserId).catch(() => []),
        sbLoadInvoices(authUserId).catch(() => []),
        sbLoadTokenTransactions(authUserId).catch(() => []),
      ]);

      const formattedBookings = bookingRows.map(bookingFromDb).filter(Boolean);
      setCurrentUser(finalProfile);
      setBookings(formattedBookings);
      setInvoices(invoiceRows.map(invoiceFromDb).filter(Boolean));
      setTokenBalance(finalProfile.tokenBalance);
      setTokenHistory(tokenRows.map(tokenTxFromDb).filter(Boolean));

      // Re-synchronise les notifications de rappel pour TOUS les bons à venir.
      // Au cas où l'utilisateur a réinstallé l'app, changé de device, ou que
      // les timers web ont été perdus à cause d'un reload.
      try {
        if (preferences.notifRides) {
          const granted = await ensureNotificationPermission();
          if (granted) {
            await rescheduleAllBookings(
              formattedBookings.filter((b) => {
                const t = new Date(b.dateTime);
                return t.getTime() > Date.now() && b.status !== 'cancelled' && b.status !== 'completed';
              }),
              { enabled: true, selectedKeys: preferences.reminderOffsets },
            );
          }
        }
      } catch (e) {
        console.warn('Resync notifications échoué :', e?.message);
      }
      // Toutes les données sont chargées et le state React est à jour.
      return true;
    } catch (err) {
      console.error("Erreur chargement données :", err);
      return false;
    } finally {
      setDataLoading(false);
    }
  };

  // --- Gestion du retour Stripe Checkout (?purchase=success / ?purchase=cancel) ---
  // Lit l'URL au mount pour détecter le retour depuis Stripe, déclenche un
  // refresh des tokens (le webhook a quelques secondes pour traiter), affiche
  // un toast de succès, puis nettoie le query param.
  const handleCheckoutReturn = async (authUserId) => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const purchaseFlag = params.get('purchase');
    if (!purchaseFlag) return;

    // Nettoyer l'URL tout de suite pour éviter qu'un reload ne re-déclenche
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);

    if (purchaseFlag === 'cancel') {
      console.log('Paiement annulé par l\'utilisateur');
      // On ne fait rien d'autre : la PurchaseModal est fermée, on reste sur l'accueil.
      return;
    }

    if (purchaseFlag === 'success' && authUserId) {
      // Le webhook côté serveur peut prendre 1-3 secondes. On poll jusqu'à
      // ce que la transaction apparaisse, max 10 secondes.
      const sessionId = params.get('session_id');
      let purchaseTx = null;
      for (let i = 0; i < 10 && !purchaseTx; i++) {
        purchaseTx = await findPurchaseBySessionId(authUserId, sessionId);
        if (!purchaseTx) await new Promise(r => setTimeout(r, 1000));
      }
      // Refresh complet (solde + historique + factures pour avoir la nouvelle TRP-…)
      const [{ data: profile }, txs, invoiceRows] = await Promise.all([
        supabase.from('users').select('token_balance').eq('id', authUserId).single(),
        sbLoadTokenTransactions(authUserId).catch(() => []),
        sbLoadInvoices(authUserId).catch(() => []),
      ]);
      if (profile) setTokenBalance(profile.token_balance || 0);
      setTokenHistory(txs.map(tokenTxFromDb).filter(Boolean));
      setInvoices(invoiceRows.map(invoiceFromDb).filter(Boolean));
      // Petit toast simple via alert pour l'instant (à remplacer par un vrai toast UI plus tard)
      if (purchaseTx) {
        setTimeout(() => {
          alert(`✅ Paiement confirmé. ${purchaseTx.tokens_delta} crédits ajoutés à votre compte.`);
        }, 200);
      } else {
        // Le webhook n'a pas encore tourné — on prévient l'user
        setTimeout(() => {
          alert('Paiement reçu. Vos crédits arrivent dans quelques secondes (rafraîchissez si besoin).');
        }, 200);
      }
    }
  };

  // --- Auth state listener : se synchronise avec Supabase au mount + sur changements ---
  useEffect(() => {
    let mounted = true;

    // Vérifier la session existante au démarrage.
    // ⚠️ ORDRE IMPORTANT : on garde l'écran de welcome / spinner tant que
    // loadUserData() n'a pas terminé. Sinon l'utilisateur voit l'app
    // principale avec des valeurs par défaut (DRIVER_PROFILE) pendant
    // 500ms-1s pendant que le profil se charge en arrière-plan.
    (async () => {
      // Garde-fou : sur certains setups (localhost + StrictMode + HMR),
      // getSession peut se bloquer indéfiniment. Au bout de 5s, on abandonne
      // et on traite comme "pas de session" → l'utilisateur voit l'écran
      // welcome et peut se connecter normalement.
      const sessionResult = await Promise.race([
        supabase.auth.getSession(),
        new Promise((resolve) =>
          setTimeout(() => resolve({ data: { session: null }, _timeout: true }), 5000),
        ),
      ]);
      const session = sessionResult?.data?.session;
      if (sessionResult?._timeout) {
        console.warn('[AUTH] getSession timeout 5s — fallback welcome screen');
      }
      if (mounted && session?.user) {
        setIsGuest(false);
        const ok = await loadUserData(session.user.id);
        if (mounted) await handleCheckoutReturn(session.user.id);
        if (mounted && ok) setAuthScreen(null);
      }
      if (mounted) setAuthChecked(true);
    })();

    // Écouter les changements (login/logout depuis n'importe où)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        // L'utilisateur revient du lien « Mot de passe oublié » reçu par mail.
        // Supabase l'a authentifié temporairement : on lui fait choisir un
        // nouveau mot de passe avant de le laisser entrer dans l'app.
        setPasswordRecovery(true);
        return;
      }
      if (event === 'SIGNED_IN' && session?.user) {
        setIsGuest(false);
        // ⚠️ CRITIQUE : on déferre TOUT travail async via setTimeout(..., 0).
        // Sans ça, le callback async bloque le verrou interne du SDK Supabase,
        // ce qui crée un deadlock avec `getSession()` et les requêtes
        // supabase.from(...) déclenchées par loadUserData.
        // Symptôme observé : getSession ne résout jamais (timeout 5s),
        // loadUserData entre mais ne termine pas (premier `select()` bloqué).
        // Réf : https://github.com/supabase/supabase-js/issues/580
        const userId = session.user.id;
        setTimeout(async () => {
          if (!mounted) return;
          const ok = await loadUserData(userId);
          if (mounted) await handleCheckoutReturn(userId);
          if (mounted && ok) {
            setAuthScreen(null);
            setTab("home");
          }
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setIsGuest(false);
        setBookings([]);
        setInvoices([]);
        setTokenBalance(0);
        setTokenHistory([]);
        setAuthScreen("welcome");
        setTab("home");
        // L'historique d'adresses contient les domiciles des clients : il ne
        // doit pas suivre sur le compte suivant connecté depuis ce téléphone.
        clearPlacesHistory().catch(() => {});
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Auth handlers ---
  // onLogin est invoqué par LoginScreen après un sbSignIn() réussi.
  // Le useEffect ci-dessus a déjà déclenché loadUserData via onAuthStateChange,
  // mais on s'assure ici de l'UI immédiate.
  const onLogin = (user) => {
    setIsGuest(false);
    setAuthScreen(null);
    setTab("home");
    // loadUserData sera appelé automatiquement par onAuthStateChange
  };

  // onSignup n'est plus appelé directement (le SignupScreen redirige maintenant
  // vers l'écran de login après confirmation email). Conservé pour rétrocompat.
  const onSignup = () => {
    setAuthScreen("login");
  };

  const onGuest = async () => {
    setIsGuest(true);
    setCurrentUser(null);
    setAuthScreen(null);
    setTab("home");
    // Mode invité : on charge le solde de tokens persisté localement.
    // 1er passage = 5 crédits offerts. Si l'invité a déjà consommé ses crédits
    // précédemment (et fermé/rouvert l'app), on retrouve le solde réel —
    // pas de "free reload" de crédits.
    try {
      const saved = await preferencesGet('guest_token_balance');
      if (saved !== null) {
        const n = parseInt(saved, 10);
        setTokenBalance(Number.isFinite(n) ? Math.max(0, n) : 0);
      } else {
        // Premier passage en mode invité sur ce device → 5 crédits gratuits
        setTokenBalance(INITIAL_TOKEN_BALANCE);
        await preferencesSet('guest_token_balance', String(INITIAL_TOKEN_BALANCE));
        await preferencesSet('guest_first_seen_at', new Date().toISOString());
      }
    } catch (e) {
      console.warn('Lecture solde invité échouée :', e?.message);
      setTokenBalance(INITIAL_TOKEN_BALANCE);
    }
    setBookings([]);
    setInvoices([]);
    setTokenHistory([]);
  };

  const onLogout = async () => {
    if (isGuest) {
      // En mode invité, "Déconnexion" propose plutôt de créer un compte.
      // ⚠️ Il faut désactiver isGuest AVANT de changer authScreen, sinon
      // isAuthenticated reste à true et l'AuthScreens ne s'affiche pas.
      setIsGuest(false);
      setAuthScreen("signup");
      return;
    }

    // Confirmation : window.confirm peut être bloqué dans certains contextes
    // (iframe, webview, Capacitor). On utilise un try/catch défensif et on
    // continue en cas d'échec (l'utilisateur a cliqué le bouton "Déconnexion",
    // l'intention est claire).
    try {
      const ok = window.confirm(
        "Vous déconnecter ? Vos données sont sauvegardées dans le cloud, " +
        "vous pourrez les retrouver en vous reconnectant."
      );
      if (ok === false) return;
    } catch (_) {
      // confirm() indisponible → on continue quand même
    }

    // RESET IMMÉDIAT du state — on ne dépend pas de onAuthStateChange pour
    // l'UI. Si Supabase met du temps à propager, l'utilisateur voit déjà
    // l'écran de welcome.
    setCurrentUser(null);
    setIsGuest(false);
    setBookings([]);
    setInvoices([]);
    setTokenBalance(0);
    setTokenHistory([]);
    setDetailBooking(null);
    setDetailInvoice(null);
    setPurchaseOpen(false);
    setFormOpen(false);
    setVoiceOpen(false);
    setTab("home");
    setAuthScreen("welcome");

    // Annule TOUS les rappels de course en attente (sinon ils continueraient
    // à s'afficher pour un compte déconnecté).
    rescheduleAllBookings([], { enabled: false }).catch(() => {});

    // Puis on demande à Supabase de fermer la session côté serveur.
    // Si ça échoue (offline par ex.), l'utilisateur est quand même déconnecté
    // localement ; au prochain reload la session sera nettoyée.
    try {
      await sbSignOut();
    } catch (err) {
      console.warn("signOut() Supabase a échoué (déconnexion locale OK) :", err?.message);
    }
  };

  const onPromptSignup = () => {
    setIsGuest(false);
    setAuthScreen("signup");
  };

  // --- Anti-fraude : appareil déjà utilisé ---
  const onDeviceAlreadyUsed = (deviceRecord) => {
    setBlockedAccountInfo(deviceRecord);
    setAuthScreen("device_blocked");
  };

  // --- Core handlers ---
  const onVoiceConfirm = (parsed) => {
    setVoiceOpen(false);
    // Les valeurs dictées (distance, price) priment sur les défauts.
    // Sinon on tombe sur des estimations raisonnables (10 km, 20 min, 0 €).
    setFormInitial({
      duration: 20,
      notes: "",
      type: "forfait",
      ...parsed,
      // Si l'utilisateur a dicté un prix, on le respecte. Sinon on laisse
      // 0 (le formulaire calculera l'estimation automatique).
      // Idem pour la distance : 10 km par défaut.
      price: parsed.price ?? 0,
      distance: parsed.distance ?? 10,
    });
    setFormOpen(true);
  };

  // Helper : on vérifie le solde EN DB (et pas juste l'état React qui peut
  // être périmé après une longue session, un changement d'appareil, etc.)
  // avant d'afficher la modal "Insuffisant". Ainsi un user qui voit son
  // badge à 0 mais qui a en réalité 100 crédits en base ne sera plus bloqué.
  const guardEnoughTokens = async (label) => {
    if (isGuest) {
      // Mode invité : seul le solde local fait foi
      if (tokenBalance < COST_BOOKING) {
        setPendingActionLabel(label);
        setInsufficientOpen(true);
        return false;
      }
      return true;
    }
    // Mode authentifié : on resync depuis la DB pour être sûr
    if (currentUser?.id) {
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('token_balance')
          .eq('id', currentUser.id)
          .single();
        const fresh = profile?.token_balance ?? tokenBalance;
        setTokenBalance(fresh);
        if (fresh < COST_BOOKING) {
          setPendingActionLabel(label);
          setInsufficientOpen(true);
          return false;
        }
      } catch {
        // En cas d'échec on retombe sur l'état local
        if (tokenBalance < COST_BOOKING) {
          setPendingActionLabel(label);
          setInsufficientOpen(true);
          return false;
        }
      }
    }
    return true;
  };

  const onOpenVoice = async () => {
    if (!(await guardEnoughTokens("créer une nouvelle réservation"))) return;
    setVoiceOpen(true);
  };

  const onNewBooking = async () => {
    if (!(await guardEnoughTokens("créer une nouvelle réservation"))) return;
    setFormInitial(null);
    setFormOpen(true);
  };

  // --- Helper : recharge le solde + l'historique depuis Supabase ---
  // ─── Charger les paramètres de facturation au login ──────────────────
  // (logo, toggles SIRET/VTC). Re-fetch si l'user change.
  useEffect(() => {
    if (!currentUser?.id) {
      setInvoiceSettings({ logo_data_url: null, show_siret: true, show_vtc_number: true });
      return;
    }
    let cancelled = false;
    sbLoadInvoiceSettings(currentUser.id).then((s) => {
      if (!cancelled) setInvoiceSettings(s);
    });
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  // Handler pour modifier un paramètre de facturation (depuis Settings).
  // Met à jour local + Supabase de manière optimiste.
  const updateInvoiceSettings = async (updates) => {
    setInvoiceSettings((prev) => ({ ...prev, ...updates }));
    if (currentUser?.id) {
      try {
        await sbUpdateInvoiceSettings(currentUser.id, updates);
      } catch (err) {
        alert("Échec de l'enregistrement : " + (err?.message || err));
        // Recharge depuis Supabase pour annuler le changement local
        const fresh = await sbLoadInvoiceSettings(currentUser.id);
        setInvoiceSettings(fresh);
      }
    }
  };

  // Utilisé après chaque opération qui modifie token_balance via le serveur,
  // pour rester en sync avec la "source unique de vérité" (token_transactions).
  const refreshTokens = async () => {
    if (!currentUser?.id) return;
    try {
      const [{ data: profile }, txs] = await Promise.all([
        supabase.from('users').select('token_balance').eq('id', currentUser.id).single(),
        sbLoadTokenTransactions(currentUser.id).catch(() => []),
      ]);
      if (profile) setTokenBalance(profile.token_balance || 0);
      setTokenHistory(txs.map(tokenTxFromDb).filter(Boolean));
    } catch (err) {
      console.warn("Refresh tokens échoué :", err);
    }
  };

  const onSaveBooking = async (b) => {
    // Anti-réentrance (double-tap sur réseau lent) — complète le verrou visuel
    // du bouton dans BookingForm.
    if (busyActionRef.current === `save:${b.id}`) return;
    busyActionRef.current = `save:${b.id}`;
    try {
      await doSaveBooking(b);
    } finally {
      busyActionRef.current = null;
    }
  };

  const doSaveBooking = async (b) => {
    if (isGuest) {
      // Mode invité : pas de persistance, juste local
      setBookings(prev => {
        const exists = prev.find(p => p.id === b.id);
        if (exists) return prev.map(p => p.id === b.id ? b : p);
        return [b, ...prev];
      });
      setFormOpen(false);
      setFormInitial(null);
      setTab("bookings");
      return;
    }
    if (!currentUser?.id) return;

    const isNew = !bookings.find(p => p.id === b.id);
    if (isNew && tokenBalance < COST_BOOKING) {
      setFormOpen(false);
      setPendingActionLabel("créer ce bon de course");
      setInsufficientOpen(true);
      return;
    }

    try {
      if (isNew) {
        const created = await sbCreateBooking(currentUser.id, b);
        const formatted = bookingFromDb(created);
        setBookings(prev => [formatted, ...prev]);
        await refreshTokens();
        // Programme les rappels (T-3h, T-1h, T-15m) si l'utilisateur le veut.
        if (preferences.notifRides) {
          ensureNotificationPermission()
            .then((granted) => granted && scheduleBookingReminders(formatted, { selectedKeys: preferences.reminderOffsets }))
            .catch((e) => console.warn('schedule:', e?.message));
        }
      } else {
        await sbUpdateBooking(b.id, b);
        setBookings(prev => prev.map(p => p.id === b.id ? b : p));
        // L'heure ou le client a peut-être changé : on annule + replanifie.
        if (preferences.notifRides) {
          scheduleBookingReminders(b, { selectedKeys: preferences.reminderOffsets })
            .catch((e) => console.warn('reschedule:', e?.message));
        } else {
          cancelBookingReminders(b.id).catch(() => {});
        }
      }
      setFormOpen(false);
      setFormInitial(null);
      setTab("bookings");
    } catch (err) {
      const msg = err?.message || "Erreur lors de l'enregistrement";
      if (/cr[ée]dits insuffisants/i.test(msg)) {
        setFormOpen(false);
        setPendingActionLabel("créer ce bon de course");
        setInsufficientOpen(true);
      } else if (/factur[ée]/i.test(msg)) {
        // Filet serveur : le trigger a refusé la modif d'un bon déjà facturé.
        setFormOpen(false);
        setFormInitial(null);
        alert("Ce bon a déjà été facturé : ses informations ne peuvent plus être modifiées (conformité fiscale).\n\nUtilisez « Dupliquer » pour une nouvelle course.");
      } else {
        alert(`Erreur : ${msg}`);
      }
    }
  };

  const onDeleteBooking = async (b) => {
    if (!confirm(`Supprimer le bon pour ${b.customerName} ?`)) return;

    if (isGuest || !currentUser?.id) {
      setBookings(prev => prev.filter(p => p.id !== b.id));
      setDetailBooking(null);
      return;
    }

    try {
      await sbDeleteBooking(b.id);
      setBookings(prev => prev.filter(p => p.id !== b.id));
      setDetailBooking(null);
      // Annule les rappels associés (T-3h / T-1h / T-15m)
      cancelBookingReminders(b.id).catch((e) => console.warn('cancel:', e?.message));
    } catch (err) {
      alert(`Erreur lors de la suppression : ${err?.message || err}`);
    }
  };

  const onInvoiceBooking = async (b) => {
    // Anti double-tap : facturer deux fois le même bon créerait deux factures
    // (deux numéros consommés, 2 crédits) ou remonterait une erreur Postgres
    // brute à l'écran.
    if (busyActionRef.current === `invoice:${b.id}`) return;
    busyActionRef.current = `invoice:${b.id}`;
    try {
      await doInvoiceBooking(b);
    } finally {
      busyActionRef.current = null;
    }
  };

  const doInvoiceBooking = async (b) => {
    if (tokenBalance < COST_INVOICE) {
      setPendingActionLabel("émettre cette facture");
      setInsufficientOpen(true);
      return;
    }

    if (isGuest || !currentUser?.id) {
      // Mode invité : facture en mémoire uniquement
      const nextNumber = `FAC-2026-${String(89 + invoices.length).padStart(4, "0")}`;
      const newInvoice = {
        id: genId(), number: nextNumber, bookingId: b.id,
        customerName: b.customerName, amount: b.price,
        vatAmount: +(b.price * (DRIVER_PROFILE.vatRate / 100) / (1 + DRIVER_PROFILE.vatRate / 100)).toFixed(2),
        date: new Date().toISOString().slice(0, 10),
        status: "pending",
        fingerprint: genFingerprint(),
      };
      setInvoices(prev => [newInvoice, ...prev]);
      setTokenBalance(t => t - COST_INVOICE);
      setDetailBooking(null);
      setTab("home");
      setDetailInvoice(newInvoice);
      return;
    }

    try {
      const created = await sbCreateInvoice(currentUser.id, b);
      const formatted = invoiceFromDb(created);
      setInvoices(prev => [formatted, ...prev]);
      await refreshTokens();
      setDetailBooking(null);
      setTab("home");
      setDetailInvoice(formatted);
    } catch (err) {
      const msg = err?.message || "Erreur lors de l'émission";
      if (/cr[ée]dits insuffisants/i.test(msg)) {
        setPendingActionLabel("émettre cette facture");
        setInsufficientOpen(true);
      } else {
        alert(`Erreur : ${msg}`);
      }
    }
  };

  const onPurchaseConfirm = async (purchase) => {
    // Sécurité (audit 2026-05-06) : en mode invité, NE PAS créditer
    // automatiquement. Avant ce fix, cliquer sur "Payer" crédite le compte
    // sans aucun paiement réel — trompeur (UI dit "Payer X €") et risque
    // rejet App Store règle 2.3.1 (UI/fonctionnalité non conforme à ce
    // qu'elle prétend). On force la création de compte avant tout achat.
    if (isGuest || !currentUser?.id) {
      setPurchaseOpen(false); // ferme la modale d'achat
      const wantsSignup = window.confirm(
        "🔒 Achat de crédits réservé aux comptes inscrits\n\n" +
        "Pour acheter des crédits, vous devez créer un compte gratuit.\n\n" +
        "Avantages d'un compte :\n" +
        "  • Vos données sont sauvegardées dans le cloud\n" +
        "  • Vos factures sont conservées 10 ans (CGI)\n" +
        "  • Vous recevez 5 crédits offerts à l'inscription\n" +
        "  • Vous bénéficiez du bonus mensuel +1 crédit\n\n" +
        "Créer un compte maintenant ?"
      );
      if (wantsSignup) {
        onPromptSignup();
      }
      // On ne crédite PAS, on ne lance pas de Stripe.
      throw new Error("Compte requis pour acheter des crédits");
    }

    const packageId = purchase.packageId || purchase.package_id;
    if (!packageId) throw new Error("Pack inconnu (packageId manquant)");

    // ─── FLOW IN-APP PURCHASE (iOS uniquement, requis par la règle App Store
    // 3.1.1 — tout contenu numérique consommé dans l'app doit passer par
    // StoreKit, pas par Stripe/Apple Pay). Aucun choix de moyen de paiement
    // côté app sur iOS : Apple affiche sa propre sheet de paiement.
    // Le webhook revenuecat-webhook reçoit l'événement d'achat confirmé
    // (RevenueCat a lui-même validé le reçu auprès d'Apple) → crédite + facture.
    if (isInAppPurchaseAvailable()) {
      const result = await purchasePack(packageId, currentUser.id);
      if (result.cancelled) {
        // Annulation par l'utilisateur sur la sheet → silence + retour modal
        throw new Error("Compte requis");
      }
      if (result.notAvailable) {
        // Pas de fallback Stripe ici : proposer un autre moyen de paiement
        // à l'intérieur de l'app iOS violerait la même règle qu'on respecte.
        throw new Error(result.reason || "Achat via l'App Store indisponible.");
      }
      if (!result.ok) {
        throw new Error(result.reason || "Achat échoué");
      }
      // Succès : le webhook va créditer en async (quelques secondes).
      setTimeout(() => { refreshTokens().catch(() => {}); }, 1500);
      return purchase;
    }

    // ─── FLOW APPLE PAY NATIF (dormant — conservé au cas où, plus jamais
    // sélectionnable depuis l'UI puisque le picker "Apple Pay" a été retiré
    // au profit d'In-App Purchase ci-dessus sur iOS). ──────────────────
    const wantApplePay = (purchase.paymentMethod === "Apple Pay");
    if (wantApplePay && isNativePlatform()) {
      const result = await payWithApplePay(packageId);
      if (result.cancelled) {
        // Annulation par l'utilisateur sur la sheet → silence + retour modal
        throw new Error("Compte requis");
      }
      if (result.notAvailable) {
        // Apple Pay indisponible : au lieu d'un fallback silencieux qui
        // donne l'illusion que le bouton ne marche pas, on demande
        // explicitement à l'utilisateur s'il veut basculer sur le paiement
        // par carte (Stripe Checkout web).
        const fallback = window.confirm(
          `Apple Pay non disponible :\n\n${result.reason}\n\n` +
          `Voulez-vous payer par carte bancaire à la place ?`
        );
        if (!fallback) {
          throw new Error("Compte requis"); // ferme la modal sans alert
        }
        const { url } = await createCheckoutSession(packageId);
        if (!url) throw new Error("URL Stripe manquante");
        window.location.assign(url);
        return new Promise(() => {});
      }
      if (!result.ok) {
        throw new Error(result.reason || "Apple Pay échoué");
      }
      // Succès : le webhook va créditer en async (~1-2s).
      setTimeout(() => { refreshTokens().catch(() => {}); }, 1500);
      return purchase;
    }

    // ─── FLOW STRIPE CHECKOUT WEB (carte / fallback web / Android) ────
    // Redirection externe vers la page Stripe hostée. Le webhook reçoit
    // checkout.session.completed → crédite + facture. Au retour sur
    // success_url, le useEffect détecte ?purchase=success et rafraîchit.
    const { url } = await createCheckoutSession(packageId);
    if (!url) throw new Error("URL Stripe manquante");
    window.location.assign(url);
    return new Promise(() => { /* never resolves */ });
  };

  const onInsufficientBuy = () => {
    setInsufficientOpen(false);
    setPurchaseOpen(true);
  };

  // ─── Suppression de compte (RGPD + App Store règle 5.1.1(v)) ─────────
  // 2 confirmations consécutives car action irréversible.
  const handleDeleteAccount = async () => {
    if (isGuest) {
      alert("Vous êtes en mode invité — il n'y a pas de compte à supprimer. Pour effacer vos données locales, désinstallez l'app.");
      return;
    }

    const confirm1 = window.confirm(
      "⚠️ ATTENTION — Action irréversible\n\n" +
      "Vous êtes sur le point de supprimer DÉFINITIVEMENT votre compte TrajetPro.\n\n" +
      "Tous vos bons de course, factures et crédits seront effacés.\n" +
      "Vous ne pourrez PAS récupérer ces données ensuite.\n\n" +
      "Continuer ?"
    );
    if (!confirm1) return;

    const typed = window.prompt(
      "Pour confirmer, tapez exactement le mot SUPPRIMER (en majuscules) :"
    );
    if (typed !== "SUPPRIMER") {
      alert("Suppression annulée — vous n'avez pas tapé SUPPRIMER.");
      return;
    }

    try {
      const result = await sbDeleteMyAccount();
      alert(
        `✅ Compte supprimé.\n\n` +
        `${result.deleted_invoices || 0} facture(s), ${result.deleted_bookings || 0} bon(s), ` +
        `${result.deleted_transactions || 0} transaction(s) effacés.\n\n` +
        `Au revoir.`
      );
      // Force le retour à l'écran de bienvenue. On ne peut pas appeler
      // signOut() classique vu que la session est déjà invalidée côté
      // serveur — on triggère juste le reload qui repassera par le flow
      // de boot et trouvera "pas de session" → écran Welcome.
      window.location.reload();
    } catch (err) {
      alert("Erreur lors de la suppression : " + (err?.message || err));
    }
  };

  const onChangePref = async (key, value) => {
    // Cas spécial : la biométrie nécessite un vrai prompt système Face ID
    // / Touch ID via le plugin Capacitor. On bypass le mapping normal pour
    // déclencher le bon flow + persister via Capacitor Preferences (et pas
    // dans l'objet `preferences` côté React, qui est en mémoire seulement).
    if (key === 'bio') {
      if (value) {
        // L'utilisateur veut activer : on prompt Face ID + on lie le user_id
        // courant à la biométrie. Sans cela, la prochaine connexion via
        // Sign-in with Apple pourrait restaurer un AUTRE compte (ex : iCloud
        // Keychain qui propose un Apple ID différent) et l'app serait
        // déverrouillée pour le mauvais user.
        if (!currentUser?.id) {
          alert('Connectez-vous d\'abord avant d\'activer la biométrie.');
          return;
        }
        const result = await enableBiometric(currentUser.id);
        if (!result.ok) {
          alert(result.reason || 'Activation de la biométrie échouée.');
          return;
        }
      } else {
        await disableBiometric();
      }
      setPreferences(p => ({ ...p, biometric: value }));
      return;
    }

    // Cas spécial : thème — applique IMMÉDIATEMENT data-theme sur :root
    // pour que toutes les variables CSS basculent (charte sombre ↔ claire).
    // Persiste via Capacitor Preferences pour conserver le choix entre
    // les sessions (sinon retombe en mode sombre par défaut au reboot).
    if (key === 'theme') {
      const newTheme = value ? 'light' : 'dark';
      if (newTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      try { await preferencesSet('theme', newTheme); } catch {}
      setPreferences(p => ({ ...p, theme: newTheme }));
      return;
    }

    // GPS par défaut : persiste via Capacitor Preferences (comme le thème) pour
    // conserver le choix entre les sessions.
    if (key === 'defaultGps') {
      try { await preferencesSet('defaultGps', value); } catch { /* best effort */ }
      setPreferences(p => ({ ...p, defaultGps: value }));
      return;
    }

    const mapping = {
      lang: "language", currency: "currency",
      notif_rides: "notifRides", notif_invoices: "notifInvoices", notif_marketing: "notifMarketing",
      vat: "vatRate", autonum: "autoNumbering",
      bio: "biometric", backup: "autoBackup",
    };
    const realKey = mapping[key] || key;
    const realValue = realKey === "vatRate" ? parseInt(value) : value;
    setPreferences(p => ({ ...p, [realKey]: realValue }));
  };

  // --- Routing ---
  // Loading state pendant que getSession() + loadUserData() s'exécutent.
  // Sans ça, l'utilisateur voit l'écran de bienvenue PENDANT que la session
  // se restaure (~500ms à 2s) et clique impatient sur "Se connecter",
  // déclenchant un signInWithPassword qui se met en concurrence avec
  // getSession et provoque deadlock + double SIGNED_IN.
  // Splash animé premium : reste tant que le boot n'est pas prêt (min 1s),
  // puis se retire en fondu/glissement. `ready={authChecked}` = préchargement
  // terminé (session, profil, préférences, thème, données). Aucun écran blanc :
  // même fond que l'app, et l'écran suivant est déjà décidé quand on révèle.
  if (splashActive) {
    return (
      <>
        <GlobalStyles/>
        <div className="tp-root">
          <div className="tp-phone">
            <SplashScreen
              ready={authChecked}
              online={isOnline}
              onRetry={() => window.location.reload()}
              onFinish={() => setSplashActive(false)}
            />
          </div>
        </div>
      </>
    );
  }

  // Retour du lien de réinitialisation : on bloque l'accès à l'app tant que
  // le nouveau mot de passe n'est pas choisi (la session ouverte par le lien
  // n'est destinée qu'à ça).
  if (passwordRecovery) {
    return (
      <>
        <GlobalStyles/>
        <div className="tp-root">
          <div className="tp-phone">
            <NewPasswordScreen onDone={() => setPasswordRecovery(false)}/>
          </div>
        </div>
      </>
    );
  }

  // Auth flow d'abord
  if (!isAuthenticated && authScreen) {
    return (
      <>
        <GlobalStyles/>
        <div className="tp-root">
          <div className="tp-phone">
            {!isOnline && (
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, zIndex: 1200,
                padding: "8px 14px", background: "rgba(248,113,113,0.95)",
                color: "#0B0B0D", fontSize: 12, fontWeight: 700, textAlign: "center",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                <Cloud size={13}/> Hors-ligne — connexion requise pour s'identifier
              </div>
            )}
            <AuthScreens
              mode={authScreen}
              onChangeMode={setAuthScreen}
              onLogin={onLogin}
              onSignup={onSignup}
              onGuest={onGuest}
              onDeviceAlreadyUsed={onDeviceAlreadyUsed}
              blockedAccountInfo={blockedAccountInfo}
            />
          </div>
        </div>
      </>
    );
  }

  // Fiche "Bon de course" réductible : rendue à part (overlay par-dessus
  // `screen`, cf. plus bas) plutôt que dans le switch — pour que l'écran
  // précédent (Accueil, Courses…) reste monté et visible derrière la feuille
  // coulissante quand elle est repliée.
  const bookingSheet = detailBooking && (
    <BookingDetailSheet
      booking={detailBooking}
      invoiced={invoices.some(i => i.bookingId === detailBooking.id)}
      onBack={() => setDetailBooking(null)}
      onEdit={(b) => { setDetailBooking(null); setFormInitial(b); setFormOpen(true); }}
      onDuplicate={(b) => {
        // Pré-remplir avec les infos du bon, mais SANS l'id (= nouveau bon)
        // ni la date (= force l'utilisateur à mettre la nouvelle date).
        // Tout le reste — client, adresses, prix, distance — est conservé.
        setDetailBooking(null);
        setFormInitial({
          ...b,
          id: undefined,
          createdAt: undefined,
          status: 'pending',
          dateTime: toLocalInput(new Date()),
        });
        setFormOpen(true);
      }}
      onDelete={onDeleteBooking}
      onInvoice={onInvoiceBooking}
      defaultGps={preferences.defaultGps}
      activeTripId={activeTripId}
      currentUser={currentUser}
    />
  );

  let screen;
  if (detailInvoice) {
    const relatedBooking = bookings.find(b => b.id === detailInvoice.bookingId);
    screen = <InvoiceDetail
      invoice={detailInvoice}
      booking={relatedBooking}
      onBack={() => setDetailInvoice(null)}
      invoiceSettings={invoiceSettings}
      currentUser={currentUser}
      /* Callback déclenché après changement de statut (encaissée/en attente)
         → on met à jour l'invoice en mémoire ET la liste globale, pour que
         la facture affichée et le total "Encaissé" sur l'écran Factures
         reflètent immédiatement le changement (avant on devait quitter et
         revenir, ou rafraîchir l'app). */
      onStatusChanged={(newStatus) => {
        const updated = {
          ...detailInvoice,
          status: newStatus,
          paidAt: newStatus === 'paid' ? new Date().toISOString() : null,
        };
        setDetailInvoice(updated);
        setInvoices(prev => prev.map(inv => inv.id === updated.id ? updated : inv));
      }}
    />;
  } else if (formOpen) {
    screen = <BookingForm
      initial={formInitial}
      bookings={bookings}
      onCancel={() => { setFormOpen(false); setFormInitial(null); }}
      onSave={onSaveBooking}
    />;
  } else {
    switch (tab) {
      case "home":
        screen = <HomeScreen bookings={bookings} invoices={salesInvoices} tokenBalance={tokenBalance}
          isGuest={isGuest} currentUser={currentUser}
          onQuickVoice={onOpenVoice} onNewBooking={onNewBooking}
          onOpenBooking={setDetailBooking} onGoTab={setTab}
          onOpenPurchase={() => setPurchaseOpen(true)}
          onPromptSignup={onPromptSignup}
          setAgendaOpen={setAgendaOpen}
          activeTripId={activeTripId}
          onStartTrip={(b) => setActiveTripId(b.id)}
          onEndTrip={() => setActiveTripId(null)}
          defaultGps={preferences.defaultGps}/>;
        break;
      case "bookings":
        screen = <BookingsScreen bookings={bookings} tokenBalance={tokenBalance}
          onOpenBooking={setDetailBooking} onNewBooking={onNewBooking}
          onQuickVoice={onOpenVoice} onGoTab={setTab}/>;
        break;
      case "invoices":
        screen = <InvoicesScreen invoices={salesInvoices} bookings={bookings} tokenBalance={tokenBalance}
          onOpenInvoice={setDetailInvoice} onGoTab={setTab}/>;
        break;
      case "tokens":
        screen = <TokensScreen tokenBalance={tokenBalance} tokenHistory={tokenHistory}
          onOpenPurchase={() => setPurchaseOpen(true)}
          onOpenPurchaseDetail={setPurchaseDetail}
          onBack={() => setTab("profile")}/>;
        break;
      case "referral":
        screen = <ReferralScreen user={currentUser} onBack={() => setTab("profile")}/>;
        break;
      case "settings":
        screen = <SettingsScreen onBack={() => setTab("profile")} preferences={preferences} onChangePref={onChangePref} onDeleteAccount={handleDeleteAccount}
          invoiceSettings={invoiceSettings}
          onUpdateInvoiceSettings={updateInvoiceSettings}
          onGoTab={setTab}/>;
        break;
      case "billing":
        screen = <BillingScreen onBack={() => setTab("settings")}
          invoiceSettings={invoiceSettings}
          onUpdateInvoiceSettings={updateInvoiceSettings}/>;
        break;
      case "terms":
        screen = <TermsScreen onBack={() => setTab("profile")}/>;
        break;
      case "help":
        screen = <HelpScreen onBack={() => setTab("profile")}/>;
        break;
      case "profile":
        screen = <ProfileScreen onGoTab={setTab} tokenBalance={tokenBalance}
          currentUser={currentUser} isGuest={isGuest}
          onLogout={onLogout} onPromptSignup={onPromptSignup}
          onEditProfile={() => setProfileEditOpen(true)}
          biometricEnabled={preferences.biometric}/>;
        break;
      default:
        screen = null;
    }
  }

  const showNav = !detailBooking && !detailInvoice && !formOpen
    && !["tokens", "referral", "settings", "terms", "help", "billing"].includes(tab);

  return (
    <>
      <GlobalStyles/>
      <div className="tp-root">
        <div className="tp-phone">
          {!isOnline && (
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, zIndex: 1200,
              padding: "8px 14px", background: "rgba(248,113,113,0.95)",
              color: "#0B0B0D", fontSize: 12, fontWeight: 700, textAlign: "center",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <Cloud size={13}/> Hors-ligne — vos modifications seront enregistrées au retour de la connexion
            </div>
          )}
          {screen}
          {bookingSheet}
          {showNav && (
            <BottomNav active={tab} onChange={setTab} onVoice={onOpenVoice}/>
          )}
          <VoiceCapture open={voiceOpen} onClose={() => setVoiceOpen(false)} onConfirm={onVoiceConfirm}/>
          <PurchaseModal open={purchaseOpen} onClose={() => setPurchaseOpen(false)} onConfirm={onPurchaseConfirm}/>
          <PurchaseDetailModal open={!!purchaseDetail} purchase={purchaseDetail} onClose={() => setPurchaseDetail(null)}/>
          <EditProfileModal
            open={profileEditOpen}
            currentUser={currentUser}
            onClose={() => setProfileEditOpen(false)}
            onSave={async (updates) => {
              const updatedRow = await updateUserProfile(currentUser.id, updates);
              setCurrentUser(profileFromDb(updatedRow));
            }}
          />
          <InsufficientModal
            open={insufficientOpen}
            onClose={() => setInsufficientOpen(false)}
            onBuy={onInsufficientBuy}
            action={pendingActionLabel}
            currentBalance={tokenBalance}
          />
          <MonthlyBonusToast open={monthlyBonusOpen} onClose={() => setMonthlyBonusOpen(false)}/>
          <AgendaModal
            open={agendaOpen}
            onClose={() => setAgendaOpen(false)}
            bookings={bookings}
            onOpenBooking={setDetailBooking}
          />
        </div>
      </div>
    </>
  );
}
