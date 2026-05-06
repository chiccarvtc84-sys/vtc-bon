// ============================================================================
// shareHelpers.js — wrappers Partage / Email / SMS / Calendrier
// ============================================================================
// Combine 3 méthodes selon la plateforme :
//
//   1. Capacitor Share plugin (iOS/Android natif) — affiche le menu de
//      partage système (WhatsApp, Mail, SMS, Notes, AirDrop, Slack, …)
//      AVEC pièce jointe PDF si fournie.
//   2. Web Share API (Chrome/Edge desktop + mobile) — fallback web qui
//      propose le partage natif si l'OS le supporte (souvent uniquement
//      en HTTPS).
//   3. URL schemes (mailto:, sms:) — fallback ultime, fonctionne partout
//      mais sans pièce jointe.
//
// Pour le calendrier (.ics), on génère un fichier RFC 5545 valide et on
// le télécharge — l'OS reconnaît le mime-type et propose Apple Cal /
// Google Cal pour l'importer.
// ============================================================================

import { Share } from '@capacitor/share';
import { isNativePlatform } from './platform.js';

/**
 * Partage générique. Sur natif : menu système.
 * Sur web : Web Share API si dispo, sinon copie dans presse-papiers.
 *
 * @param {{ title?: string, text?: string, url?: string, dialogTitle?: string }} opts
 */
export async function shareGeneric({ title, text, url, dialogTitle }) {
  if (isNativePlatform()) {
    try {
      await Share.share({ title, text, url, dialogTitle: dialogTitle || 'Partager' });
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err?.message || 'Partage annulé.' };
    }
  }

  // Fallback Web Share API
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return { ok: true };
    } catch (err) {
      // L'utilisateur a juste annulé → ce n'est pas une erreur
      if (err?.name === 'AbortError') return { ok: true };
      return { ok: false, reason: err?.message || 'Partage indisponible.' };
    }
  }

  // Fallback final : copier dans presse-papiers
  try {
    const payload = [title, text, url].filter(Boolean).join('\n');
    await navigator.clipboard.writeText(payload);
    return { ok: true, copied: true };
  } catch (err) {
    return { ok: false, reason: 'Partage non supporté sur ce navigateur.' };
  }
}

/**
 * Partage un PDF (facture). Sur natif : pièce jointe dans le menu de
 * partage. Sur web : déclenche un download du PDF.
 *
 * @param {Blob} pdfBlob
 * @param {string} filename — ex. "FAC-2026-0001.pdf"
 * @param {{ title?: string, text?: string }} meta
 */
export async function sharePdf(pdfBlob, filename, meta = {}) {
  // Sur natif Capacitor, on doit d'abord écrire le fichier dans un
  // emplacement accessible puis passer le path à Share. Pour simplifier
  // (et éviter la dép supplémentaire @capacitor/filesystem), on retombe
  // sur Web Share API avec l'objet File quand possible.
  const file = new File([pdfBlob], filename, { type: 'application/pdf' });

  if (typeof navigator !== 'undefined' &&
      navigator.canShare && navigator.canShare({ files: [file] }) &&
      navigator.share) {
    try {
      await navigator.share({
        files: [file],
        title: meta.title,
        text: meta.text,
      });
      return { ok: true };
    } catch (err) {
      if (err?.name === 'AbortError') return { ok: true };
      return { ok: false, reason: err?.message || 'Partage annulé.' };
    }
  }

  // Fallback : déclenche un download
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1000);
  return { ok: true, downloaded: true };
}

/**
 * Ouvre l'app mail avec sujet + corps pré-remplis.
 * Note : `mailto:` ne supporte PAS les pièces jointes — pour envoyer
 * la facture en PJ, il faut passer par sharePdf() qui ouvre le menu
 * système (où l'utilisateur choisit Mail).
 *
 * @param {{ to?: string|string[], subject?: string, body?: string }} opts
 */
export function openMailto({ to, subject, body }) {
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  const recipients = Array.isArray(to) ? to.join(',') : (to || '');
  const url = `mailto:${recipients}${params.toString() ? '?' + params.toString().replace(/\+/g, '%20') : ''}`;
  // window.location.href ouvre le client mail natif
  window.location.href = url;
}

/**
 * Ouvre l'app SMS avec corps pré-rempli (pas de destinataire fixe :
 * l'utilisateur choisira dans son carnet d'adresses).
 *
 * @param {{ to?: string, body?: string }} opts
 */
export function openSms({ to, body }) {
  const recipients = to || '';
  // iOS et Android utilisent un séparateur différent : `&` ou `?`.
  // La forme universelle qui fonctionne sur les 2 :
  //   sms:[NUMBER]?body=[TEXT]
  // Sur iOS, Apple supporte aussi `;body=`. On utilise `?body=` qui est
  // le standard de fait depuis iOS 8 et Android 4.4+.
  const params = new URLSearchParams();
  if (body) params.set('body', body);
  const url = `sms:${recipients}${params.toString() ? '?' + params.toString().replace(/\+/g, '%20') : ''}`;
  window.location.href = url;
}

/**
 * Génère un fichier .ics (RFC 5545) pour ajouter une course au calendrier
 * de l'utilisateur. Téléchargé automatiquement, l'OS l'ouvrira avec
 * Apple Calendar / Google Calendar / Outlook.
 *
 * @param {{
 *   title: string,
 *   start: Date|string,
 *   end?: Date|string,
 *   location?: string,
 *   description?: string,
 *   uid?: string,
 * }} event
 */
export function downloadIcs(event) {
  const start = event.start instanceof Date ? event.start : new Date(event.start);
  const end = event.end
    ? (event.end instanceof Date ? event.end : new Date(event.end))
    : new Date(start.getTime() + 60 * 60 * 1000); // par défaut +1h

  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const escape = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

  const uid = event.uid || `trajetpro-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@trajetpro.fr`;
  const now = fmt(new Date());

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TrajetPro//VTC Booking//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escape(event.title)}`,
    event.location ? `LOCATION:${escape(event.location)}` : '',
    event.description ? `DESCRIPTION:${escape(event.description)}` : '',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escape('Rappel : ' + event.title)}`,
    'TRIGGER:-PT15M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `course-${start.toISOString().split('T')[0]}.ics`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1000);
  return { ok: true };
}
