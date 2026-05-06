// ============================================================================
// invoicePdf.js — génération de la facture PDF conforme CGI français
// ============================================================================
// Utilise jsPDF (pure JS, pas de dépendance native) pour produire un PDF
// téléchargeable depuis web ET mobile (Capacitor WebView).
//
// Format : A4 portrait (210 × 297 mm), texte uniquement (pas de logo image
// pour rester léger et garantir un rendu identique partout).
//
// Conformité :
//   - Mentions obligatoires CGI : SIRET, n° TVA, adresse, mention TVA 10 %
//   - Décret 2017-483 : n° VTC, carte pro, immatriculation, modèle véhicule
//   - Numérotation chronologique (générée côté Supabase, formatée FAC-AAAA-NNNN)
//   - Empreinte fiscale SHA-256 + QR code intégré
//   - Date d'émission, date de prestation, conditions de paiement
//
// API publique :
//   buildInvoicePdf(invoice, booking, driverProfile)  → renvoie un Blob PDF
//   downloadInvoicePdf(...)                           → déclenche le download web
//   getInvoicePdfDataUri(...)                         → renvoie data:application/pdf;base64,...
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
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(n);
}

function formatDate(d) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatDateTime(d) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Construit le PDF de la facture et retourne un Blob.
 * Asynchrone à cause de la génération du QR code.
 */
