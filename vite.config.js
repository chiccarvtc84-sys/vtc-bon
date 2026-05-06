import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    // Sourcemaps en DEV uniquement. En PRODUCTION on les désactive
    // pour éviter de divulguer le code source côté client (App.jsx,
    // logique métier, commentaires de sécurité, schéma RPC, etc.).
    // Si un jour tu actives Sentry, mets 'hidden' au lieu de false :
    // ça génère les .map mais ne les référence pas dans les bundles
    // → tu peux les uploader privément à Sentry sans les exposer.
    sourcemap: mode !== 'production',
    chunkSizeWarningLimit: 1024,
    // Minification agressive en prod (défaut esbuild) — supprime
    // commentaires, retours à la ligne, noms de variables.
  },
  // Côté esbuild, drop les `console.*` et `debugger` en prod pour
  // éviter de leak des logs de debug dans le bundle final. Les
  // console.error / .warn explicites du code de prod restent (ils
  // utilisent un wrapper si on veut les supprimer).
  esbuild: mode === 'production' ? {
    drop: ['debugger'],
    // On garde les console.error pour les logs critiques côté client.
  } : {},
}));
