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

  const showSiret = settings.show_siret !== false;
  const showVtcNumber = settings.show_vtc_number !== false;
  const logoDataUrl = settings.logo_data_url || null;

  // Override possibles depuis settings, sinon profile
  const companyName = settings.company_name || profile.companyName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
  const address = settings.address || profile.address || profile.baseCity || '';
  const email = settings.email || profile.email || '';
  const phone = settings.phone || profile.phone || '';

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
  // SIRET (toggleable)
  if (showSiret && profile.siret) {
    pdf.text(`SIRET : ${profile.siret}`, col1X, leftY);
    leftY += 4;
  }
  // N° VTC (toggleable)
  if (showVtcNumber && profile.vtcNumber) {
    pdf.text(`N° VTC : ${profile.vtcNumber}`, col1X, leftY);
    leftY += 4;
  }
  // Carte pro (toujours, c'est une obligation décret 2017-483)
  if (profile.proCardNumber) {
    pdf.text(`Carte pro. : ${profile.proCardNumber}`, col1X, leftY);
    leftY += 4;
  }

  // Facturé à (droite, en face)
  let rightColY = y;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(COLORS.text);
  pdf.text(invoice.customerName || invoice.customer_name || 'Client', col2X, rightColY);
  rightColY += 5;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(COLORS.textMuted);
  pdf.text('Particulier', col2X, rightColY);
  rightColY += 4;

  // Si on a un téléphone ou email client (booking.phone ou customer fields)
  if (booking?.phone) {
    pdf.text(`Tél. : ${booking.phone}`, col2X, rightColY);
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

    pdf.setFont('helvetica', 'normal');
    const distKm = booking.distance || booking.distance_km;
    const durMin = booking.duration || booking.duration_min;
    const pax = booking.passengers;
    const meta = [
      distKm ? `${distKm} km` : null,
      durMin ? `${durMin} min` : null,
      pax ? `${pax} passager${pax > 1 ? 's' : ''}` : null,
    ].filter(Boolean).join(' · ');
    if (meta) {
      pdf.setTextColor(COLORS.textMuted);
      pdf.text(meta, margin, y);
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

  // ─── Empreinte fiscale + QR code ─────────────────────────────────────
  y += 4;
  pdf.setFillColor(COLORS.surface);
  pdf.roundedRect(margin, y, rightX - margin, 28, 2, 2, 'F');

  // QR code à gauche
  const qrPayload = JSON.stringify({
    n: invoice.number || invoice.invoice_number,
    fp: invoice.fingerprint,
    a: totalTTC,
    d: formatDateShort(invoice.date || invoice.issued_at),
  });
  try {
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 200, margin: 1,
      color: { dark: COLORS.text, light: '#ffffff' },
    });
    pdf.addImage(qrDataUrl, 'PNG', margin + 3, y + 3, 22, 22);
  } catch (_e) { /* QR optionnel */ }

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.goldDark);
  pdf.text('EMPREINTE FISCALE (SHA-256)', margin + 28, y + 7);

  pdf.setFont('courier', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(COLORS.text);
  const fp = String(invoice.fingerprint || '').slice(0, 64);
  pdf.text(fp.slice(0, 32), margin + 28, y + 12);
  pdf.text(fp.slice(32, 64), margin + 28, y + 16);

  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(7);
  pdf.setTextColor(COLORS.textMuted);
  pdf.text('Authentifiable en cas de contrôle fiscal · QR code scannable', margin + 28, y + 22);

  y += 34;

  // ─── Mentions légales ───────────────────────────────────────────────
  pdf.setFontSize(7);
  pdf.setTextColor(COLORS.textMuted);
  pdf.setFont('helvetica', 'normal');

  const legals = [
    'Facture générée électroniquement et signée par empreinte fiscale SHA-256.',
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
export async function downloadInvoicePdf(invoice, booking, profile, settings) {
  const blob = await buildInvoicePdf(invoice, booking, profile, settings);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${invoice.number || invoice.invoice_number || 'facture'}.pdf`;
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
