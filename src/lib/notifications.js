// ============================================================================
// notifications.js — Rappels avant chaque course
// ============================================================================
// Programme jusqu'à 3 rappels par bon de course :
//   - T-3h  : "Course prévue dans 3 heures"
//   - T-1h  : "Prise en charge dans 1 heure"
//   - T-15m : "Course imminente — départ dans 15 min"
//
// Implémentation cross-platform :
//   - Mobile (Capacitor) : @capacitor/local-notifications (notifications
//     natives qui s'affichent même app fermée, persistées par l'OS).
//   - Web (Vite dev) : Notification API + setTimeout en mémoire
//     (limité à la session du navigateur, mais OK pour tester).
//
// Identifiants : LocalNotifications attend un id INT32 par notification.
// On dérive un hash 32-bit du booking.id (UUID) puis on ajoute le rang
// du rappel (0/1/2). 3 IDs distincts par bon, faciles à retrouver pour
// l'annulation.
// ============================================================================

import { isNativePlatform } from './platform.js';

// Offsets en minutes avant l'heure de pickup
export const REMINDER_OFFSETS = [
  { minutes: 180, key: 'T3h',   title: '🚗 Course prévue dans 3 heures', body: (b) => `Prise en charge ${b.customerName} à ${b.pickupAddress} → ${b.dropoffAddress} à ${b.timeShort}` },
  { minutes: 60,  key: 'T1h',   title: '🚗 Prise en charge dans 1 heure', body: (b) => `${b.customerName} • ${b.pickupAddress} → ${b.dropoffAddress} • ${b.timeShort}` },
  { minutes: 15,  key: 'T15m',  title: '⏰ Course imminente — 15 min',     body: (b) => `${b.customerName} t'attend à ${b.pickupAddress}` },
];

const CHANNEL_ID = 'trajetpro-rides';

// ----------------------------------------------------------------------------
// Hash booking.id → INT32 stable (pour servir d'ID de notification)
// ----------------------------------------------------------------------------
function hashStringToInt32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // INT32 positif (LocalNotifications n'aime pas les négatifs sur certains OS)
  return (h & 0x7fffffff) || 1;
}

function notificationIdsFor(bookingId) {
  const base = hashStringToInt32(String(bookingId));
  // 3 IDs séparés (suffix 0/1/2) pour les 3 rappels
  // On garde une marge en multipliant par 10 pour éviter les collisions
  return [
    (base * 10 + 0) & 0x7fffffff,
    (base * 10 + 1) & 0x7fffffff,
    (base * 10 + 2) & 0x7fffffff,
  ];
}

// ----------------------------------------------------------------------------
// Permission
// ----------------------------------------------------------------------------
export async function ensureNotificationPermission() {
  if (isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const perms = await LocalNotifications.checkPermissions();
      if (perms.display === 'granted') return true;
      const req = await LocalNotifications.requestPermissions();
      return req.display === 'granted';
    } catch (err) {
      console.warn('Notifications natives indisponibles :', err?.message);
      return false;
    }
  }
  // Web
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const res = await Notification.requestPermission();
    return res === 'granted';
  } catch (_) {
    return false;
  }
}

// ----------------------------------------------------------------------------
// Création du channel Android (couleur, son, vibration). Idempotent.
// ----------------------------------------------------------------------------
async function ensureChannel() {
  if (!isNativePlatform()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    if (LocalNotifications.createChannel) {
      await LocalNotifications.createChannel({
        id: CHANNEL_ID,
        name: 'Rappels de course',
        description: 'Notifications avant vos prises en charge',
        importance: 4, // High
        visibility: 1,
        sound: undefined, // son par défaut
        vibration: true,
        lightColor: '#F4B942',
      });
    }
  } catch (_) { /* iOS ne supporte pas les channels, on ignore */ }
}

// ----------------------------------------------------------------------------
// Programmation
// ----------------------------------------------------------------------------

// Cache en mémoire des timers Web (Notification API)
const webTimers = new Map(); // bookingId -> [timeoutId, …]

function clearWebTimers(bookingId) {
  const arr = webTimers.get(bookingId);
  if (arr) {
    arr.forEach((t) => clearTimeout(t));
    webTimers.delete(bookingId);
  }
}

/**
 * Programme les 3 rappels d'un bon de course.
 * @param booking : { id, customerName, pickupAddress, dropoffAddress, dateTime }
 *   où dateTime est ISO ("2026-04-28T15:00") ou Date.
 * @returns { scheduled: number, skipped: number, reasons: string[] }
 */
