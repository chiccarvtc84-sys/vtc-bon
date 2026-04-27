// ============================================================================
// generate-assets.mjs
// ============================================================================
// Génère les 2 assets racine (icon.png 1024×1024 et splash.png 2732×2732)
// à partir d'un SVG inline, puis lance @capacitor/assets pour produire
// toutes les déclinaisons iOS et Android.
//
// Lance via : node scripts/generate-assets.mjs
// (déjà branché dans package.json sous `npm run assets`)
//
// REMPLACER ces SVG par les vrais visuels TrajetPro quand tu en auras :
// le logo officiel + un splash screen propre. En attendant, ce sont des
// placeholders aux couleurs de la marque.
// ============================================================================

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ASSETS_DIR = resolve(ROOT, 'assets');

const COLORS = {
  bg: '#0B0B0D',
  gold: '#F4B942',
  goldDark: '#C99632',
  text: '#F5F5F4',
};

// --- ICON 1024×1024 ---
// Carré arrondi doré + voiture stylisée + lettre T en typographie serif.
// Apple/Google ne veulent PAS de transparence ni de coins arrondis
// (ils les ajoutent eux-mêmes selon la plateforme).
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${COLORS.gold}"/>
      <stop offset="100%" stop-color="${COLORS.goldDark}"/>
    </linearGradient>
    <radialGradient id="bgGlow" cx="0.5" cy="0.4" r="0.6">
      <stop offset="0%" stop-color="#1a1a20"/>
      <stop offset="100%" stop-color="${COLORS.bg}"/>
    </radialGradient>
  </defs>
  <!-- Fond plein (pas de transparence pour respecter les guidelines stores) -->
  <rect width="1024" height="1024" fill="url(#bgGlow)"/>
  <!-- Cercle doré central -->
  <circle cx="512" cy="512" r="380" fill="url(#goldGrad)"/>
  <!-- Voiture stylisée (path simplifié inspiré de lucide-react Car) -->
  <g transform="translate(512 512) scale(11) translate(-12 -12)" fill="none" stroke="${COLORS.bg}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
    <circle cx="7" cy="17" r="2"/>
    <path d="M9 17h6"/>
    <circle cx="17" cy="17" r="2"/>
  </g>
</svg>`;

// --- SPLASH 2732×2732 ---
// Apple recommande un PNG carré de cette taille, centre avec ~33% du logo.
// Capacitor le crop automatiquement aux bonnes tailles iOS et Android.
const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <defs>
    <radialGradient id="splashBg" cx="0.5" cy="0.5" r="0.7">
      <stop offset="0%" stop-color="#1a1a20"/>
      <stop offset="100%" stop-color="${COLORS.bg}"/>
    </radialGradient>
    <linearGradient id="splashGold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${COLORS.gold}"/>
      <stop offset="100%" stop-color="${COLORS.goldDark}"/>
    </linearGradient>
  </defs>
  <rect width="2732" height="2732" fill="url(#splashBg)"/>
  <!-- Cercle doré (zone safe ~33% du carré) -->
  <circle cx="1366" cy="1200" r="320" fill="url(#splashGold)"/>
  <!-- Voiture -->
  <g transform="translate(1366 1200) scale(13) translate(-12 -12)" fill="none" stroke="${COLORS.bg}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
    <circle cx="7" cy="17" r="2"/>
    <path d="M9 17h6"/>
    <circle cx="17" cy="17" r="2"/>
  </g>
  <!-- Wordmark TrajetPro -->
  <text x="1366" y="1700" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="180" font-weight="600"
        fill="${COLORS.text}" letter-spacing="-3">
    TrajetPro
  </text>
  <text x="1366" y="1820" text-anchor="middle"
        font-family="-apple-system, 'Helvetica Neue', sans-serif"
        font-size="60" font-weight="400"
        fill="${COLORS.gold}" letter-spacing="6">
    BONS DE COURSE · FACTURES
  </text>
</svg>`;

await mkdir(ASSETS_DIR, { recursive: true });

console.log('→ Génération icon.png (1024×1024)…');
await sharp(Buffer.from(iconSvg))
  .png({ compressionLevel: 9 })
  .toFile(resolve(ASSETS_DIR, 'icon.png'));

console.log('→ Génération splash.png (2732×2732)…');
await sharp(Buffer.from(splashSvg))
  .png({ compressionLevel: 9 })
  .toFile(resolve(ASSETS_DIR, 'splash.png'));

// Variante dark explicite (Capacitor en a besoin pour le dark mode iOS)
console.log('→ Génération splash-dark.png (2732×2732)…');
await sharp(Buffer.from(splashSvg))
  .png({ compressionLevel: 9 })
  .toFile(resolve(ASSETS_DIR, 'splash-dark.png'));

console.log('✓ Assets racine générés dans assets/');
console.log('→ Lance maintenant : npx capacitor-assets generate');
