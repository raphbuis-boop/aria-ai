import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Build-target-aware server URL.
 *
 * BUILD_TARGET env var controls which URL the Capacitor shell points to:
 *   production  (default) → https://getariaai.com/crm
 *   staging               → https://staging.getariaai.com/crm
 *   preview               → set PREVIEW_URL env var to the Vercel preview URL
 *   local                 → http://localhost:3000
 *
 * Usage:
 *   BUILD_TARGET=local npx cap sync ios
 *   BUILD_TARGET=preview PREVIEW_URL=https://aria-xxx.vercel.app npx cap sync ios
 */
function resolveServerUrl(): string {
  const target = process.env.BUILD_TARGET ?? 'production';
  switch (target) {
    case 'local':
      return process.env.LOCAL_URL ?? 'http://localhost:3000';
    case 'preview':
      if (!process.env.PREVIEW_URL) {
        throw new Error('[capacitor.config] BUILD_TARGET=preview requires PREVIEW_URL to be set');
      }
      return process.env.PREVIEW_URL;
    case 'staging':
      return process.env.STAGING_URL ?? 'https://staging.getariaai.com/crm';
    case 'production':
    default:
      return 'https://getariaai.com/crm';
  }
}

const config: CapacitorConfig = {
  appId: 'com.getariaai.app',
  appName: 'Aria',
  webDir: 'public', // doesn't matter when using url
  server: {
    url: resolveServerUrl(),
    iosScheme: 'https',
    androidScheme: 'https',
    allowNavigation: ['getariaai.com', '*.getariaai.com', '*.vercel.app']
  }
};

export default config;
