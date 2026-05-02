// ============================================================================
// generate-assets.mjs
// ============================================================================
// Génère les 2 assets racine (icon.png 1024×1024 et splash.png 2732×2732)
// à partir d'un SVG inline, puis lance @capacitor/assets pour produire
// toutes les déclinaisons iOS et Android.
//
// Lance via : npm run assets
// (qui enchaîne ce script + npx capacitor-assets generate)
//
// Design : monogramme serif "TP" or sur fond noir profond + wordmark
// "TrajetPro" sur le splash. Aux couleurs de la charte (`#0B0B0D` /
// `#F4B942`). Pour un design définitif "store-grade", remplacer
// directement les fichiers `assets/icon.png` et `assets/splash.png`
// avec ceux d'un graphiste, puis lancer `npx capacitor-assets generate`
// (sans repasser par ce script).
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
  bgGradLight: '#1a1a22',
  gold: '#F4B942',
  goldDark: '#C99632',
  goldLight: '#FFD27A',
  text: '#F5F5F4',
  textMuted: '#A8A29E',
};

// Police serif — librsvg (utilisé par sharp) ne charge pas Fraunces (pas
// installé sur le système Windows par défaut), on retombe sur Georgia
// qui donne un rendu serif très proche et élégant.
const SERIF = 'Georgia, "Times New Roman", "DejaVu Serif", serif';
const SANS = '"Helvetica Neue", Arial, "DejaVu Sans", sans-serif';

// ----------------------------------------------------------------------------
// ICON 1024×1024
// ----------------------------------------------------------------------------
// Apple/Google n'aiment PAS la transparence ni les coins arrondis (ils
// les rajoutent eux-mêmes selon la plateforme). Donc fond plein.
//
// Le monogramme doit rester lisible quand l'icône est rendue à 60×60 px
// sur l'écran d'accueil iPhone — d'où une typographie épaisse, sans
// fioriture, et un contraste fort or-sur-noir.
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="bgGlow" cx="0.5" cy="0.42" r="0.75">
      <stop offset="0%" stop-color="${COLORS.bgGradLight}"/>
      <stop offset="100%" stop-color="${COLORS.bg}"/>
    </radialGradient>
    <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${COLORS.goldLight}"/>
      <stop offset="50%" stop-color="${COLORS.gold}"/>
      <stop offset="100%" stop-color="${COLORS.goldDark}"/>
    </linearGradient>
  </defs>

  <!-- Fond plein (gradient subtil pour donner de la profondeur) -->
  <rect width="1024" height="1024" fill="url(#bgGlow)"/>

  <!-- Monogramme TP centré, en serif épais -->
  <text x="512" y="640" text-anchor="middle"
        font-family='${SERIF}'
        font-size="600" font-weight="700"
        fill="url(#goldGrad)"
        letter-spacing="-30">TP</text>

  <!-- Fine ligne dorée en accent sous le monogramme -->
  <rect x="372" y="730" width="280" height="6" fill="${COLORS.gold}" opacity="0.85"/>

  <!-- Petit tag VTC discret en bas -->
  <text x="512" y="850" text-anchor="middle"
        font-family='${SANS}'
        font-size="58" font-weight="600"
        fill="${COLORS.text}"
        letter-spacing="14"
        opacity="0.85">VTC</text>
</svg>`;

// ----------------------------------------------------------------------------
// SPLASH 2732×2732
// ----------------------------------------------------------------------------
// Apple recommande un PNG carré de cette taille, contenu utile centré
// dans environ 1/3 du cadre. Capacitor le crop ensuite aux bonnes tailles.
const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <defs>
    <radialGradient id="splashBg" cx="0.5" cy="0.45" r="0.75">
      <stop offset="0%" stop-color="${COLORS.bgGradLight}"/>
      <stop offset="100%" stop-color="${COLORS.bg}"/>
    </radialGradient>
    <linearGradient id="splashGold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${COLORS.goldLight}"/>
      <stop offset="50%" stop-color="${COLORS.gold}"/>
      <stop offset="100%" stop-color="${COLORS.goldDark}"/>
    </linearGradient>
  </defs>

  <rect width="2732" height="2732" fill="url(#splashBg)"/>

  <!-- Monogramme TP, grande taille mais pas plein écran -->
  <text x="1366" y="1180" text-anchor="middle"
        font-family='${SERIF}'
        font-size="540" font-weight="700"
        fill="url(#splashGold)"
        letter-spacing="-25">TP</text>

  <!-- Ligne dorée d'accent -->
  <rect x="1216" y="1250" width="300" height="4" fill="${COLORS.gold}" opacity="0.7"/>

  <!-- Wordmark TrajetPro sous le monogramme -->
  <text x="1366" y="1480" text-anchor="middle"
        font-family='${SERIF}'
        font-size="220" font-weight="600"
        fill="${COLORS.text}"
        letter-spacing="-5">TrajetPro</text>

  <!-- Tagline en petites caps -->
  <text x="1366" y="1620" text-anchor="middle"
        font-family='${SANS}'
        font-size="68" font-weight="500"
        fill="${COLORS.gold}"
        letter-spacing="14">BONS DE COURSE · FACTURES</text>

  <!-- Mention discrète en bas (compatible iPhone safe-area) -->
  <text x="1366" y="2540" text-anchor="middle"
        font-family='${SANS}'
        font-size="48" font-weight="400"
        fill="${COLORS.textMuted}"
        letter-spacing="6"
        opacity="0.6">Conforme décret 2017-483</text>
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

// Capacitor a besoin d'une variante "dark" explicite pour le dark mode iOS.
// On reprend le même rendu (notre fond est déjà sombre, donc identique).
console.log('→ Génération splash-dark.png (2732×2732)…');
await sharp(Buffer.from(splashSvg))
  .png({ compressionLevel: 9 })
  .toFile(resolve(ASSETS_DIR, 'splash-dark.png'));

console.log('✓ Assets racine générés dans assets/');
console.log('→ Lance maintenant : npx capacitor-assets generate');
