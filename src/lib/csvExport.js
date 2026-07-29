// ============================================================================
// csvExport.js — export comptable mensuel (factures + bons)
// ============================================================================
// Génère un fichier CSV (Comma Separated Values) avec encoding UTF-8 BOM
// pour qu'Excel l'ouvre correctement avec les accents français.
//
// Formats produits :
//   1. Export factures du mois (pour le comptable, conforme CGI)
//   2. Export bons de course du mois (suivi d'activité)
//
// Le CSV utilise le séparateur point-virgule (`;`) qui est le standard
// français Excel — le séparateur virgule provoque des bugs avec les
// nombres décimaux français (ex. "12,50" serait coupé en 2 colonnes).
// ============================================================================

const SEP = ';';

// BOM UTF-8 (3 bytes) pour qu'Excel reconnaisse l'encoding
const BOM = '﻿';

// Une cellule commençant par l'un de ces caractères est interprétée comme une
// FORMULE par Excel/LibreOffice/Google Sheets — y compris quand elle est entre
// guillemets dans le CSV. Comme le nom du client et les adresses sont de la
// saisie libre, un client malveillant (ou un simple copier-coller) peut faire
// exécuter une formule chez le comptable qui ouvre l'export.
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;
// Les montants français produits par formatNumber ("1234,50", "-12,50")
// commencent parfois par « - » : on ne doit pas les neutraliser, sinon Excel
// les traiterait comme du texte et les totaux ne se calculeraient plus.
const PLAIN_NUMBER = /^-?[\d\s.,]+$/;

/**
 * Échappe une valeur CSV : guillemets autour si la valeur contient
 * `;`, `"`, `\r` ou `\n`. Les guillemets internes sont doublés.
 * Neutralise aussi les formules (préfixe apostrophe, invisible à l'affichage).
 */
function escape(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (FORMULA_TRIGGERS.test(s) && !PLAIN_NUMBER.test(s)) {
    s = `'${s}`;
  }
  if (s.includes(SEP) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatNumber(n) {
  if (typeof n !== 'number' || isNaN(n)) return '';
  // Format français : 1234.5 → "1234,50" (sans séparateur de millier
  // pour ne pas confondre Excel)
  return n.toFixed(2).replace('.', ',');
}

function formatDate(d) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function downloadCsv(filename, content) {
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8' });
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

/**
 * Filtre les factures pour ne garder que celles du mois donné.
 *
 * @param {Array} invoices — tableau d'objets `{ date, amount, vatAmount, ... }`
 * @param {Date|number} month — date dans le mois cible (ex. new Date(2026, 4, 1))
 * @returns {Array}
 */
export function filterByMonth(items, month) {
  const m = typeof month === 'number' ? new Date(month) : month;
  const yyyy = m.getFullYear();
  const mm = m.getMonth();
  return items.filter((it) => {
    const d = new Date(it.date || it.dateTime || it.created_at);
    return d.getFullYear() === yyyy && d.getMonth() === mm;
  });
}

/**
 * Export factures du mois — format pensé pour le comptable.
 * Colonnes : N° facture, Date, Client, Montant HT, TVA 10%, Montant TTC,
 *            Empreinte fiscale, Statut.
 *
 * @param {Array} invoices  — toutes les factures de l'utilisateur
 * @param {Array} bookings  — pour récupérer les détails de la prestation
 * @param {Date} monthDate  — date dans le mois cible
 */
export function exportInvoicesCsv(invoices, bookings, monthDate) {
  const filtered = filterByMonth(invoices, monthDate);
  const monthLabel = monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const headers = [
    'N° facture',
    'Date émission',
    'Client',
    'Date prestation',
    'Trajet',
    'Distance (km)',
    'Montant HT (€)',
    'TVA 10% (€)',
    'Montant TTC (€)',
    'Statut',
    'Empreinte fiscale',
  ];

  const rows = filtered.map((inv) => {
    const booking = bookings.find((b) => b.id === inv.bookingId);
    const ht = (inv.amount || 0) - (inv.vatAmount || 0);
    return [
      inv.number || inv.invoice_number || '',
      formatDate(inv.date || inv.issued_at),
      inv.customerName || inv.customer_name || '',
      booking ? formatDate(booking.dateTime) : '',
      booking ? `${booking.pickupAddress || ''} → ${booking.dropoffAddress || ''}` : '',
      booking ? booking.distance || '' : '',
      formatNumber(ht),
      formatNumber(inv.vatAmount || 0),
      formatNumber(inv.amount || 0),
      inv.status === 'paid' ? 'Payée' : 'En attente',
      inv.fingerprint || '',
    ].map(escape).join(SEP);
  });

  // Ligne de total à la fin
  const totalHT = filtered.reduce((s, i) => s + ((i.amount || 0) - (i.vatAmount || 0)), 0);
  const totalVAT = filtered.reduce((s, i) => s + (i.vatAmount || 0), 0);
  const totalTTC = filtered.reduce((s, i) => s + (i.amount || 0), 0);
  const totalRow = [
    `TOTAL (${filtered.length} facture${filtered.length > 1 ? 's' : ''})`,
    '', '', '', '', '',
    formatNumber(totalHT),
    formatNumber(totalVAT),
    formatNumber(totalTTC),
    '', '',
  ].map(escape).join(SEP);

  const csv = [headers.map(escape).join(SEP), ...rows, '', totalRow].join('\r\n');
  const safeMonth = monthLabel.replace(/\s/g, '_').toLowerCase();
  downloadCsv(`factures_${safeMonth}.csv`, csv);
  return { count: filtered.length, totalTTC, totalHT, totalVAT };
}

/**
 * Export bons de course du mois — vue d'activité chauffeur.
 * Colonnes : Date, Client, Trajet, Distance, Durée, Prix, Statut, Notes.
 */
export function exportBookingsCsv(bookings, monthDate) {
  const filtered = filterByMonth(bookings, monthDate)
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  const monthLabel = monthDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const headers = [
    'Date',
    'Heure',
    'Client',
    'Téléphone',
    'Prise en charge',
    'Destination',
    'Distance (km)',
    'Durée (min)',
    'Passagers',
    'Prix TTC (€)',
    'Statut',
    'Référence',
  ];

  const rows = filtered.map((b) => {
    const dt = new Date(b.dateTime);
    return [
      formatDate(dt),
      dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      b.customerName || '',
      b.phone || '',
      b.pickupAddress || '',
      b.dropoffAddress || '',
      b.distance || '',
      b.duration || '',
      b.passengers || '',
      formatNumber(b.price || 0),
      b.status === 'completed' ? 'Effectuée' : (b.status === 'cancelled' ? 'Annulée' : 'À venir'),
      b.id ? b.id.slice(0, 8).toUpperCase() : '',
    ].map(escape).join(SEP);
  });

  const totalRevenue = filtered.reduce((s, b) => s + (b.price || 0), 0);
  const totalDistance = filtered.reduce((s, b) => s + (b.distance || 0), 0);
  const totalRow = [
    `TOTAL (${filtered.length} course${filtered.length > 1 ? 's' : ''})`,
    '', '', '', '', '',
    totalDistance,
    '', '',
    formatNumber(totalRevenue),
    '', '',
  ].map(escape).join(SEP);

  const csv = [headers.map(escape).join(SEP), ...rows, '', totalRow].join('\r\n');
  const safeMonth = monthLabel.replace(/\s/g, '_').toLowerCase();
  downloadCsv(`courses_${safeMonth}.csv`, csv);
  return { count: filtered.length, totalRevenue, totalDistance };
}
