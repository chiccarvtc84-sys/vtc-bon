import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Home, FileText, Receipt, User as UserIcon, Mic, MicOff,
  Plus, MapPin, Clock, Users, Briefcase,
  Calendar, ChevronRight, ChevronLeft, Search, Check,
  Phone, Mail, Share2, QrCode, Euro, X,
  Navigation, Car, Shield, Settings, Building2,
  AlertCircle, Edit3, Trash2, Download, Send,
  Sparkles, CreditCard, FileCheck, TrendingUp,
  Fingerprint, Loader2, CheckCircle2, ArrowUpRight,
  MessageSquare, LogOut, HelpCircle, Zap,
  Coins, Wallet, History, Gift, Crown, Info, TrendingDown,
  Lock, ShieldCheck, Copy, UserPlus, LogIn, Eye, EyeOff,
  Star, Award, Languages, Bell, Palette, Moon, Database,
  ChevronDown, BookOpen, MessageCircle, HandCoins, Globe,
  Cloud
} from 'lucide-react';
import {
  supabase,
  signIn as sbSignIn,
  signUp as sbSignUp,
  signOut as sbSignOut,
  getCurrentUser,
  loadBookings as sbLoadBookings,
  loadInvoices as sbLoadInvoices,
  loadTokenTransactions as sbLoadTokenTransactions,
  createBooking as sbCreateBooking,
  updateBooking as sbUpdateBooking,
  deleteBooking as sbDeleteBooking,
  createInvoice as sbCreateInvoice,
  purchaseTokensDev,
  findUserByReferralCode,
  creditReferralBonus,
  createCheckoutSession,
  findPurchaseBySessionId,
  verifySiret as sbVerifySiret,
  isDisposableEmail as sbIsDisposableEmail,
} from './lib/supabase.js';
import { watchNetwork, isNativePlatform, preferencesGet, preferencesSet } from './lib/platform.js';
import { checkPasswordStrength, isPasswordPwned } from './lib/passwordSecurity.js';
import { parseVoiceCommand as parseVoiceCommandV2 } from './lib/voiceParser.js';
import {
  ensureNotificationPermission,
  scheduleBookingReminders,
  cancelBookingReminders,
  rescheduleAllBookings,
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
      --accent: #F4B942;
      --accent-soft: rgba(244,185,66,0.12);
      --accent-ring: rgba(244,185,66,0.35);
      --accent-hover: #FBCE67;
      --success: #4ADE80;
      --success-soft: rgba(74,222,128,0.12);
      --error: #F87171;
      --error-soft: rgba(248,113,113,0.12);
      --warn: #FBBF24;
      --warn-soft: rgba(251,191,36,0.12);
    }

    * { box-sizing: border-box; }

    .tp-root {
      font-family: 'Plus Jakarta Sans', -apple-system, system-ui, sans-serif;
      background: var(--bg); color: var(--text);
      min-height: 100vh; letter-spacing: -0.01em;
      -webkit-font-smoothing: antialiased;
    }
    .tp-serif { font-family: 'Fraunces', Georgia, serif; font-variation-settings: "SOFT" 50; letter-spacing: -0.02em; }
    .tp-phone {
      max-width: 430px; margin: 0 auto; min-height: 100vh;
      background: var(--bg-gradient); position: relative;
      border-left: 1px solid var(--border-soft); border-right: 1px solid var(--border-soft);
      overflow-x: hidden;
    }
    .tp-scroll { padding-bottom: 110px; }

    .tp-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; }
    .tp-card-elevated {
      background: linear-gradient(180deg, var(--surface-2), var(--surface));
      border: 1px solid var(--border); border-radius: 16px;
    }

    .tp-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      padding: 10px 16px; border-radius: 12px; font-weight: 600; font-size: 14px;
      cursor: pointer; transition: all 0.15s ease; border: 1px solid transparent; user-select: none;
    }
    .tp-btn-primary { background: var(--accent); color: #0B0B0D; }
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
    .tp-chip-accent { background: var(--accent-soft); color: var(--accent); border-color: var(--accent-ring); }
    .tp-chip-success { background: var(--success-soft); color: var(--success); border-color: rgba(74,222,128,0.3); }
    .tp-chip-warn { background: var(--warn-soft); color: var(--warn); border-color: rgba(251,191,36,0.3); }
    .tp-chip-error { background: var(--error-soft); color: var(--error); border-color: rgba(248,113,113,0.3); }

    .tp-divider { height: 1px; background: var(--border); margin: 16px 0; }

    .tp-nav {
      position: fixed; bottom: 0; left: 0; right: 0;
      background: rgba(11,11,13,0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      border-top: 1px solid var(--border); padding: 10px 14px 20px;
      display: flex; justify-content: space-around; align-items: center; z-index: 40;
    }
    .tp-phone .tp-nav { position: absolute; max-width: 430px; margin: 0 auto; }
    .tp-nav-item {
      display: flex; flex-direction: column; align-items: center; gap: 3px;
      color: var(--muted); cursor: pointer; padding: 6px 12px; border-radius: 10px;
      transition: color 0.15s; font-size: 10px; font-weight: 600; flex: 1; min-width: 0;
    }
    .tp-nav-item.active { color: var(--accent); }
    .tp-nav-mic {
      width: 56px; height: 56px; background: var(--accent); color: #0B0B0D; border-radius: 18px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 24px -6px rgba(244,185,66,0.5); cursor: pointer;
      margin-top: -18px; transition: transform 0.2s; border: none;
    }
    .tp-nav-mic:hover { transform: scale(1.05); }

    @keyframes tp-pulse {
      0% { box-shadow: 0 0 0 0 rgba(244,185,66,0.6); }
      70% { box-shadow: 0 0 0 24px rgba(244,185,66,0); }
      100% { box-shadow: 0 0 0 0 rgba(244,185,66,0); }
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
      max-height: 90vh; overflow-y: auto;
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
      background: linear-gradient(135deg, rgba(244,185,66,0.18), rgba(244,185,66,0.04));
      box-shadow: 0 6px 24px -10px rgba(244,185,66,0.6);
    }
    .tp-pack-ribbon {
      position: absolute; top: 10px; right: -28px;
      background: var(--accent); color: #0B0B0D;
      font-size: 9px; font-weight: 800;
      padding: 3px 30px; letter-spacing: 0.08em;
      transform: rotate(35deg); text-transform: uppercase;
      box-shadow: 0 2px 4px rgba(0,0,0,0.4);
    }

    @keyframes tp-spin { to { transform: rotate(360deg); } }
  `}</style>
);

/* -------------------------------------------------------------------------
   TOP BAR & TOKEN BADGE
   ------------------------------------------------------------------------- */
function TopBar({ title, subtitle, onBack, rightAction }) {
  return (
    <div style={{ padding: "20px 20px 12px", display: "flex", alignItems: "center", gap: 12 }}>
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
        color: low ? "var(--error)" : "var(--accent)",
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
   HOME / DASHBOARD
   ------------------------------------------------------------------------- */
function HomeScreen({ bookings, invoices, tokenBalance, isGuest, onQuickVoice, onNewBooking, onOpenBooking, onGoTab, onOpenPurchase, onPromptSignup }) {
  const today = new Date();
  const todayBookings = bookings.filter(b => new Date(b.dateTime).toDateString() === today.toDateString());
  const weekRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);

  return (
    <div className="tp-scroll tp-fade-in">
      <div style={{ padding: "28px 20px 8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>
              {today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            <h1 className="tp-serif" style={{ fontSize: 32, fontWeight: 600, margin: "6px 0 0", lineHeight: 1.1 }}>
              Bonjour,<br/>
              <span style={{ color: "var(--accent)" }}>{DRIVER_PROFILE.firstName}</span>.
            </h1>
          </div>
          <TokenBadge balance={tokenBalance} onClick={() => onGoTab("tokens")}/>
        </div>
      </div>

      {isGuest && <GuestBanner onSignup={onPromptSignup}/>}

      <div style={{ padding: "20px 20px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="tp-card-elevated" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-dim)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <Calendar size={12} /> Aujourd'hui
          </div>
          <div className="tp-serif" style={{ fontSize: 28, fontWeight: 600, marginTop: 4 }}>{todayBookings.length}</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>course{todayBookings.length > 1 ? "s" : ""} prévue{todayBookings.length > 1 ? "s" : ""}</div>
        </div>
        <div className="tp-card-elevated" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-dim)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <TrendingUp size={12} /> CA encaissé
          </div>
          <div className="tp-serif" style={{ fontSize: 28, fontWeight: 600, marginTop: 4, color: "var(--accent)" }}>{eur(weekRevenue)}</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>cette semaine</div>
        </div>
      </div>

      <div style={{ padding: "16px 20px 0" }}>
        <button onClick={onQuickVoice} className="tp-card-elevated" style={{
          width: "100%", padding: 18, display: "flex", alignItems: "center", gap: 14,
          cursor: "pointer", textAlign: "left", border: "1px solid var(--accent-ring)",
          background: "linear-gradient(135deg, rgba(244,185,66,0.15), rgba(244,185,66,0.02))",
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent)", color: "#0B0B0D", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Mic size={22} strokeWidth={2.2}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Nouveau bon vocal</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
              Dictez votre course · <span style={{ color: "var(--accent)" }}>1 crédit</span>
            </div>
          </div>
          <Sparkles size={16} style={{ color: "var(--accent)" }}/>
        </button>
      </div>

      <div style={{ padding: "16px 20px 0", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {[
          { icon: Plus, label: "Manuel", onClick: onNewBooking },
          { icon: FileCheck, label: "Devis", onClick: () => onGoTab("bookings") },
          { icon: Receipt, label: "Factures", onClick: () => onGoTab("invoices") },
          { icon: Calendar, label: "Agenda", onClick: () => onGoTab("bookings") },
        ].map((a, i) => (
          <button key={i} onClick={a.onClick} className="tp-card" style={{ padding: "12px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer", background: "var(--surface)" }}>
            <a.icon size={18} style={{ color: "var(--accent)" }}/>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{a.label}</span>
          </button>
        ))}
      </div>

      <div style={{ padding: "24px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div className="tp-serif" style={{ fontSize: 18, fontWeight: 600 }}>Prochaines courses</div>
          <button onClick={() => onGoTab("bookings")} style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 2 }}>
            Tout voir <ArrowUpRight size={12}/>
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {bookings.slice(0, 3).map(b => <BookingCard key={b.id} booking={b} onClick={() => onOpenBooking(b)} />)}
        </div>
      </div>

      <div style={{ padding: "20px 20px 0" }}>
        <div className="tp-card" style={{ padding: 14, display: "flex", gap: 12, alignItems: "center", background: "var(--surface)" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--success-soft)", color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Shield size={18}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Conformité décret 2017-483</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>Tous les bons comportent les mentions obligatoires</div>
          </div>
          <CheckCircle2 size={18} style={{ color: "var(--success)" }}/>
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
        <div className="tp-serif" style={{ fontSize: 20, fontWeight: 600, lineHeight: 1, color: "var(--accent)" }}>{time}</div>
        <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{day}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{booking.customerName}</div>
          <span className={`tp-chip ${isPending ? "tp-chip-warn" : "tp-chip-success"}`}>{isPending ? "En attente" : "Confirmée"}</span>
        </div>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-dim)" }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: "var(--accent)", flexShrink: 0 }}/>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{booking.pickupAddress}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-dim)" }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: "var(--text-dim)", flexShrink: 0 }}/>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{booking.dropoffAddress}</span>
          </div>
        </div>
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "var(--text-dim)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Users size={11}/> {booking.passengers}</span>
          {booking.hasLuggage && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Briefcase size={11}/> Bagages</span>}
          <span style={{ marginLeft: "auto", color: "var(--accent)", fontWeight: 700, fontSize: 13 }}>{eur(booking.price)}</span>
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
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");        // texte cumulé (final + interim)
  const [finalTranscript, setFinalTranscript] = useState(""); // que les chunks finalisés
  const [parsed, setParsed] = useState(null);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState("");
  const [silenceCountdown, setSilenceCountdown] = useState(0); // 5..0 quand on s'approche du timeout

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
      if (!isStoppingRef.current && listening) {
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
    // Parse final
    const finalText = finalTranscriptRef.current.trim();
    if (finalText) {
      setTranscript(finalText);
      setParsed(parseVoiceCommandV2(finalText));
    }
  }

  const useExample = () => {
    const example = "dupont marseille avignon tgv 100 bornes 180 balles 12h30 ils seront 3 avec valises";
    setTranscript(example);
    finalTranscriptRef.current = example;
    setFinalTranscript(example);
    setParsed(parseVoiceCommandV2(example));
  };

  const onManualEdit = (e) => {
    const v = e.target.value;
    setTranscript(v);
    finalTranscriptRef.current = v;
    if (v.length > 4) setParsed(parseVoiceCommandV2(v));
    else setParsed(null);
  };

  const confirm = () => {
    if (!parsed) return;
    const today = new Date();
    const [h,m] = (parsed.time || "09:00").split(":");
    today.setHours(parseInt(h||"9"), parseInt(m||"0"), 0, 0);
    if (today < new Date()) today.setDate(today.getDate() + 1);
    const iso = today.toISOString().slice(0, 16);
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
                background: listening ? "var(--error)" : "var(--accent)", color: "#0B0B0D", border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: supported ? "pointer" : "not-allowed",
                boxShadow: "0 12px 40px -8px rgba(244,185,66,0.4)", opacity: supported ? 1 : 0.5,
                position: "relative",
              }}
            >
              {listening ? <MicOff size={36}/> : <Mic size={36}/>}
              {/* Anneau de countdown silence (apparaît à 3s avant arrêt auto) */}
              {listening && silenceCountdown > 0 && (
                <div style={{
                  position: "absolute", top: -8, right: -8,
                  width: 30, height: 30, borderRadius: "50%",
                  background: "var(--accent)", color: "#0B0B0D",
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
                <div style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>
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
            <div className="tp-label" style={{ marginBottom: 6 }}>Transcription</div>
            <textarea className="tp-input" rows={3}
              placeholder="Ex : Je voudrais récupérer un Aurélien Matro à Avignon centre pour la gare TGV à 12h50 ils seront 3 avec valises..."
              value={transcript} onChange={onManualEdit} style={{ resize: "vertical", minHeight: 72 }}/>
            {!supported && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>Vous pouvez taper manuellement la phrase ci-dessus.</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={useExample} className="tp-btn tp-btn-outline" style={{ fontSize: 12, padding: "8px 12px" }}>
                <Sparkles size={12}/> Tester l'exemple
              </button>
              {transcript && (
                <button onClick={() => { setTranscript(""); setParsed(null); }} className="tp-btn tp-btn-ghost" style={{ fontSize: 12, padding: "8px 12px" }}>Effacer</button>
              )}
            </div>
          </div>

          {parsed && (
            <div className="tp-fade-in" style={{ marginTop: 20 }}>
              <div className="tp-label" style={{ marginBottom: 10 }}>Champs détectés</div>
              <div className="tp-card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12, background: "var(--surface-2)" }}>
                <FieldRow icon={UserIcon} label="Client" value={parsed.customerName || "—"} detected={!!parsed.customerName}/>
                <FieldRow icon={MapPin} label="Prise en charge" value={parsed.pickupAddress || "—"} detected={!!parsed.pickupAddress}/>
                <FieldRow icon={Navigation} label="Destination" value={parsed.dropoffAddress || "—"} detected={!!parsed.dropoffAddress}/>
                <FieldRow icon={Clock} label="Heure" value={parsed.time || "—"} detected={!!parsed.time}/>
                <FieldRow icon={Users} label="Passagers" value={String(parsed.passengers)} detected/>
                <FieldRow icon={Briefcase} label="Bagages" value={parsed.hasLuggage ? "Oui" : "Non"} detected/>
                <FieldRow icon={Car} label="Distance" value={parsed.distance != null ? `${parsed.distance} km` : "—"} detected={parsed.distance != null}/>
                <FieldRow icon={Euro} label="Tarif" value={parsed.price != null ? `${parsed.price} €` : "—"} detected={parsed.price != null}/>
              </div>
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

function FieldRow({ icon: Icon, label, value, detected }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: detected ? "var(--accent-soft)" : "var(--surface-3)",
        color: detected ? "var(--accent)" : "var(--muted)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}><Icon size={15}/></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: detected ? 600 : 400, color: detected ? "var(--text)" : "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      </div>
      {detected && <Check size={14} style={{ color: "var(--success)", flexShrink: 0 }}/>}
    </div>
  );
}

/* -------------------------------------------------------------------------
   BOOKING FORM
   ------------------------------------------------------------------------- */
function BookingForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState({
    customerName: "", phone: "", pickupAddress: "", dropoffAddress: "",
    dateTime: new Date().toISOString().slice(0,16),
    passengers: 1, hasLuggage: false, distance: 10, duration: 20,
    price: 0, notes: "", type: "forfait",
    ...(initial || {}),
  });
  const [pickupSuggestOpen, setPickupSuggestOpen] = useState(false);
  const [dropoffSuggestOpen, setDropoffSuggestOpen] = useState(false);

  const estimatedPrice = useMemo(() => estimatePrice(form.distance, form.duration), [form.distance, form.duration]);

  useEffect(() => { if (!form.price) setForm(f => ({ ...f, price: Math.round(estimatedPrice) })); }, []); // eslint-disable-line

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
                color: form.type === opt.v ? "var(--accent)" : "var(--text)",
                fontWeight: 600, fontSize: 13,
              }}>{opt.l}</button>
            ))}
          </div>
        </div>

        <div>
          <div className="tp-label" style={{ marginBottom: 6 }}>Client</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input className="tp-input" placeholder="Nom et prénom" value={form.customerName} onChange={e => update("customerName", e.target.value)}/>
            <input className="tp-input" placeholder="Téléphone (facultatif)" value={form.phone} onChange={e => update("phone", e.target.value)}/>
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <div className="tp-label" style={{ marginBottom: 6 }}>Prise en charge</div>
          <div style={{ position: "relative" }}>
            <MapPin size={16} style={{ position: "absolute", left: 14, top: 14, color: "var(--accent)" }}/>
            <input className="tp-input" style={{ paddingLeft: 38 }} placeholder="Adresse de départ"
              value={form.pickupAddress} onChange={e => update("pickupAddress", e.target.value)}
              onFocus={() => setPickupSuggestOpen(true)}/>
          </div>
          {pickupSuggestOpen && (
            <div className="tp-fade-in" style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 2px" }}>
                Suggestions près de {DRIVER_PROFILE.baseCity}
              </div>
              {filterAddrs(form.pickupAddress).map(a => (
                <button key={a.label} className="tp-addr-chip" onClick={() => { update("pickupAddress", a.label); setPickupSuggestOpen(false); }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, textAlign: "left" }}>
                    <MapPin size={13} style={{ color: "var(--text-dim)", flexShrink: 0 }}/>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{a.label}</div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{a.detail}</div>
                    </div>
                  </div>
                </button>
              ))}
              <button onClick={() => setPickupSuggestOpen(false)} style={{ fontSize: 11, color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer", padding: 6, textAlign: "left" }}>Masquer les suggestions</button>
            </div>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <div className="tp-label" style={{ marginBottom: 6 }}>Destination</div>
          <div style={{ position: "relative" }}>
            <Navigation size={16} style={{ position: "absolute", left: 14, top: 14, color: "var(--text-dim)" }}/>
            <input className="tp-input" style={{ paddingLeft: 38 }} placeholder="Adresse d'arrivée"
              value={form.dropoffAddress} onChange={e => update("dropoffAddress", e.target.value)}
              onFocus={() => setDropoffSuggestOpen(true)}/>
          </div>
          {dropoffSuggestOpen && (
            <div className="tp-fade-in" style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {filterAddrs(form.dropoffAddress).map(a => (
                <button key={a.label} className="tp-addr-chip" onClick={() => { update("dropoffAddress", a.label); setDropoffSuggestOpen(false); }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, textAlign: "left" }}>
                    <Navigation size={13} style={{ color: "var(--text-dim)", flexShrink: 0 }}/>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{a.label}</div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{a.detail}</div>
                    </div>
                  </div>
                </button>
              ))}
              <button onClick={() => setDropoffSuggestOpen(false)} style={{ fontSize: 11, color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer", padding: 6, textAlign: "left" }}>Masquer les suggestions</button>
            </div>
          )}
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

        <div className="tp-card-elevated" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="tp-label">Tarif et trajet</div>
            <button onClick={() => update("price", Math.round(estimatedPrice))}
              style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
              <Zap size={11}/> Estimer
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>Distance (km)</div>
              <input className="tp-input" type="number" step="0.1" value={form.distance} onChange={e => update("distance", parseFloat(e.target.value)||0)}/>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>Durée (min)</div>
              <input className="tp-input" type="number" value={form.duration} onChange={e => update("duration", parseInt(e.target.value)||0)}/>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>Prix forfaitaire TTC</div>
            <div style={{ position: "relative" }}>
              <Euro size={16} style={{ position: "absolute", left: 14, top: 14, color: "var(--accent)" }}/>
              <input className="tp-input" type="number" style={{ paddingLeft: 38, fontSize: 18, fontWeight: 700 }} value={form.price} onChange={e => update("price", parseFloat(e.target.value)||0)}/>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>Estimation : {eur(estimatedPrice)} (2,50 €/km + horaire)</div>
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
            <Coins size={16} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }}/>
            <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>
              La création de ce bon consomme <b>1 crédit</b>.
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, paddingBottom: 20 }}>
          <button onClick={onCancel} className="tp-btn tp-btn-ghost" style={{ flex: 1 }}>Annuler</button>
          <button onClick={() => onSave({ ...form, id: form.id || genId(), status: "confirmed", createdAt: form.createdAt || new Date().toISOString() })} className="tp-btn tp-btn-primary" style={{ flex: 2 }}>
            <Check size={16}/> Enregistrer le bon
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   BOOKING DETAIL
   ------------------------------------------------------------------------- */
function BookingDetail({ booking, onBack, onEdit, onDelete, onInvoice }) {
  if (!booking) return null;
  return (
    <div className="tp-scroll tp-fade-in">
      <TopBar title="Bon de course" subtitle={`Réf. ${booking.id.toUpperCase()}`} onBack={onBack}
        rightAction={<button onClick={() => onEdit(booking)} className="tp-btn tp-btn-ghost" style={{ padding: 8, borderRadius: 10 }}><Edit3 size={16}/></button>}/>

      <div style={{ padding: "8px 20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="tp-card-elevated" style={{ padding: 20, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 4, background: "var(--accent)" }}/>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Shield size={14} style={{ color: "var(--accent)" }}/>
            <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Bon de transport réglementaire</div>
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
              <div className="tp-serif" style={{ fontSize: 30, fontWeight: 600, color: "var(--accent)", lineHeight: 1 }}>{eur(booking.price)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Forfait</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>TVA {DRIVER_PROFILE.vatRate}% incluse</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{booking.distance} km · {booking.duration} min</div>
            </div>
          </div>

          <div style={{ marginTop: 16, padding: 12, background: "var(--surface-2)", borderRadius: 10, fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6 }}>
            <div style={{ color: "var(--text)", fontWeight: 700, marginBottom: 4 }}>{DRIVER_PROFILE.companyName}</div>
            <div>SIRET : {DRIVER_PROFILE.siret}</div>
            <div>Inscription VTC : {DRIVER_PROFILE.vtcNumber}</div>
            <div>Carte pro. conducteur : {DRIVER_PROFILE.proCardNumber}</div>
            <div>Véhicule : {DRIVER_PROFILE.vehicleModel} · {DRIVER_PROFILE.vehiclePlate}</div>
          </div>
        </div>

        {booking.notes && (
          <div className="tp-card" style={{ padding: 14, background: "var(--surface)" }}>
            <div className="tp-label" style={{ marginBottom: 4 }}>Observations</div>
            <div style={{ fontSize: 13 }}>{booking.notes}</div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button className="tp-btn tp-btn-ghost" onClick={() => onInvoice(booking)}><Receipt size={15}/> Facturer</button>
          <button className="tp-btn tp-btn-ghost"><Share2 size={15}/> Partager</button>
          <button className="tp-btn tp-btn-ghost"><Send size={15}/> Email client</button>
          <button className="tp-btn tp-btn-ghost"><Calendar size={15}/> Agenda</button>
        </div>

        <button onClick={() => onDelete(booking)} className="tp-btn" style={{ color: "var(--error)", background: "var(--error-soft)", border: "1px solid rgba(248,113,113,0.25)" }}>
          <Trash2 size={15}/> Supprimer le bon
        </button>
      </div>
    </div>
  );
}

function Info2({ label, value, accent }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: accent ? "var(--accent)" : "var(--text)" }}>{value}</div>
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
    <div className="tp-scroll tp-fade-in">
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

      <div style={{ padding: "14px 20px 0", display: "flex", gap: 8, overflowX: "auto" }}>
        {[{ v: "all", l: "Toutes" }, { v: "confirmed", l: "Confirmées" }, { v: "pending", l: "En attente" }].map(f => (
          <button key={f.v} onClick={() => setFilter(f.v)}
            className={`tp-chip ${filter === f.v ? "tp-chip-accent" : ""}`}
            style={{ cursor: "pointer", border: "1px solid var(--border)", padding: "6px 14px", fontSize: 12 }}>{f.l}</button>
        ))}
      </div>

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
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
    <div className="tp-scroll tp-fade-in">
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

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(inv => (
          <button key={inv.id} onClick={() => onOpenInvoice(inv)} className="tp-card"
            style={{ padding: 14, textAlign: "left", cursor: "pointer", background: "var(--surface)", display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Receipt size={18}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{inv.customerName}</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{inv.number} · {formatDate(inv.date)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)" }}>{eur(inv.amount)}</div>
              <div className={`tp-chip ${inv.status === "paid" ? "tp-chip-success" : "tp-chip-warn"}`} style={{ marginTop: 4, fontSize: 10, padding: "2px 8px" }}>
                {inv.status === "paid" ? "Payée" : "En attente"}
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
function InvoiceDetail({ invoice, booking, onBack }) {
  if (!invoice) return null;
  return (
    <div className="tp-scroll tp-fade-in">
      <TopBar title={invoice.number} subtitle={`Émise le ${formatDate(invoice.date)}`} onBack={onBack}
        rightAction={<button className="tp-btn tp-btn-ghost" style={{ padding: 8, borderRadius: 10 }}><Download size={16}/></button>}/>

      <div style={{ padding: "8px 20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="tp-card-elevated" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <div className="tp-serif" style={{ fontSize: 22, fontWeight: 600, color: "var(--accent)" }}>TrajetPro</div>
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
              <span style={{ color: "var(--text-dim)" }}>TVA ({DRIVER_PROFILE.vatRate}%)</span>
              <span>{eur(invoice.vatAmount)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", borderTop: "1px solid var(--border)", marginTop: 6 }}>
              <span className="tp-serif" style={{ fontSize: 16, fontWeight: 600 }}>Total TTC</span>
              <span className="tp-serif" style={{ fontSize: 22, fontWeight: 600, color: "var(--accent)" }}>{eur(invoice.amount)}</span>
            </div>
          </div>

          <div style={{ marginTop: 18, padding: 14, background: "var(--surface-2)", borderRadius: 12, display: "flex", gap: 14, alignItems: "center" }}>
            <PseudoQR seed={invoice.fingerprint} size={80}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Fingerprint size={13} style={{ color: "var(--accent)" }}/>
                <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Empreinte fiscale</div>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.4, fontFamily: "monospace" }}>{invoice.fingerprint}</div>
              <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 6 }}>Authentifiable en cas de contrôle fiscal</div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button className="tp-btn tp-btn-primary"><Send size={15}/> Envoyer</button>
          <button className="tp-btn tp-btn-ghost"><Share2 size={15}/> Lien partage</button>
          <button className="tp-btn tp-btn-ghost"><Mail size={15}/> Email</button>
          <button className="tp-btn tp-btn-ghost"><MessageSquare size={15}/> SMS</button>
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
              background: "linear-gradient(135deg, var(--accent), #8B6D2F)",
              color: "#0B0B0D", display: "flex", alignItems: "center", justifyContent: "center",
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
        <div className="tp-card-elevated" style={{ padding: 24, textAlign: "center", position: "relative", overflow: "hidden", background: "linear-gradient(140deg, rgba(244,185,66,0.15), rgba(244,185,66,0.02) 60%)", borderColor: "var(--accent-ring)" }}>
          <div style={{
            position: "absolute", top: -30, right: -30,
            width: 140, height: 140, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(244,185,66,0.15), transparent 70%)",
            pointerEvents: "none",
          }}/>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
            <Coins size={16} style={{ color: "var(--accent)" }}/>
            <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>Vous disposez de</div>
          </div>
          <div className="tp-serif" style={{ fontSize: 64, fontWeight: 600, color: "var(--accent)", lineHeight: 1, marginBottom: 6 }}>
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
        <button onClick={onOpenPurchase} className="tp-btn tp-btn-primary" style={{ width: "100%", padding: "16px", fontSize: 15, boxShadow: "0 8px 24px -10px rgba(244,185,66,0.6)" }}>
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
            <div className="tp-serif" style={{ fontSize: 20, fontWeight: 600, marginTop: 4, color: "var(--accent)" }}>{eur(totalSpent)}</div>
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
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>{eur(h.priceTTC)}</div>
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
        paymentMethod === "card" ? "Carte bancaire" :
        paymentMethod === "applepay" ? "Apple Pay" : "Google Pay",
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
              {/* VAT intracommunity */}
              <div className="tp-card" style={{ padding: 14, marginBottom: 16, background: "var(--surface)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: showVatField ? 12 : 0 }}>
                  <Info size={16} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Numéro TVA intracommunautaire</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2, lineHeight: 1.5 }}>
                      Si vous possédez un numéro de TVA intracommunautaire valide (hors France), indiquez-le pour bénéficier de l'auto-liquidation de la TVA (art. 283-2 du CGI).
                    </div>
                    <button onClick={() => setShowVatField(v => !v)}
                      style={{ marginTop: 8, fontSize: 12, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}>
                      {showVatField ? "Masquer" : "Renseigner mon numéro"}
                    </button>
                  </div>
                </div>
                {showVatField && (
                  <div className="tp-fade-in">
                    <input className="tp-input" placeholder="Ex : BE0123456789"
                      value={vatIntra} onChange={e => setVatIntra(e.target.value.toUpperCase())}
                      style={{ fontFamily: "monospace" }}/>
                    {vatIntra && (
                      <div style={{ fontSize: 11, marginTop: 6, color: validIntra ? "var(--success)" : "var(--warn)", display: "flex", alignItems: "center", gap: 4 }}>
                        {validIntra ? <><CheckCircle2 size={12}/> Format valide</> : <><AlertCircle size={12}/> Format non reconnu</>}
                      </div>
                    )}
                    {applyReverseCharge && (
                      <div className="tp-chip tp-chip-success" style={{ marginTop: 8 }}>
                        <CheckCircle2 size={11}/> TVA auto-liquidée
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Packs */}
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
                          <span className="tp-serif" style={{ fontSize: 22, fontWeight: 600, color: isSelected ? "var(--accent)" : "var(--text)" }}>{p.tokens}</span>
                          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>crédits</span>
                          {p.popular && <span className="tp-chip tp-chip-accent" style={{ fontSize: 9, padding: "2px 7px" }}>Populaire</span>}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 1 }}>
                          {p.label} · {pricePerToken}€ / crédit
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="tp-serif" style={{ fontSize: 20, fontWeight: 600, color: isSelected ? "var(--accent)" : "var(--text)" }}>
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
                  <div>• Paiement sécurisé via prestataire agréé (Stripe, Apple Pay, Google Pay).</div>
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
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--accent)", color: "#0B0B0D", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                    <span className="tp-serif" style={{ fontSize: 22, fontWeight: 600, color: "var(--accent)" }}>{eur(finalPrice)}</span>
                  </div>
                </div>

                {showVatField && vatIntra && (
                  <div style={{ marginTop: 14, padding: 10, background: "var(--surface-2)", borderRadius: 8, fontSize: 11 }}>
                    <div style={{ color: "var(--text-dim)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, marginBottom: 2 }}>N° TVA intracommunautaire</div>
                    <div style={{ fontFamily: "monospace", fontWeight: 600 }}>{vatIntra.toUpperCase()}</div>
                  </div>
                )}
              </div>

              <div className="tp-label" style={{ marginBottom: 8 }}>Méthode de paiement</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {[
                  { v: "card", l: "Carte bancaire", icon: CreditCard },
                  { v: "applepay", l: "Apple Pay", icon: ShieldCheck },
                  { v: "googlepay", l: "Google Pay", icon: ShieldCheck },
                ].map(m => {
                  const isActive = paymentMethod === m.v;
                  return (
                    <button key={m.v} onClick={() => setPaymentMethod(m.v)} className="tp-card" style={{
                      padding: 14, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left",
                      borderColor: isActive ? "var(--accent)" : "var(--border)",
                      background: isActive ? "var(--accent-soft)" : "var(--surface)",
                    }}>
                      <m.icon size={18} style={{ color: isActive ? "var(--accent)" : "var(--text-dim)" }}/>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{m.l}</span>
                      {isActive && <Check size={16} style={{ color: "var(--accent)" }}/>}
                    </button>
                  );
                })}
              </div>

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
                <div className="tp-serif" style={{ fontSize: 20, fontWeight: 600, color: "var(--accent)" }}>TrajetPro</div>
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
                <span className="tp-serif" style={{ fontSize: 22, fontWeight: 600, color: "var(--accent)" }}>{eur(purchase.priceTTC)}</span>
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
            <button className="tp-btn tp-btn-ghost"><MessageSquare size={15}/> SMS</button>
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
                    <div style={{ position: "absolute", top: -6, right: -4, background: "var(--accent)", color: "#0B0B0D", fontSize: 8, fontWeight: 800, padding: "1px 6px", borderRadius: 6, textTransform: "uppercase" }}>Top</div>
                  )}
                  <div className="tp-serif" style={{ fontSize: 18, fontWeight: 600, color: "var(--accent)" }}>{p.tokens}</div>
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
function ProfileScreen({ onGoTab, tokenBalance, currentUser, isGuest, onLogout, onPromptSignup }) {
  const lowTokens = tokenBalance <= 3;
  const displayName = currentUser?.name || `${DRIVER_PROFILE.firstName} ${DRIVER_PROFILE.lastName}`;
  const displayEmail = currentUser?.email || DRIVER_PROFILE.email;
  const items = [
    { icon: Building2, label: "Mon entreprise", value: DRIVER_PROFILE.companyName },
    { icon: FileCheck, label: "N° SIRET", value: DRIVER_PROFILE.siret },
    { icon: Shield, label: "Inscription VTC", value: DRIVER_PROFILE.vtcNumber },
    { icon: CreditCard, label: "Carte pro.", value: DRIVER_PROFILE.proCardNumber },
    { icon: Car, label: "Véhicule", value: `${DRIVER_PROFILE.vehicleModel} · ${DRIVER_PROFILE.vehiclePlate}` },
    { icon: Phone, label: "Téléphone", value: DRIVER_PROFILE.phone },
    { icon: Mail, label: "Email", value: displayEmail },
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
          <div style={{
            width: 60, height: 60, borderRadius: 16,
            background: "linear-gradient(135deg, var(--accent), #8B6D2F)",
            color: "#0B0B0D", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 700, fontFamily: "'Fraunces', serif",
          }}>
            {displayName.split(" ").map(w => w[0]).join("").substring(0,2)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="tp-serif" style={{ fontSize: 18, fontWeight: 600 }}>{displayName}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{isGuest ? "Invité" : displayEmail}</div>
            {!isGuest && (
              <div className="tp-chip tp-chip-success" style={{ marginTop: 6 }}>
                <ShieldCheck size={10}/> Compte vérifié
              </div>
            )}
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
            : "linear-gradient(135deg, rgba(244,185,66,0.12), rgba(244,185,66,0.02))",
          borderColor: lowTokens ? "rgba(248,113,113,0.3)" : "var(--accent-ring)",
          textAlign: "left",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: lowTokens ? "var(--error)" : "var(--accent)",
            color: "#0B0B0D", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Wallet size={22}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Gérer mes jetons</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
              <span className="tp-serif" style={{ fontSize: 18, fontWeight: 700, color: lowTokens ? "var(--error)" : "var(--accent)" }}>
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
              background: "var(--accent-soft)", color: "var(--accent)",
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

      <div style={{ padding: "0 20px" }}>
        <div className="tp-card" style={{ background: "var(--surface)" }}>
          {items.map((it, i) => (
            <div key={it.label} style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: i < items.length-1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--surface-2)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <it.icon size={15}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{it.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.value}</div>
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
            { icon: Fingerprint, label: "Identification biométrique", right: <span className="tp-chip tp-chip-success">Activée</span> },
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
    <div className="tp-scroll tp-fade-in" style={{ minHeight: "100vh", padding: "24px", display: "flex", flexDirection: "column" }}>
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
          textAlign: "center", fontSize: 12, color: "var(--accent)",
          padding: 12, textDecoration: "none", fontWeight: 600,
        }}>
          Contacter le support
        </a>
      </div>
    </div>
  );
}

function WelcomeScreen({ onChangeMode, onGuest }) {
  return (
    <div className="tp-scroll tp-fade-in" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", padding: "40px 24px" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
        {/* Logo */}
        <div style={{
          width: 80, height: 80, borderRadius: 22,
          background: "linear-gradient(135deg, var(--accent), #8B6D2F)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 16px 48px -12px rgba(244,185,66,0.5)",
          marginBottom: 28,
        }}>
          <Car size={40} style={{ color: "#0B0B0D" }}/>
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
                background: "var(--accent-soft)", color: "var(--accent)",
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

function LoginScreen({ onChangeMode, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    if (!email || !password) { setError("Email et mot de passe requis"); return; }
    setLoading(true);
    try {
      // Connexion via Supabase Auth + bonus mensuel automatique côté helper
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
    <div className="tp-scroll tp-fade-in" style={{ minHeight: "100vh", padding: "24px" }}>
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

        <button style={{ fontSize: 12, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", textAlign: "right", fontWeight: 600, padding: "4px 2px" }}>
          Mot de passe oublié ?
        </button>

        {error && (
          <div className="tp-card" style={{ padding: 10, background: "var(--error-soft)", borderColor: "rgba(248,113,113,0.3)", fontSize: 12, color: "var(--error)", display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.5 }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }}/>
            <span>{error}</span>
          </div>
        )}

        <button onClick={submit} disabled={loading} className="tp-btn tp-btn-primary" style={{ padding: "14px", fontSize: 15, marginTop: 6 }}>
          {loading ? <><Loader2 size={16} style={{ animation: "tp-spin 1s linear infinite" }}/> Connexion...</> : <><LogIn size={16}/> Se connecter</>}
        </button>

        <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-dim)", marginTop: 12 }}>
          Pas encore de compte ?{" "}
          <button onClick={() => onChangeMode("signup")} style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 700, padding: 0 }}>
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
      // HaveIBeenPwned k-anonymity : bloque les mots de passe figurant dans
      // une fuite connue. Appel HTTPS sans clé, fail-open en cas de panne.
      const pwned = await isPasswordPwned(form.password);
      if (pwned) {
        setError("Ce mot de passe a été divulgué dans une fuite de données. Choisissez-en un autre.");
        setLoading(false);
        return;
      }

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
      <div className="tp-scroll tp-fade-in" style={{ minHeight: "100vh", padding: "24px" }}>
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
            <Mail size={38} style={{ color: "var(--accent)" }}/>
          </div>
          <div className="tp-serif" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.2, marginBottom: 10 }}>
            Vérifiez votre email
          </div>
          <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6, maxWidth: 320, margin: "0 auto" }}>
            Un email de confirmation a été envoyé à<br/>
            <b style={{ color: "var(--text)" }}>{form.email}</b><br/><br/>
            Cliquez sur le lien reçu pour activer votre compte et recevoir vos <b style={{ color: "var(--accent)" }}>{WELCOME_TOKENS} crédits de bienvenue</b>.
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
    <div className="tp-scroll tp-fade-in" style={{ minHeight: "100vh", padding: "24px" }}>
      <button onClick={() => onChangeMode("welcome")} className="tp-btn tp-btn-ghost" style={{ padding: 10, borderRadius: 10, marginBottom: 16 }}>
        <ChevronLeft size={18}/>
      </button>

      <div style={{ marginBottom: 24 }}>
        <div className="tp-serif" style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.1 }}>Créer un compte</div>
        <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6 }}>
          <Gift size={12} style={{ display: "inline", verticalAlign: "middle", color: "var(--accent)" }}/> {WELCOME_TOKENS} crédits offerts après vérification email
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
              placeholder="832 456 789 00012" value={form.siret} onChange={e => update("siret", e.target.value)}/>
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
            <HandCoins size={14} style={{ color: hasReferralCode ? "var(--success)" : "var(--accent)" }}/>
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
              Si un ami vous a parrainé, saisissez son code pour gagner <b style={{ color: "var(--accent)" }}>+{REFERRAL_BONUS_REFEREE} crédits</b>.
            </div>
          )}
        </div>

        {/* Security notice */}
        <div className="tp-card" style={{ padding: 12, background: "var(--surface-2)", display: "flex", gap: 10 }}>
          <Shield size={14} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }}/>
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
          <button onClick={() => onChangeMode("login")} style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 700, padding: 0 }}>
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
          background: "linear-gradient(135deg, rgba(244,185,66,0.2), rgba(244,185,66,0.02) 70%)",
          borderColor: "var(--accent-ring)",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: -40, right: -40,
            width: 150, height: 150, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(244,185,66,0.2), transparent 70%)",
            pointerEvents: "none",
          }}/>
          <div style={{
            width: 56, height: 56, margin: "0 auto 14px",
            borderRadius: 16, background: "var(--accent)", color: "#0B0B0D",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 24px -6px rgba(244,185,66,0.5)",
          }}>
            <HandCoins size={28}/>
          </div>
          <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
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
                  background: "var(--accent)", color: "#0B0B0D",
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
            <div className="tp-serif" style={{ fontSize: 24, fontWeight: 600, marginTop: 4, color: "var(--accent)" }}>+{stats.tokensEarned}</div>
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
                    background: "var(--surface-2)", color: "var(--accent)",
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
   SETTINGS SCREEN — Préférences
   ------------------------------------------------------------------------- */
function SettingsScreen({ onBack, preferences, onChangePref }) {
  const groups = [
    {
      title: "Affichage", items: [
        { id: "lang", icon: Languages, label: "Langue", value: preferences.language, options: [{v:"fr", l:"Français"},{v:"en", l:"English"},{v:"es", l:"Español"}] },
        { id: "currency", icon: Euro, label: "Devise", value: preferences.currency, options: [{v:"EUR", l:"Euro (€)"},{v:"USD", l:"Dollar ($)"},{v:"GBP", l:"Livre (£)"}] },
        { id: "theme", icon: Moon, label: "Thème", value: preferences.theme, options: [{v:"dark", l:"Sombre"},{v:"light", l:"Clair"},{v:"auto", l:"Automatique"}] },
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
                    background: "var(--surface-2)", color: "var(--accent)",
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

        <div className="tp-card" style={{ padding: 14, background: "var(--surface)", display: "flex", gap: 10 }}>
          <Database size={16} style={{ color: "var(--text-dim)", flexShrink: 0, marginTop: 2 }}/>
          <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6 }}>
            Vos données sont chiffrées localement. La sauvegarde automatique synchronise chaque modification avec votre compte TrajetPro pour vous permettre de retrouver toutes vos données sur n'importe quel appareil.
          </div>
        </div>

        <div style={{ padding: "0 4px" }}>
          <button style={{ fontSize: 12, color: "var(--error)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 6 }}>
            Effacer toutes mes données locales
          </button>
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
          <Info size={16} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }}/>
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
        {/* Contact cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <a href="mailto:contact@trajetpro.fr" className="tp-card" style={{
            padding: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            background: "var(--surface)", textDecoration: "none", color: "var(--text)", cursor: "pointer",
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: "var(--accent-soft)",
              color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
            }}><Mail size={16}/></div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Email</div>
            <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Sous 24h ouvrées</div>
          </a>
          <button className="tp-card" style={{
            padding: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            background: "var(--surface)", cursor: "pointer", border: "1px solid var(--border)", color: "var(--text)",
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: "var(--accent-soft)",
              color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
            }}><MessageCircle size={16}/></div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Chat en direct</div>
            <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Lun-Ven · 9h-18h</div>
          </button>
        </div>

        {/* Guide */}
        <button className="tp-card" style={{
          width: "100%", padding: 16, display: "flex", alignItems: "center", gap: 12,
          background: "linear-gradient(135deg, rgba(244,185,66,0.1), rgba(244,185,66,0.02))",
          borderColor: "var(--accent-ring)", cursor: "pointer", textAlign: "left",
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 11,
            background: "var(--accent)", color: "#0B0B0D",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <BookOpen size={20}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Guide d'utilisation</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>Tutoriels vidéo et pas-à-pas</div>
          </div>
          <ArrowUpRight size={16} style={{ color: "var(--accent)" }}/>
        </button>

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

        {/* Emergency contact */}
        <div className="tp-card" style={{ padding: 14, background: "var(--surface)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9, background: "var(--success-soft)",
            color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Phone size={16}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Support urgent</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>+33 4 90 00 00 00 · 24h/24 pour pannes critiques</div>
          </div>
        </div>

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
            color: "#0B0B0D", fontSize: 9, fontWeight: 700,
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
  language: "fr", currency: "EUR", theme: "dark",
  notifRides: true, notifInvoices: true, notifMarketing: false,
  vatRate: 10, autoNumbering: true,
  biometric: true, autoBackup: true,
};

// Convertit une ligne `bookings` Supabase vers le format utilisé côté React.
// Le code historique manipule des objets en camelCase ; la DB est en snake_case.
function bookingFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    customerName: row.customer_name,
    phone: row.customer_phone || "",
    email: row.customer_email || "",
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
    date: row.issued_at ? row.issued_at.slice(0, 10) : "",
    status: row.status || "pending",
    fingerprint: row.fingerprint,
  };
}

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
    referralCode: row.referral_code,
    referredBy: row.referred_by,
    createdAt: row.created_at,
    lastMonthlyBonus: row.last_monthly_bonus_at,
    referralStats: {
      invitedCount: row.referrals_count || 0,
      tokensEarned: 0,    // calculé séparément si besoin
      friends: [],
    },
    phoneVerified: false,
    emailVerified: !!row.email_verified,
    siretVerified: !!row.siret_verified,
    vtcLicenseVerified: false,
    deviceFingerprint: row.device_fingerprint,
    deviceRegisteredAt: row.created_at,
    riskScore: row.risk_score || 0,
    flagged: !!row.flagged,
    tokenBalance: row.token_balance || 0,
  };
}

export default function App() {
  // --- Auth state ---
  // authScreen: "welcome" | "login" | "signup" | "device_blocked" | null
  const [authScreen, setAuthScreen] = useState("welcome");
  const [currentUser, setCurrentUser] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [blockedAccountInfo, setBlockedAccountInfo] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

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
  const [tokenBalance, setTokenBalance] = useState(INITIAL_TOKEN_BALANCE);
  const [tokenHistory, setTokenHistory] = useState(INITIAL_TOKEN_HISTORY);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);

  // --- UI state ---
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState(null);
  const [detailBooking, setDetailBooking] = useState(null);
  const [detailInvoice, setDetailInvoice] = useState(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseDetail, setPurchaseDetail] = useState(null);
  const [insufficientOpen, setInsufficientOpen] = useState(false);
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

  // --- Préférence "Rappel de courses" : si désactivée → annule tout,
  //     si réactivée → replanifie tout. Se déclenche aussi quand `bookings`
  //     change après login pour synchroniser la 1re fois.
  useEffect(() => {
    if (!isAuthenticated || isGuest) return;
    const upcoming = bookings.filter((b) => {
      const t = new Date(b.dateTime);
      return t.getTime() > Date.now() && b.status !== 'cancelled' && b.status !== 'completed';
    });
    rescheduleAllBookings(upcoming, { enabled: !!preferences.notifRides })
      .catch((e) => console.warn('reschedule on prefs change:', e?.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences.notifRides]);

  // --- Chargement des données utilisateur depuis Supabase ---
  // Appelé après login (ou au reload si la session existait déjà).
  // Charge profil + bookings + invoices + token_transactions.
  // Crédite aussi le bonus de parrainage si c'est la première connexion d'un filleul.
  const loadUserData = async (authUserId) => {
    if (!authUserId) return;
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
        return;
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
              { enabled: true },
            );
          }
        }
      } catch (e) {
        console.warn('Resync notifications échoué :', e?.message);
      }
    } catch (err) {
      console.error("Erreur chargement données :", err);
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

    // Vérifier la session existante au démarrage
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) {
        if (session?.user) {
          setAuthScreen(null);
          setIsGuest(false);
          await loadUserData(session.user.id);
          // Si on revient de Stripe Checkout, gérer le retour
          await handleCheckoutReturn(session.user.id);
        }
        setAuthChecked(true);
      }
    })();

    // Écouter les changements (login/logout depuis n'importe où)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_IN' && session?.user) {
        setAuthScreen(null);
        setIsGuest(false);
        await loadUserData(session.user.id);
        await handleCheckoutReturn(session.user.id);
        setTab("home");
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setIsGuest(false);
        setBookings([]);
        setInvoices([]);
        setTokenBalance(0);
        setTokenHistory([]);
        setAuthScreen("welcome");
        setTab("home");
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
      distance: 10,
      duration: 20,
      price: 0,
      notes: "",
      type: "forfait",
      ...parsed,
      // Si l'utilisateur a dicté un prix, on le respecte. Sinon on laisse
      // 0 (le formulaire calculera l'estimation automatique).
      price: parsed.price ?? 0,
      distance: parsed.distance ?? 10,
    });
    setFormOpen(true);
  };

  const onOpenVoice = () => {
    if (tokenBalance < COST_BOOKING) {
      setPendingActionLabel("créer une nouvelle réservation");
      setInsufficientOpen(true);
      return;
    }
    setVoiceOpen(true);
  };

  const onNewBooking = () => {
    if (tokenBalance < COST_BOOKING) {
      setPendingActionLabel("créer une nouvelle réservation");
      setInsufficientOpen(true);
      return;
    }
    setFormInitial(null);
    setFormOpen(true);
  };

  // --- Helper : recharge le solde + l'historique depuis Supabase ---
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
            .then((granted) => granted && scheduleBookingReminders(formatted))
            .catch((e) => console.warn('schedule:', e?.message));
        }
      } else {
        await sbUpdateBooking(b.id, b);
        setBookings(prev => prev.map(p => p.id === b.id ? b : p));
        // L'heure ou le client a peut-être changé : on annule + replanifie.
        if (preferences.notifRides) {
          scheduleBookingReminders(b).catch((e) => console.warn('reschedule:', e?.message));
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
    // Mode invité : pas de Supabase, on simule l'achat en mémoire.
    if (isGuest || !currentUser?.id) {
      setTokenBalance(t => t + purchase.tokens);
      setTokenHistory(prev => [purchase, ...prev]);
      return purchase;
    }

    // Mode connecté : redirection vers Stripe Checkout.
    // Le webhook stripe-webhook reçoit checkout.session.completed → crédite
    // les tokens et génère la facture. Au retour sur l'app (success_url),
    // le useEffect ci-dessous détecte ?purchase=success et rafraîchit les tokens.
    const packageId = purchase.packageId || purchase.package_id;
    if (!packageId) throw new Error("Pack inconnu (packageId manquant)");

    const { url } = await createCheckoutSession(packageId);
    if (!url) throw new Error("URL Stripe manquante");

    // Redirection — la suite du code ne s'exécute pas (le navigateur quitte la page).
    window.location.assign(url);
    // Promise non résolue : Stripe Checkout est ouvert, l'app va revenir via
    // success_url ou cancel_url. On laisse le loading actif sur la modale.
    return new Promise(() => { /* never resolves */ });
  };

  const onInsufficientBuy = () => {
    setInsufficientOpen(false);
    setPurchaseOpen(true);
  };

  const onChangePref = (key, value) => {
    const mapping = {
      lang: "language", currency: "currency", theme: "theme",
      notif_rides: "notifRides", notif_invoices: "notifInvoices", notif_marketing: "notifMarketing",
      vat: "vatRate", autonum: "autoNumbering",
      bio: "biometric", backup: "autoBackup",
    };
    const realKey = mapping[key] || key;
    const realValue = realKey === "vatRate" ? parseInt(value) : value;
    setPreferences(p => ({ ...p, [realKey]: realValue }));
  };

  // --- Routing ---
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

  let screen;
  if (detailBooking) {
    screen = <BookingDetail
      booking={detailBooking}
      onBack={() => setDetailBooking(null)}
      onEdit={(b) => { setDetailBooking(null); setFormInitial(b); setFormOpen(true); }}
      onDelete={onDeleteBooking}
      onInvoice={onInvoiceBooking}
    />;
  } else if (detailInvoice) {
    const relatedBooking = bookings.find(b => b.id === detailInvoice.bookingId);
    screen = <InvoiceDetail invoice={detailInvoice} booking={relatedBooking} onBack={() => setDetailInvoice(null)}/>;
  } else if (formOpen) {
    screen = <BookingForm
      initial={formInitial}
      onCancel={() => { setFormOpen(false); setFormInitial(null); }}
      onSave={onSaveBooking}
    />;
  } else {
    switch (tab) {
      case "home":
        screen = <HomeScreen bookings={bookings} invoices={invoices} tokenBalance={tokenBalance}
          isGuest={isGuest}
          onQuickVoice={onOpenVoice} onNewBooking={onNewBooking}
          onOpenBooking={setDetailBooking} onGoTab={setTab}
          onOpenPurchase={() => setPurchaseOpen(true)}
          onPromptSignup={onPromptSignup}/>;
        break;
      case "bookings":
        screen = <BookingsScreen bookings={bookings} tokenBalance={tokenBalance}
          onOpenBooking={setDetailBooking} onNewBooking={onNewBooking}
          onQuickVoice={onOpenVoice} onGoTab={setTab}/>;
        break;
      case "invoices":
        screen = <InvoicesScreen invoices={invoices} bookings={bookings} tokenBalance={tokenBalance}
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
        screen = <SettingsScreen onBack={() => setTab("profile")} preferences={preferences} onChangePref={onChangePref}/>;
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
          onLogout={onLogout} onPromptSignup={onPromptSignup}/>;
        break;
      default:
        screen = null;
    }
  }

  const showNav = !detailBooking && !detailInvoice && !formOpen
    && !["tokens", "referral", "settings", "terms", "help"].includes(tab);

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
          {showNav && (
            <BottomNav active={tab} onChange={setTab} onVoice={onOpenVoice}/>
          )}
          <VoiceCapture open={voiceOpen} onClose={() => setVoiceOpen(false)} onConfirm={onVoiceConfirm}/>
          <PurchaseModal open={purchaseOpen} onClose={() => setPurchaseOpen(false)} onConfirm={onPurchaseConfirm}/>
          <PurchaseDetailModal open={!!purchaseDetail} purchase={purchaseDetail} onClose={() => setPurchaseDetail(null)}/>
          <InsufficientModal
            open={insufficientOpen}
            onClose={() => setInsufficientOpen(false)}
            onBuy={onInsufficientBuy}
            action={pendingActionLabel}
            currentBalance={tokenBalance}
          />
          <MonthlyBonusToast open={monthlyBonusOpen} onClose={() => setMonthlyBonusOpen(false)}/>
        </div>
      </div>
    </>
  );
}
