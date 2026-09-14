import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),

      VitePWA({
        registerType: 'autoUpdate',

        includeAssets: [
          'favicon.svg',
        ],

        manifest: {
          name: 'UNO King - Royal Card Game',
          short_name: 'UNO King',
          description: 'Play UNO King online with friends.',
          theme_color: '#0b0b0f',
          background_color: '#0b0b0f',
          display: 'standalone',
          orientation: 'portrait',

          icons: [
  {
    src: '/favicon.svg',
    sizes: '64x64',
    type: 'image/svg+xml',
  },
  {
    src: '/favicon.svg',
    sizes: '192x192',
    type: 'image/svg+xml',
  },
  {
    src: '/favicon.svg',
    sizes: '512x512',
    type: 'image/svg+xml',
    purpose: 'any maskable',
  },
],
        },

        workbox: {
          navigateFallback: '/',
        },

        devOptions: {
          enabled: true,
        },
      }),
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});