import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'PDF添削',
        short_name: 'PDF添削',
        description: 'iPadでPDFを添削するアプリ',
        theme_color: '#2563eb',
        background_color: '#f5f5f7',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the app shell + PDF.js worker + cmaps + standard fonts so
        // the app runs fully offline once installed.
        globPatterns: [
          '**/*.{js,mjs,css,html,ico,png,svg,woff2,bcmap,pfb,cff,ttf,otf}',
        ],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
      devOptions: {
        // Run the service worker in dev too so we can iterate on PWA behaviour
        // without a full build. NOTE: SW only registers over HTTPS or on
        // localhost — testing from another device requires the production
        // build or a tunnel.
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
  base: './',
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    headers: {
      'Cache-Control': 'no-store',
    },
  },
});
