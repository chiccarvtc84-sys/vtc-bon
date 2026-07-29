// ============================================================================
// eslint.config.js — configuration ESLint v9 (flat config)
// ============================================================================
// Remise en route du lint après migration ESLint 9 (l'ancien format .eslintrc
// n'est plus lu). Philosophie : bloquer les vrais bugs (règles des hooks,
// variables non définies), tolérer le style existant du projet (App.jsx
// monolithique, try/catch vides volontaires, etc.).
// Lancer via : npm run lint
// ============================================================================

import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  // Fichiers générés / natifs / tooling : hors du champ du lint.
  { ignores: ['dist/**', 'node_modules/**', 'android/**', 'ios/**', 'docs/**', '.gitnexus/**'] },

  js.configs.recommended,

  {
    files: ['src/**/*.{js,jsx}', 'scripts/**/*.mjs', 'vite.config.js'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        // Navigateur / WebView Capacitor
        window: 'readonly', document: 'readonly', navigator: 'readonly',
        console: 'readonly', fetch: 'readonly', URL: 'readonly',
        URLSearchParams: 'readonly', Blob: 'readonly', File: 'readonly',
        FileReader: 'readonly', FormData: 'readonly', Image: 'readonly',
        localStorage: 'readonly', sessionStorage: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly',
        setInterval: 'readonly', clearInterval: 'readonly',
        requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
        alert: 'readonly', confirm: 'readonly', prompt: 'readonly',
        crypto: 'readonly', atob: 'readonly', btoa: 'readonly',
        TextEncoder: 'readonly', TextDecoder: 'readonly',
        AbortController: 'readonly', CustomEvent: 'readonly',
        Notification: 'readonly', screen: 'readonly',
        ResizeObserver: 'readonly', IntersectionObserver: 'readonly',
        MutationObserver: 'readonly', PointerEvent: 'readonly',
        // Node (scripts/*.mjs, vite.config.js)
        process: 'readonly', Buffer: 'readonly',
      },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      // Vrais bugs potentiels — on veut les voir.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/jsx-uses-vars': 'error',        // évite les faux "unused" sur les composants JSX
      'react/jsx-no-undef': 'error',
      // Style existant du projet — toléré.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': 'off',                      // try/catch vides volontaires (best-effort)
      'no-irregular-whitespace': 'off',       // texte FR avec espaces insécables
    },
  },
];
