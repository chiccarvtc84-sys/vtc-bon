// ============================================================================
// invoicePdf.js — Génération PDF de la facture
// ============================================================================
// Layout v2 (refonte 2026-05-06 sur demande utilisateur) :
//
//   ┌───────────────────────────────────────────────────────────────┐
//   │                                            ┌──────┐  Logo     │
//   │                                            └──────┘  optionnel │
//   │                                            FAC-2026-0001       │
//   │                                            06/05/2026          │
//   ├───────────────────────────────────────────────────────────────┤
//   │ ÉMETTEUR                       FACTURÉ À                       │
//   │ Nom de société                 Nom du client                   │
//   │ Adresse                        (adresse client si dispo)       │
//   │ Email                                                          │
//   │ Téléphone                                                      │
//   │ SIRET (toggle ON/OFF)                                          │
//   │ N° VTC (toggle ON/OFF)                                         │
//   ├───────────────────────────────────────────────────────────────┤
//   │ TRAJET EFFECTUÉ                                                │
//   │ Le 06/05/2026 à 14:30                                          │
//   │ Prise en charge : ...                                          │
//   │ Destination     : ...                                          │
//   │ Distance / Durée                                               │
//   ├───────────────────────────────────────────────────────────────┤
//   │ Montant HT     |  TVA 10%     |   Total TTC                    │
//   ├───────────────────────────────────────────────────────────────┤
//   │ [QR code]  Empreinte fiscale SHA-256 + mention contrôle        │
//   ├───────────────────────────────────────────────────────────────┤
//   │ Mentions légales (décret 2017-483, art. L441-10, etc.)         │
//   └───────────────────────────────────────────────────────────────┘
//
// API publique :
//   buildInvoicePdf(invoice, booking, profile, settings)  → Blob PDF
//   downloadInvoicePdf(...)                               → download web
//   getInvoicePdfDataUri(...)                             → data URI base64
//
// `settings` (4e arg) accepte :
//   - logo_data_url   : data:image/...;base64,... (PNG/JPG, max ~300px)
//   - show_siret      : bool, masquer la ligne SIRET si false
//   - show_vtc_number : bool, masquer la ligne n° VTC si false
//   - company_name, address (string|object), email, phone : overrides
// ============================================================================

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

const COLORS = {
  bg: '#0B0B0D',
  gold: '#F4B942',
  goldDark: '#C99632',
  text: '#1a1a1a',
  textMuted: '#6b6b70',
  border: '#d8d8dc',
  surface: '#f5f5f4',
};

const PAGE = { width: 210, height: 297, margin: 18 };

function eur(n) {
  if (typeof n !== 'number' || isNaN(n)) n = 0;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
  }).format(n);
}

