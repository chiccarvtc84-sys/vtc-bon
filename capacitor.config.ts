import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trajetpro.app',
  appName: 'TrajetPro',
  webDir: 'dist',
  bundledWebRuntime: false,
  ios: {
    contentInset: 'always',
    // Fond du WKWebView : par défaut iOS l'affiche en BLANC, ce qui crée
    // une bande blanche dans la safe-area du home indicator quand le
    // contenu CSS ne couvre pas exactement 100dvh. On force le noir profond
    // (charte TrajetPro) pour que la zone soit toujours invisible.
    backgroundColor: '#0B0B0D',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#0B0B0D',
  },
};

export default config;