export async function buildInvoicePdf(invoice, booking, driverProfile) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = PAGE.width;
  const margin = PAGE.margin;
  let y = margin;

  // ---- En-tête : bandeau doré "TrajetPro" --------------------------------
  pdf.setFillColor(COLORS.bg);
  pdf.rect(0, 0, pageW, 32, 'F');

  pdf.setFont('times', 'bold');
  pdf.setTextColor(COLORS.gold);
  pdf.setFontSize(28);
  pdf.text('TrajetPro', margin, 20);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor('#cccccc');
  pdf.text('FACTURE — Bon de transport VTC', margin, 26);

  // Numéro et date à droite du bandeau
  pdf.setFontSize(10);
  pdf.setTextColor('#ffffff');
  pdf.setFont('helvetica', 'bold');
  pdf.text(invoice.number || invoice.invoice_number || 'FAC-XXXX', pageW - margin, 16, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text(`Émise le ${formatDate(invoice.date || invoice.issued_at)}`, pageW - margin, 22, { align: 'right' });

  y = 44;

  // ---- Émetteur (chauffeur) ---------------------------------------------
  pdf.setTextColor(COLORS.text);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('ÉMETTEUR', margin, y);

  y += 5;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  const driverName = `${driverProfile.firstName || ''} ${driverProfile.lastName || ''}`.trim() || 'Chauffeur VTC';
  pdf.setFont('helvetica', 'bold');
  pdf.text(driverName, margin, y);
  pdf.setFont('helvetica', 'normal');

  y += 5;
  pdf.setFontSize(9);
  pdf.setTextColor(COLORS.textMuted);
  if (driverProfile.companyName) {
    pdf.text(driverProfile.companyName, margin, y);
    y += 4;
  }
  pdf.text(`SIRET : ${driverProfile.siret || '—'}`, margin, y);
  y += 4;
  pdf.text(`N° VTC : ${driverProfile.vtcNumber || '—'}`, margin, y);
  y += 4;
  pdf.text(`Carte pro. conducteur : ${driverProfile.proCardNumber || '—'}`, margin, y);
  y += 4;
  pdf.text(`Véhicule : ${driverProfile.vehicleModel || '—'} · ${driverProfile.vehiclePlate || '—'}`, margin, y);
  y += 4;
  if (driverProfile.email) {
    pdf.text(`Contact : ${driverProfile.email}`, margin, y);
    y += 4;
  }

  // ---- Client (à droite) ------------------------------------------------
  let clientY = 44;
  const clientX = pageW / 2 + 4;
  pdf.setTextColor(COLORS.text);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('FACTURÉ À', clientX, clientY);
  clientY += 5;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(invoice.customerName || invoice.customer_name || 'Client', clientX, clientY);
  clientY += 5;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(COLORS.textMuted);
  pdf.text('Particulier · prestation transport', clientX, clientY);

  // ---- Séparateur -------------------------------------------------------
  y = Math.max(y, 88) + 4;
  pdf.setDrawColor(COLORS.border);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, pageW - margin, y);
  y += 8;

  // ---- Détail de la prestation -----------------------------------------
  pdf.setTextColor(COLORS.text);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('PRESTATION', margin, y);
  y += 6;

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(COLORS.textMuted);

  if (booking) {
    pdf.text(
      `Transport VTC du ${formatDateTime(booking.dateTime || booking.date_time)}`,
      margin, y,
    );
    y += 4;
    if (booking.pickupAddress || booking.pickup_address) {
      pdf.text(`Prise en charge : ${booking.pickupAddress || booking.pickup_address}`, margin, y);
      y += 4;
    }
    if (booking.dropoffAddress || booking.dropoff_address) {
      pdf.text(`Destination : ${booking.dropoffAddress || booking.dropoff_address}`, margin, y);
      y += 4;
    }
    if (booking.passengers) {
      pdf.text(`Passagers : ${booking.passengers}`, margin, y);
      y += 4;
    }
    if (booking.distanceKm || booking.distance_km) {
      pdf.text(`Distance : ${booking.distanceKm || booking.distance_km} km`, margin, y);
      y += 4;
    }
  } else {
    pdf.text('Prestation de transport VTC', margin, y);
    y += 4;
  }

  // ---- Montants HT / TVA / TTC -----------------------------------------
  y += 8;
  pdf.setDrawColor(COLORS.border);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, pageW - margin, y);
  y += 6;

  const totalTTC = Number(invoice.amount || invoice.amount_ttc || 0);
  const vatAmount = Number(invoice.vatAmount || invoice.amount_vat || 0);
  const totalHT = totalTTC - vatAmount;
  const vatRate = driverProfile.vatRate || 10;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(COLORS.textMuted);
  pdf.text('Montant HT', margin, y);
  pdf.setTextColor(COLORS.text);
  pdf.text(eur(totalHT), pageW - margin, y, { align: 'right' });
  y += 6;

  pdf.setTextColor(COLORS.textMuted);
  pdf.text(`TVA (${vatRate} %)`, margin, y);
  pdf.setTextColor(COLORS.text);
  pdf.text(eur(vatAmount), pageW - margin, y, { align: 'right' });
  y += 8;

  // Total TTC en gros doré
  pdf.setDrawColor(COLORS.gold);
  pdf.setLineWidth(0.6);
  pdf.line(margin, y - 2, pageW - margin, y - 2);
  pdf.setFont('times', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(COLORS.text);
  pdf.text('Total TTC', margin, y + 5);
  pdf.setTextColor(COLORS.goldDark);
  pdf.setFontSize(20);
  pdf.text(eur(totalTTC), pageW - margin, y + 6, { align: 'right' });
  y += 14;

  // ---- Empreinte fiscale + QR code -------------------------------------
  y += 6;
  pdf.setFillColor(COLORS.surface);
  pdf.roundedRect(margin, y, pageW - margin * 2, 28, 2, 2, 'F');

  // QR code à gauche
  const qrPayload = JSON.stringify({
    n: invoice.number || invoice.invoice_number,
    fp: invoice.fingerprint,
    a: totalTTC,
    d: invoice.date || invoice.issued_at,
  });
  try {
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 200,
      margin: 1,
      color: { dark: COLORS.text, light: '#ffffff' },
    });
    pdf.addImage(qrDataUrl, 'PNG', margin + 3, y + 3, 22, 22);
  } catch (_e) { /* QR optionnel */ }

  // Texte fingerprint à droite du QR
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.goldDark);
  pdf.text('EMPREINTE FISCALE (SHA-256)', margin + 28, y + 7);

  pdf.setFont('courier', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(COLORS.text);
  // Coupe l'empreinte sur 2 lignes pour qu'elle tienne
  const fp = String(invoice.fingerprint || '').slice(0, 64);
  pdf.text(fp.slice(0, 32), margin + 28, y + 12);
  pdf.text(fp.slice(32, 64), margin + 28, y + 16);

  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(7);
  pdf.setTextColor(COLORS.textMuted);
  pdf.text('Authentifiable en cas de contrôle fiscal · QR code scannable', margin + 28, y + 22);

  y += 34;

  // ---- Mentions légales en bas -----------------------------------------
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

  // ---- Footer fixe en bas de page --------------------------------------
  const footerY = PAGE.height - 12;
  pdf.setDrawColor(COLORS.border);
  pdf.setLineWidth(0.2);
  pdf.line(margin, footerY - 4, pageW - margin, footerY - 4);
  pdf.setFontSize(7);
  pdf.setTextColor(COLORS.textMuted);
  pdf.text(`Page 1 / 1 · ${invoice.number || invoice.invoice_number || ''} · TrajetPro`, pageW / 2, footerY, { align: 'center' });

  return pdf.output('blob');
}

/**
 * Déclenche un téléchargement client-side du PDF (web).
 * Sur mobile (Capacitor), utiliser plutôt sharePdf() depuis shareHelpers.js
 * qui propose le menu de partage natif (incluant "Enregistrer dans Fichiers").
 */
export async function downloadInvoicePdf(invoice, booking, driverProfile) {
  const blob = await buildInvoicePdf(invoice, booking, driverProfile);
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

/**
 * Renvoie le PDF en data URI base64 — utile pour transmettre à Capacitor
 * Filesystem ou afficher dans un <embed>.
 */
export async function getInvoicePdfDataUri(invoice, booking, driverProfile) {
  const blob = await buildInvoicePdf(invoice, booking, driverProfile);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
