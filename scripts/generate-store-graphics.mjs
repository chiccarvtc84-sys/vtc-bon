// ============================================================================
// generate-store-graphics.mjs
// ============================================================================
// Génère les visuels marketing exigés par les stores en plus de l'icône
// applicative (qui elle est faite par scripts/generate-assets.mjs).
//
// Sorties dans submission/store-graphics/ :
//   - playstore-icon-512.png        (Google Play : icône haute résolution)
//   - playstore-feature-1024x500.png (Google Play : "feature graphic" en
//                                     tête de fiche, OBLIGATOIRE)
//   - appstore-icon-1024.png        (Apple : copie de l'icône 1024×1024
//                                     pour App Store Connect, séparée du
//                                     bundle iOS)
//
// Lance via : node scripts/generate-store-graphics.mjs
// ============================================================================

import sharp from 'sharp';
import { mkdir, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ASSETS = resolve(ROOT, 'assets');
const OUT = resolve(ROOT, 'submission', 'store-graphics');

const COLORS = {
  bg: '#0B0B0D',
  bgGradLight: '#1a1a22',
  gold: '#F4B942',
  goldDark: '#C99632',
  goldLight: '#FFD27A',
  text: '#F5F5F4',
  textMuted: '#A8A29E',
};

const SERIF = 'Georgia, "Times New Roman", "DejaVu Serif", serif';
const SANS = '"Helvetica Neue", Arial, "DejaVu Sans", sans-serif';

await mkdir(OUT, { recursive: true });

// ---------------------------------------------------------------------------
// 1. Play Store icon 512×512 (downscale de l'icône maître 1024×1024)
// ---------------------------------------------------------------------------
console.log('→ playstore-icon-512.png (resize depuis assets/icon.png)…');
await sharp(resolve(ASSETS, 'icon.png'))
  .resize(512, 512, { fit: 'contain' })
  .png({ compressionLevel: 9 })
  .toFile(resolve(OUT, 'playstore-icon-512.png'));

// ---------------------------------------------------------------------------
// 2. App Store icon 1024×1024 (copie de l'icône maître)
// ---------------------------------------------------------------------------
console.log('→ appstore-icon-1024.png (copie depuis assets/icon.png)…');
await copyFile(resolve(ASSETS, 'icon.png'), resolve(OUT, 'appstore-icon-1024.png'));

// ---------------------------------------------------------------------------
// 3. Play Store feature graphic 1024×500
// ---------------------------------------------------------------------------
// Image bandeau qui s'affiche en tête de la fiche Play Store. Doit être
// LISIBLE en miniature (≈ 192×94 dans les listings) ET en grand. Donc
// peu de texte, contraste fort, logo bien visible.
const featureSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${COLORS.bg}"/>
      <stop offset="60%" stop-color="${COLORS.bgGradLight}"/>
      <stop offset="100%" stop-color="${COLORS.bg}"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${COLORS.goldLight}"/>
      <stop offset="50%" stop-color="${COLORS.gold}"/>
      <stop offset="100%" stop-color="${COLORS.goldDark}"/>
    </linearGradient>
  </defs>

  <rect width="1024" height="500" fill="url(#bgGrad)"/>

  <!-- Bloc gauche : logo TP -->
  <g transform="translate(170, 250)">
    <text x="0" y="60" text-anchor="middle"
          font-family='${SERIF}'
          font-size="240" font-weight="700"
          fill="url(#goldGrad)"
          letter-spacing="-12">TP</text>
    <rect x="-65" y="100" width="130" height="3" fill="${COLORS.gold}" opacity="0.7"/>
  </g>

  <!-- Séparateur vertical or fin -->
  <rect x="340" y="120" width="1" height="260" fill="${COLORS.gold}" opacity="0.3"/>

  <!-- Bloc droit : wordmark + accroche -->
  <g transform="translate(390, 250)">
    <text x="0" y="-40" text-anchor="start"
          font-family='${SERIF}'
          font-size="92" font-weight="600"
          fill="${COLORS.text}"
          letter-spacing="-2">TrajetPro</text>

    <text x="0" y="20" text-anchor="start"
          font-family='${SANS}'
          font-size="34" font-weight="500"
          fill="${COLORS.gold}"
          letter-spacing="2">BONS &amp; FACTURES VTC</text>

    <text x="0" y="68" text-anchor="start"
          font-family='${SANS}'
          font-size="26" font-weight="400"
          fill="${COLORS.textMuted}">
      <tspan x="0" dy="0">Dictée vocale · Conforme décret 2017-483</tspan>
      <tspan x="0" dy="38">5 crédits offerts à l'inscription</tspan>
    </text>
  </g>

  <!-- Petit accent or en bas -->
  <rect x="0" y="492" width="1024" height="8" fill="${COLORS.gold}"/>
</svg>`;

console.log('→ playstore-feature-1024x500.png (SVG → PNG)…');
await sharp(Buffer.from(featureSvg))
  .png({ compressionLevel: 9 })
  .toFile(resolve(OUT, 'playstore-feature-1024x500.png'));

console.log('');
console.log('✓ Tous les visuels stores générés dans submission/store-graphics/');
