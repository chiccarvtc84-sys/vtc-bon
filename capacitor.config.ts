import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trajetpro.app',
  appName: 'TrajetPro',
  webDir: 'dist',
  bundledWebRuntime: false,
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
