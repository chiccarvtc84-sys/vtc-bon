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
// Design (refonte « TrajetPro Clair », 2026-07-04) : monogramme « V » formé
// par un trajet (points départ/arrivée) blanc sur fond BLEU dégradé — le
// logo de marque. Icône = fond bleu plein. Splash = même logo posé sur fond
// papier clair + wordmark. Couleurs de la charte (`#2563EB` / papier
// `#F6F5F2`). Pour un design définitif "store-grade", remplacer directement
// les fichiers `assets/icon.png` et `assets/splash.png` puis lancer
// `npx capacitor-assets generate` (sans repasser par ce script).
// ============================================================================

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ASSETS_DIR = resolve(ROOT, 'assets');

const COLORS = {
  blue: '#2563EB',
  blueDark: '#0B3AA8',
  paper: '#F6F5F2',
  paperHi: '#FFFFFF',
  darkBg: '#0B0B0D',
  darkBgHi: '#171A22',
  ink: '#16171B',
  white: '#FFFFFF',
  vLight: '#CFE0FF',
  blueSoft: '#60A5FA',
  mutedLight: '#6B6C73',
  mutedDark: '#A8A29E',
};

const SERIF = 'Georgia, "Times New Roman", "DejaVu Serif", serif';
const SANS = '"Helvetica Neue", Arial, "DejaVu Sans", sans-serif';

// Fragment logo réutilisable : reprend EXACTEMENT le SVG de marque
// (public/favicon.svg / composant AppLogo), positionné et mis à l'échelle.
// `idbg`/`idv` = identifiants des dégradés à référencer.
function logoGroup({ x, y, scale, idbg, idv }) {
  return `<g transform="translate(${x},${y}) scale(${scale})">
    <rect width="512" height="512" rx="112" fill="url(#${idbg})"/>
    <path d="M150 150L256 372L362 150" fill="none" stroke="url(#${idv})" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="150" cy="150" r="26" fill="url(#${idv})"/>
    <circle cx="150" cy="150" r="11" fill="${COLORS.blueDark}"/>
    <circle cx="362" cy="150" r="18" fill="url(#${idv})"/>
  </g>`;
}

// ----------------------------------------------------------------------------
// ICON 1024×1024  —  fond bleu plein (Apple/Google rajoutent les coins
// arrondis ; pas de transparence). Le « V » doit rester lisible à 60×60.
// ----------------------------------------------------------------------------
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="ibg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${COLORS.blue}"/>
      <stop offset="1" stop-color="${COLORS.blueDark}"/>
    </linearGradient>
    <linearGradient id="iv" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${COLORS.white}"/>
      <stop offset="1" stop-color="${COLORS.vLight}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#ibg)"/>
  <path d="M330 340L512 720L694 340" fill="none" stroke="url(#iv)" stroke-width="72" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="330" cy="340" r="56" fill="url(#iv)"/>
  <circle cx="330" cy="340" r="24" fill="${COLORS.blueDark}"/>
  <circle cx="694" cy="340" r="40" fill="url(#iv)"/>
</svg>`;

// ----------------------------------------------------------------------------
// SPLASH 2732×2732  —  logo de marque sur fond PAPIER clair + wordmark.
// Contenu utile centré, Capacitor crope ensuite aux bonnes tailles.
// ----------------------------------------------------------------------------
const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <defs>
    <radialGradient id="sbgpage" cx="0.5" cy="0.42" r="0.8">
      <stop offset="0" stop-color="${COLORS.paperHi}"/>
      <stop offset="1" stop-color="${COLORS.paper}"/>
    </radialGradient>
    <linearGradient id="slbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${COLORS.blue}"/>
      <stop offset="1" stop-color="${COLORS.blueDark}"/>
    </linearGradient>
    <linearGradient id="slv" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${COLORS.white}"/>
      <stop offset="1" stop-color="${COLORS.vLight}"/>
    </linearGradient>
  </defs>

  <rect width="2732" height="2732" fill="url(#sbgpage)"/>

  <!-- Logo (512 d'origine × 1.25 = 640 px), centré horizontalement -->
  ${logoGroup({ x: 1046, y: 900, scale: 1.25, idbg: 'slbg', idv: 'slv' })}

  <!-- Wordmark TrajetPro -->
  <text x="1366" y="1820" text-anchor="middle"
        font-family='${SERIF}'
        font-size="250" font-weight="600"
        fill="${COLORS.ink}"
        letter-spacing="-6">TrajetPro</text>

  <!-- Tagline -->
  <text x="1366" y="1960" text-anchor="middle"
        font-family='${SANS}'
        font-size="66" font-weight="600"
        fill="${COLORS.blue}"
        letter-spacing="14">BONS DE COURSE · FACTURES</text>

  <!-- Mention discrète en bas -->
  <text x="1366" y="2560" text-anchor="middle"
        font-family='${SANS}'
        font-size="46" font-weight="400"
        fill="${COLORS.mutedLight}"
        letter-spacing="6">Conforme décret 2017-483</text>
</svg>`;

// ----------------------------------------------------------------------------
// SPLASH DARK 2732×2732  —  variante mode sombre (fond foncé, texte clair).
// ----------------------------------------------------------------------------
const splashDarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <defs>
    <radialGradient id="sbgdark" cx="0.5" cy="0.42" r="0.8">
      <stop offset="0" stop-color="${COLORS.darkBgHi}"/>
      <stop offset="1" stop-color="${COLORS.darkBg}"/>
    </radialGradient>
    <linearGradient id="sdbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${COLORS.blue}"/>
      <stop offset="1" stop-color="${COLORS.blueDark}"/>
    </linearGradient>
    <linearGradient id="sdv" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${COLORS.white}"/>
      <stop offset="1" stop-color="${COLORS.vLight}"/>
    </linearGradient>
  </defs>

  <rect width="2732" height="2732" fill="url(#sbgdark)"/>

  ${logoGroup({ x: 1046, y: 900, scale: 1.25, idbg: 'sdbg', idv: 'sdv' })}

  <text x="1366" y="1820" text-anchor="middle"
        font-family='${SERIF}'
        font-size="250" font-weight="600"
        fill="${COLORS.white}"
        letter-spacing="-6">TrajetPro</text>

  <text x="1366" y="1960" text-anchor="middle"
        font-family='${SANS}'
        font-size="66" font-weight="600"
        fill="${COLORS.blueSoft}"
        letter-spacing="14">BONS DE COURSE · FACTURES</text>

  <text x="1366" y="2560" text-anchor="middle"
        font-family='${SANS}'
        font-size="46" font-weight="400"
        fill="${COLORS.mutedDark}"
        letter-spacing="6">Conforme décret 2017-483</text>
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

console.log('→ Génération splash-dark.png (2732×2732)…');
await sharp(Buffer.from(splashDarkSvg))
  .png({ compressionLevel: 9 })
  .toFile(resolve(ASSETS_DIR, 'splash-dark.png'));

console.log('✓ Assets racine générés dans assets/');
console.log('→ Lance maintenant : npx capacitor-assets generate');
