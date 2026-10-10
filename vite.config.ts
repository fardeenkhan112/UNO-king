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
    src: '/icons/icon-192.png',
    sizes: '192x192',
    type: 'image/png',
  },
  {
    src: '/icons/icon-512.png',
    sizes: '512x512',
    type: 'image/png',
    purpose: 'any maskable',
  },
],
        },

        workbox: {
          navigateFallback: 'index.html',
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