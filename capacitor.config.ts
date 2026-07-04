import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trajetpro.app',
  appName: 'TrajetPro',
  webDir: 'dist',
  bundledWebRuntime: false,
  ios: {
    // contentInset 'never' : le WebView s'étend SOUS la status bar
    // (heure/batterie) au lieu d'être inseté. Ainsi le fond clair de l'app
    // remonte jusqu'aux pixels du haut de l'écran → continuité visuelle
    // parfaite, plus de bande au-dessus du contenu.
    // Le CSS gère le décalage des textes via env(safe-area-inset-top).
    contentInset: 'never',
    backgroundColor: '#F6F5F2',   // papier clair (thème « TrajetPro Clair »)
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#F6F5F2',
  },
};

export default config;
