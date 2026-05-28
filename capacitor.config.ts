import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.atrium.workspace',
  appName: 'Atrium',
  webDir: 'www',
  server: {
    url: 'https://holo-room-flow.lovable.app',
    cleartext: true
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
  },
  backgroundColor: '#1f3a8a',
};

export default config;
