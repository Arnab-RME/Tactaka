import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tactaka.football.tactics',
  appName: 'Tactaka: Pro Football Auction & Tactics',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#080B10',
  },
};

export default config;