// Format demandé : 06/05/2026 (XX/XX/20XX)
function formatDateShort(d) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Format avec heure : 06/05/2026 à 14:30
function formatDateTimeShort(d) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mn = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} à ${hh}:${mn}`;
}

/**
 * Construit le PDF de la facture et retourne un Blob.
 *
 * @param {object} invoice  — { number, date, customerName, amount, vatAmount, fingerprint, status }
 * @param {object} booking  — { dateTime, pickupAddress, dropoffAddress, distance, duration, passengers }
 * @param {object} profile  — DRIVER_PROFILE (companyName, siret, vtcNumber, etc.)
 * @param {object} settings — { logo_data_url, show_siret, show_vtc_number }
 */
export async function buildInvoicePdf(invoice, booking, profile, settings = {}) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = PAGE.width;
  const pageH = PAGE.height;
  const margin = PAGE.margin;
  const colMid = pageW / 2;

  // ─── Hiérarchie des sources de données pour la facture ──────────────
  // 1. settings.* (saisies par l'utilisateur dans Préférences → Facturation)
  // 2. profile.* (currentUser depuis Supabase, ex. email + name + phone)
  // 3. fallback vide ('') si rien n'est renseigné — la ligne ne sera pas
  //    affichée sur le PDF (chaque if test la valeur).
  // On NE retombe PAS sur les valeurs démo de DRIVER_PROFILE qui ne
  // correspondent pas au vrai chauffeur (TrajetPro Services / Moi Conducteur).
  // ⚠️ Ces consts DOIVENT être déclarées AVANT les `showXxx` ci-dessous,
  // sinon TDZ error "Cannot access 'siret' before initialization".
  const companyName = settings.company_name || profile.companyName || profile.name || '';
  const address = settings.address || profile.address || '';
  const email = settings.email || profile.email || '';
  const phone = settings.phone || profile.phone || '';
  const siret = profile.siret || '';
  const vtcNumber = settings.vtc_number || profile.vtcNumber || '';
  const proCardNumber = settings.pro_card_number || profile.proCardNumber || '';
  const vehicleModel = settings.vehicle_model || profile.vehicleModel || '';
  const vehiclePlate = settings.vehicle_plate || profile.vehiclePlate || '';

  // Toggles ON par défaut, mais on n'affiche que si la valeur sous-jacente
  // existe (évite les lignes vides type "Forme juridique : ").
  const showSiret = settings.show_siret !== false && Boolean(siret);
  const showVtcNumber = settings.show_vtc_number !== false && Boolean(vtcNumber);
  const showLegalForm = settings.show_legal_form !== false && Boolean(settings.legal_form);
  const showVatNumber = settings.show_vat_number !== false && Boolean(settings.vat_number);
  const showVehiclePlate = settings.show_vehicle_plate !== false && Boolean(vehiclePlate);
  const logoDataUrl = settings.logo_data_url || null;

  // ─── Bandeau supérieur : numéro + date à droite, logo si présent ────
  let topY = margin;
  const rightX = pageW - margin;

  // Logo en haut à droite (si fourni)
  if (logoDataUrl && typeof logoDataUrl === 'string' && logoDataUrl.startsWith('data:')) {
    try {
      // On dimensionne le logo à max 30mm de large × 30mm de haut
      const LOGO_MAX = 28;
      pdf.addImage(logoDataUrl, 'PNG', rightX - LOGO_MAX, topY, LOGO_MAX, LOGO_MAX, undefined, 'FAST');
    } catch (e) {
      console.warn('[invoicePdf] échec ajout logo :', e?.message);
    }
  }

  // Numéro de facture sous le logo (ou en haut à droite si pas de logo)
  const numberY = logoDataUrl ? topY + 34 : topY + 8;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(COLORS.text);
  pdf.text(invoice.number || invoice.invoice_number || 'FAC-XXXX', rightX, numberY, { align: 'right' });

  // Date en dessous
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(COLORS.textMuted);
  pdf.text(formatDateShort(invoice.date || invoice.issued_at || new Date()), rightX, numberY + 5, { align: 'right' });

  // Titre "FACTURE" à gauche
  pdf.setFont('times', 'bold');
  pdf.setFontSize(26);
  pdf.setTextColor(COLORS.goldDark);
  pdf.text('FACTURE', margin, topY + 12);

  // ─── Séparateur ──────────────────────────────────────────────────────
  let y = Math.max(numberY + 12, topY + 40);
  pdf.setDrawColor(COLORS.gold);
  pdf.setLineWidth(0.4);
  pdf.line(margin, y, rightX, y);
  y += 8;

  // ─── 2 colonnes : Émetteur (gauche) / Facturé à (droite) ─────────────
  const col1X = margin;
  const col2X = colMid + 4;

  // Headers
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(COLORS.goldDark);
  pdf.text('ÉMETTEUR', col1X, y);
  pdf.text('FACTURÉ À', col2X, y);
  y += 5;

  // Émetteur (gauche)
  let leftY = y;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(COLORS.text);
  pdf.text(companyName || 'Société', col1X, leftY);
  leftY += 5;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(COLORS.textMuted);

  // Adresse (peut être multi-lignes)
  if (address) {
    const lines = String(address).split('\n').slice(0, 3); // max 3 lignes
    for (const line of lines) {
      pdf.text(line, col1X, leftY);
      leftY += 4;
    }
  }
  if (email) {
    pdf.text(email, col1X, leftY);
    leftY += 4;
  }
  if (phone) {
    pdf.text(phone, col1X, leftY);
    leftY += 4;
  }
  // Forme juridique (toggleable, depuis settings)
  if (showLegalForm) {
    pdf.text(`Forme juridique : ${settings.legal_form}`, col1X, leftY);
    leftY += 4;
  }
  // SIRET (toggleable)
  if (showSiret) {
    pdf.text(`SIRET : ${siret}`, col1X, leftY);
    leftY += 4;
  }
  // N° TVA intracommunautaire (toggleable, depuis settings)
  if (showVatNumber) {
    pdf.text(`N° TVA intracom. : ${settings.vat_number}`, col1X, leftY);
    leftY += 4;
  }
  // N° VTC (toggleable)
  if (showVtcNumber) {
    pdf.text(`N° VTC : ${vtcNumber}`, col1X, leftY);
    leftY += 4;
  }
  // Immatriculation véhicule (toggleable)
  if (showVehiclePlate) {
    pdf.text(`Immatriculation : ${vehiclePlate}`, col1X, leftY);
    leftY += 4;
  }
  // Modèle du véhicule (sans toggle, affiché si renseigné)
  if (vehicleModel) {
    pdf.text(`Véhicule : ${vehicleModel}`, col1X, leftY);
    leftY += 4;
  }
  // Carte pro (toujours, c'est une obligation décret 2017-483)
  if (proCardNumber) {
    pdf.text(`Carte pro. : ${proCardNumber}`, col1X, leftY);
    leftY += 4;
  }

  // ─── Facturé à (colonne droite, en face de l'émetteur) ──────────────
  // Logique :
  //   - Si une société client est renseignée (booking.customerCompany) :
  //     Société en titre + nom du contact (customerName) en sous-ligne
  //   - Sinon : nom du contact en titre + "Particulier" en sous-ligne
  //   - Puis : adresse, téléphone, email si renseignés (n'affiche jamais
  //     une ligne avec un libellé vide).
  let rightColY = y;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(COLORS.text);

  const customerCompany = booking?.customerCompany || invoice.customerCompany || '';
  const customerName = invoice.customerName || invoice.customer_name || booking?.customerName || 'Client';

  if (customerCompany) {
    // Mode société : société en gros, contact en dessous
    pdf.text(customerCompany, col2X, rightColY);
    rightColY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(COLORS.textMuted);
    pdf.text(`Contact : ${customerName}`, col2X, rightColY);
    rightColY += 4;
  } else {
    // Mode particulier : nom complet en gros
    pdf.text(customerName, col2X, rightColY);
    rightColY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(COLORS.textMuted);
    pdf.text('Particulier', col2X, rightColY);
    rightColY += 4;
  }

  // Adresse de facturation client (si renseignée, peut être multi-lignes)
  const customerAddress = booking?.customerAddress || invoice.customerAddress || '';
  if (customerAddress) {
    const lines = String(customerAddress).split('\n').slice(0, 3);
    for (const line of lines) {
      pdf.text(line, col2X, rightColY);
      rightColY += 4;
    }
  }

  // Téléphone client
  const customerPhone = booking?.phone || booking?.customer_phone || invoice.customerPhone || '';
  if (customerPhone) {
    pdf.text(`Tél. : ${customerPhone}`, col2X, rightColY);
    rightColY += 4;
  }

  // Email client
  const customerEmail = booking?.customerEmail || booking?.customer_email || invoice.customerEmail || '';
  if (customerEmail) {
    pdf.text(customerEmail, col2X, rightColY);
    rightColY += 4;
  }

  // ─── Séparateur après les 2 colonnes ─────────────────────────────────
  y = Math.max(leftY, rightColY) + 6;
  pdf.setDrawColor(COLORS.border);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, rightX, y);
  y += 8;

  // ─── Section TRAJET EFFECTUÉ ─────────────────────────────────────────
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(COLORS.goldDark);
  pdf.text('TRAJET EFFECTUÉ', margin, y);
  y += 6;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(COLORS.text);

  if (booking) {
    // Date et heure exacte du trajet (format XX/XX/20XX à HH:MM)
    if (booking.dateTime || booking.date_time) {
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Le ${formatDateTimeShort(booking.dateTime || booking.date_time)}`, margin, y);
      y += 6;
    }

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(COLORS.textMuted);

    if (booking.pickupAddress || booking.pickup_address) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Prise en charge :', margin, y);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${booking.pickupAddress || booking.pickup_address}`, margin + 32, y);
      y += 5;
    }

    if (booking.dropoffAddress || booking.dropoff_address) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Destination :', margin, y);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${booking.dropoffAddress || booking.dropoff_address}`, margin + 32, y);
      y += 5;
    }

    // Demande utilisateur : afficher uniquement le kilométrage
    // (pas de durée ni nombre de passagers, qui ne sont pas pertinents
    // pour la facture finale).
    pdf.setFont('helvetica', 'normal');
    const distKm = booking.distance || booking.distance_km;
    if (distKm) {
      pdf.setTextColor(COLORS.textMuted);
      pdf.text(`Distance : ${distKm} km`, margin, y);
      y += 5;
    }
  } else {
    // Fallback si pas de booking : utiliser la date d'émission
    pdf.setFontSize(9);
    pdf.setTextColor(COLORS.textMuted);
    pdf.text(`Prestation de transport VTC du ${formatDateShort(invoice.date || invoice.issued_at)}`, margin, y);
    y += 5;
  }

  // ─── Séparateur avant montants ──────────────────────────────────────
  y += 4;
  pdf.setDrawColor(COLORS.border);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, rightX, y);
  y += 8;

  // ─── Montants HT / TVA / TTC ─────────────────────────────────────────
  const totalTTC = Number(invoice.amount || invoice.amount_ttc || 0);
  const vatAmount = Number(invoice.vatAmount || invoice.amount_vat || 0);
  const totalHT = totalTTC - vatAmount;
  const vatRate = profile.vatRate || 10;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(COLORS.textMuted);
  pdf.text('Montant HT', margin, y);
  pdf.setTextColor(COLORS.text);
  pdf.text(eur(totalHT), rightX, y, { align: 'right' });
  y += 6;

  pdf.setTextColor(COLORS.textMuted);
  pdf.text(`TVA (${vatRate} %)`, margin, y);
  pdf.setTextColor(COLORS.text);
  pdf.text(eur(vatAmount), rightX, y, { align: 'right' });
  y += 8;

  // Total TTC en gros doré
  pdf.setDrawColor(COLORS.gold);
  pdf.setLineWidth(0.6);
  pdf.line(margin, y - 2, rightX, y - 2);
  pdf.setFont('times', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(COLORS.text);
  pdf.text('Total TTC', margin, y + 5);
  pdf.setTextColor(COLORS.goldDark);
  pdf.setFontSize(20);
  pdf.text(eur(totalTTC), rightX, y + 6, { align: 'right' });
  y += 14;

  // ─── Mentions légales ───────────────────────────────────────────────
  // Bloc empreinte fiscale + QR code retiré le 2026-05-08 — il n'avait pas
  // de validité légale réelle (l'empreinte n'était pas scellée/horodatée
  // par un tiers de confiance) et créait de la confusion. La conformité CGI
  // est assurée par : numérotation chronologique + traçabilité Stripe +
  // mentions obligatoires ci-dessous.
  y += 6;

  pdf.setFontSize(7);
  pdf.setTextColor(COLORS.textMuted);
  pdf.setFont('helvetica', 'normal');

  const legals = [
    'Transport public particulier de personnes (VTC) — Décret n° 2017-483 du 6 avril 2017.',
    `TVA collectée au taux de ${vatRate} % (transport de personnes).`,
    'Conditions de paiement : à réception. Pas d\'escompte pour paiement anticipé.',
    'Pénalités de retard : 3× taux d\'intérêt légal · Indemnité forfaitaire 40 € (art. L441-10 C. com.).',
  ];

  legals.forEach((line) => {
    pdf.text(line, margin, y);
    y += 3.5;
  });

  // ─── Footer fixe en bas de page ──────────────────────────────────────
  const footerY = pageH - 12;
  pdf.setDrawColor(COLORS.border);
  pdf.setLineWidth(0.2);
  pdf.line(margin, footerY - 4, rightX, footerY - 4);
  pdf.setFontSize(7);
  pdf.setTextColor(COLORS.textMuted);
  pdf.text(
    `Page 1 / 1 · ${invoice.number || invoice.invoice_number || ''} · ${companyName}`,
    pageW / 2, footerY, { align: 'center' }
  );

  return pdf.output('blob');
}