export async function scheduleBookingReminders(booking) {
  const out = { scheduled: 0, skipped: 0, reasons: [] };
  if (!booking?.id || !booking?.dateTime) {
    out.reasons.push('booking.id ou booking.dateTime manquant');
    return out;
  }

  const pickupAt = booking.dateTime instanceof Date
    ? booking.dateTime
    : new Date(booking.dateTime);
  if (Number.isNaN(pickupAt.getTime())) {
    out.reasons.push('dateTime invalide');
    return out;
  }

  const now = Date.now();
  const ids = notificationIdsFor(booking.id);

  // Données passées au callback "body" (formatage humain)
  const ctx = {
    customerName: booking.customerName || 'votre client',
    pickupAddress: booking.pickupAddress || '—',
    dropoffAddress: booking.dropoffAddress || '—',
    timeShort: pickupAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  };

  // Annuler les éventuels rappels déjà posés (utile en cas d'update)
  await cancelBookingReminders(booking.id);

  if (isNativePlatform()) {
    await ensureChannel();
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const toSchedule = [];
    REMINDER_OFFSETS.forEach((r, idx) => {
      const at = new Date(pickupAt.getTime() - r.minutes * 60 * 1000);
      if (at.getTime() <= now + 5_000) {
        out.skipped++;
        out.reasons.push(`${r.key} déjà passé`);
        return;
      }
      toSchedule.push({
        id: ids[idx],
        title: r.title,
        body: r.body(ctx),
        schedule: { at, allowWhileIdle: true },
        channelId: CHANNEL_ID,
        smallIcon: 'ic_stat_icon_config_sample',
        largeIcon: 'ic_launcher',
        extra: { bookingId: booking.id, kind: r.key },
      });
    });
    if (toSchedule.length === 0) return out;
    try {
      await LocalNotifications.schedule({ notifications: toSchedule });
      out.scheduled = toSchedule.length;
    } catch (err) {
      out.reasons.push(`schedule failed: ${err?.message || err}`);
    }
    return out;
  }

  // Web : setTimeout + Notification
  if (typeof window === 'undefined' || !('Notification' in window)) {
    out.reasons.push('Notification API indisponible');
    return out;
  }
  if (Notification.permission !== 'granted') {
    out.reasons.push('Permission non accordée');
    return out;
  }
  const timers = [];
  REMINDER_OFFSETS.forEach((r) => {
    const at = pickupAt.getTime() - r.minutes * 60 * 1000;
    const delay = at - now;
    if (delay <= 0) {
      out.skipped++;
      return;
    }
    // setTimeout web limité à ~24,8 jours. Pour un bon dans plus de 24 jours
    // on skip — les rappels seront recréés à la prochaine ouverture de l'app.
    if (delay > 2_000_000_000) {
      out.skipped++;
      out.reasons.push(`${r.key} > 24j (sera reprogrammé au prochain login)`);
      return;
    }
    const tid = setTimeout(() => {
      try {
        new Notification(r.title, {
          body: r.body(ctx),
          icon: '/favicon.svg',
          tag: `booking-${booking.id}-${r.key}`,
          requireInteraction: r.minutes <= 15, // on ne dismiss pas le 15 min
        });
      } catch (_) {}
    }, delay);
    timers.push(tid);
    out.scheduled++;
  });
  if (timers.length) webTimers.set(booking.id, timers);
  return out;
}

/**
 * Annule les 3 rappels d'un bon (par exemple après suppression / modification).
 */
export async function cancelBookingReminders(bookingId) {
  if (!bookingId) return;
  if (isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const ids = notificationIdsFor(bookingId);
      await LocalNotifications.cancel({
        notifications: ids.map((id) => ({ id })),
      });
    } catch (err) {
      console.warn('cancelBookingReminders failed:', err?.message);
    }
    return;
  }
  clearWebTimers(bookingId);
}

/**
 * Re-synchronise tous les rappels avec la liste actuelle des bookings.
 * À appeler au login et au démarrage (pour rattraper les bookings dont
 * les rappels web ont été perdus à cause d'un reload).
 *
 * Pour le natif, on annule TOUTES les notifs Capacitor d'abord (pour
 * éviter les rappels orphelins de bookings supprimés depuis), puis on
 * replanifie.
 */
export async function rescheduleAllBookings(bookings, { enabled = true } = {}) {
  if (isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const pending = await LocalNotifications.getPending();
      if (pending?.notifications?.length) {
        await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
      }
    } catch (_) {}
  } else {
    // Web : on clear tous les timers connus
    for (const [bid] of webTimers) clearWebTimers(bid);
  }
  if (!enabled) return { scheduled: 0, skipped: 0 };

  let scheduled = 0;
  let skipped = 0;
  for (const b of bookings || []) {
    const r = await scheduleBookingReminders(b);
    scheduled += r.scheduled;
    skipped += r.skipped;
  }
  return { scheduled, skipped };
}

/**
 * Pour tests / UI : lister les notifications encore en attente côté natif.
 */
export async function listPendingReminders() {
  if (!isNativePlatform()) {
    return Array.from(webTimers.keys()).map((bookingId) => ({ bookingId }));
  }
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const res = await LocalNotifications.getPending();
    return res?.notifications || [];
  } catch (_) {
    return [];
  }
}
