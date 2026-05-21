import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.getariaai.app',
  appName: 'Aria',
  webDir: 'public', // doesn't matter when using url
  server: {
    url: 'https://getariaai.com/crm', // 🔥 THIS IS THE FIX
    iosScheme: 'https',
    androidScheme: 'https',
    allowNavigation: ['getariaai.com', '*.getariaai.com', '*.vercel.app']
  }
};

export default config;