/**
 * Déclenche un téléchargement client-side du PDF (web).
 */
/**
 * Télécharge le PDF d'une facture.
 *
 * - Web : crée un Blob URL + lien <a download> qui déclenche le téléchargement
 *   classique du navigateur.
 * - iOS / Android (Capacitor natif) : <a download> est BLOQUÉ par WKWebView.
 *   On écrit donc le PDF dans le dossier cache de l'app via @capacitor/filesystem
 *   puis on ouvre la feuille de partage iOS via @capacitor/share avec le path
 *   `file://...` du PDF — l'utilisateur peut alors "Enregistrer dans Fichiers",
 *   AirDrop, l'envoyer par mail, etc. C'est le pattern standard pour
 *   "télécharger" un fichier dans une app native iOS.
 */
export async function downloadInvoicePdf(invoice, booking, profile, settings) {
  const blob = await buildInvoicePdf(invoice, booking, profile, settings);
  const filename = `${invoice.number || invoice.invoice_number || 'facture'}.pdf`;

  // Détection plateforme dynamique (n'impacte pas le bundle web).
  let isNative = false;
  try {
    const { Capacitor } = await import('@capacitor/core');
    isNative = Capacitor.isNativePlatform();
  } catch { /* env web pur */ }

  if (isNative) {
    // 1. Convertir le blob en base64 pour l'API Filesystem
    const base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        // result est "data:application/pdf;base64,XXXX..." → on garde seulement XXXX
        const base64 = result.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');

    // 2. Écrire le fichier dans le dossier cache de l'app.
    // Cache plutôt que Documents : auto-purgé par iOS si stockage faible,
    // pas de besoin de Backup iCloud pour un PDF de partage temporaire.
    const writeResult = await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true,
    });

    // 3. Ouvrir la feuille de partage iOS native pour permettre l'export.
    await Share.share({
      title: `Facture ${invoice.number || ''}`,
      url: writeResult.uri,
      dialogTitle: 'Enregistrer ou partager la facture',
    });
    return;
  }

  // Web : flow classique <a download>
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1000);
}

/** Renvoie le PDF en data URI base64. */
export async function getInvoicePdfDataUri(invoice, booking, profile, settings) {
  const blob = await buildInvoicePdf(invoice, booking, profile, settings);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
