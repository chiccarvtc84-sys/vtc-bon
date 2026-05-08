// ============================================================================
// useEdgeSwipeBack — geste "glisser depuis le bord gauche pour revenir"
// ============================================================================
// Imite le geste de retour natif iOS / Android : l'utilisateur pose son
// doigt près du bord GAUCHE de l'écran (zone de 24px), glisse vers la
// droite d'au moins 80px en moins de 600ms → on déclenche le callback
// fourni (équivalent du clic sur le bouton retour en haut à gauche).
//
// Pose un seul listener `touchstart`/`touchend` sur `document`. Le listener
// vit le temps que le composant monté est dans le DOM. Si plusieurs écrans
// avec onBack sont empilés (ex : modal au-dessus d'un détail), seul le
// listener du dernier écran monté est actif (les précédents sont écrasés
// au remount React).
//
// Sécurité :
//   - Ignoré si onBack est falsy → pas de side-effects sur les écrans
//     racine sans bouton retour.
//   - Le seuil horizontal (>80px) + vertical (<80px) évite les faux
//     positifs sur un scroll vertical ou un tap.
//   - passive: true → ne bloque jamais le scroll natif, le geste reste
//     fluide même si le user scroll au lieu de swipe.
// ============================================================================

import { useEffect } from 'react';

const EDGE_THRESHOLD = 24;       // px depuis le bord gauche pour activer le geste
const MIN_HORIZONTAL = 80;       // px de glisser horizontal min pour valider
const MAX_VERTICAL = 80;         // px de drift vertical max (sinon = scroll)
const MAX_DURATION_MS = 600;     // durée max du geste (au-delà = hésitation)

export function useEdgeSwipeBack(onBack, enabled = true) {
  useEffect(() => {
    if (!enabled || typeof onBack !== 'function') return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let active = false;

    const onTouchStart = (e) => {
      const t = e.touches?.[0];
      if (!t) return;
      // N'arme le geste QUE si le doigt commence dans la zone du bord gauche
      if (t.clientX <= EDGE_THRESHOLD) {
        startX = t.clientX;
        startY = t.clientY;
        startTime = Date.now();
        active = true;
      } else {
        active = false;
      }
    };

    const onTouchEnd = (e) => {
      if (!active) return;
      active = false;
      const t = e.changedTouches?.[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      const dt = Date.now() - startTime;
      if (dx >= MIN_HORIZONTAL && dy <= MAX_VERTICAL && dt <= MAX_DURATION_MS) {
        try { onBack(); } catch (_) { /* on ne casse pas si le handler throw */ }
      }
    };

    const onTouchCancel = () => { active = false; };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [onBack, enabled]);
}
