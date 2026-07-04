import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Thème par défaut : clair ("TrajetPro Clair"). On l'applique AVANT le
// premier rendu pour éviter tout flash sombre. Le choix utilisateur
// (Réglages → sombre) est restauré ensuite dans App et prend le dessus.
document.documentElement.setAttribute('data-theme', 'light');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
