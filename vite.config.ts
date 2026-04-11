import react from "@vitejs/plugin-react-swc";
import { componentTagger } from "lovable-tagger";
import path from "path";
import { fileURLToPath } from 'url';
import { defineConfig } from "vite";
import { VitePWA } from 'vite-plugin-pwa';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    cors: true,
    hmr: {
      clientPort: 443,
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    proxy: {
      '/wialon-api': {
        target: 'https://hst-api.wialon.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wialon-api/, ''),
        secure: true,
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon-16.png', 'favicon-32.png', 'robots.txt', 'og-image.png', 'apple-touch-icon.png', 'app-icon.svg'],
      manifest: {
        name: 'Matanuska Transport - Fleet Management',
        short_name: 'Matanuska',
        description: 'Professional transport management system for job cards, vehicle inspections, fault tracking, and inventory management',
        theme_color: '#1e40af',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        categories: ['business', 'productivity', 'utilities'],
        icons: [
          {
            src: '/icon-48.png',
            sizes: '48x48',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-72.png',
            sizes: '72x72',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-96.png',
            sizes: '96x96',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-128.png',
            sizes: '128x128',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-144.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-152.png',
            sizes: '152x152',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-192-maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icon-256.png',
            sizes: '256x256',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-384.png',
            sizes: '384x384',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          }
        ],
        screenshots: [
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Matanuska Transport App',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Fleet Management Dashboard',
          }
        ],
        shortcuts: [
          {
            name: 'Dashboard',
            short_name: 'Dashboard',
            url: '/',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Inspections',
            short_name: 'Inspections',
            url: '/inspections',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Job Cards',
            short_name: 'Jobs',
            url: '/open-job-cards',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,webmanifest}'],
        globIgnores: ['**/node_modules/**/*', 'sw.js', 'workbox-*.js', '**/*.map'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB
        globDirectory: 'dist',
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/wialon-api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Force Leaflet JS to use the production build (but not CSS)
      'leaflet$': path.resolve(__dirname, 'node_modules/leaflet/dist/leaflet.js'),
      // Polyfill Node.js stream for xlsx-js-style browser compatibility
      "stream": "stream-browserify",
    },
  },
  // 🔥 CRITICAL: Don't pre-bundle Leaflet and force proper React imports
  optimizeDeps: {
    exclude: ['react-leaflet'],
    include: ['react', 'react-dom', 'react-dom/client', 'leaflet'],
    esbuildOptions: {
      // Ensure proper module resolution
      mainFields: ['module', 'main'],
    },
  },
  build: {
    sourcemap: false,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom')) return 'react-dom';
            if (id.includes('/react/') || id.includes('/scheduler/')) return 'react-core';
            if (id.includes('@supabase')) return 'supabase-vendor';
            if (id.includes('@radix-ui')) return 'ui-vendor';
            if (id.includes('@tanstack')) return 'query-vendor';
            if (id.includes('recharts') || id.includes('d3-')) return 'charts-vendor';
            if (id.includes('leaflet') || id.includes('react-leaflet') || id.includes('@react-leaflet')) return 'map-vendor';
            if (id.includes('jspdf') || id.includes('jspdf-autotable')) return 'pdf-vendor';
            if (id.includes('exceljs') || id.includes('xlsx') || id.includes('file-saver') || id.includes('html2canvas')) return 'export-vendor';
            if (id.includes('lucide-react')) return 'icons-vendor';
            if (id.includes('date-fns')) return 'date-vendor';
            if (id.includes('zod') || id.includes('react-hook-form') || id.includes('@hookform')) return 'form-vendor';
            if (id.includes('cmdk') || id.includes('embla-carousel') || id.includes('vaul') || id.includes('sonner') || id.includes('input-otp') || id.includes('class-variance-authority') || id.includes('clsx') || id.includes('tailwind-merge')) return 'ui-utils-vendor';
            if (id.includes('qrcode') || id.includes('qr-code') || id.includes('html5-qrcode')) return 'qr-vendor';
            // Catch-all for remaining node_modules
            return 'vendor';
          }
        },
      },
    },
  },
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        jsx: "react-jsx",
        target: "ES2020",
        useDefineForClassFields: true,
        module: "ESNext",
      },
    },
  },
}));