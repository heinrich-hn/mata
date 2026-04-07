import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "favicon-16.png",
        "favicon-32.png",
        "apple-touch-icon.png",
        "og-image.png",
      ],
      manifest: {
        name: "MATA Fleet Command Center",
        short_name: "Fleet Monitor",
        description:
          "Monitor fleet operations, maintenance, and performance in real time",
        theme_color: "#1e293b",
        background_color: "#f8fafc",
        display: "standalone",
        scope: "/",
        start_url: "/",
        orientation: "any",
        categories: ["business", "productivity"],
        icons: [
          {
            src: "/icon-48.png",
            sizes: "48x48",
            type: "image/png",
          },
          {
            src: "/icon-72.png",
            sizes: "72x72",
            type: "image/png",
          },
          {
            src: "/icon-96.png",
            sizes: "96x96",
            type: "image/png",
          },
          {
            src: "/icon-128.png",
            sizes: "128x128",
            type: "image/png",
          },
          {
            src: "/icon-144.png",
            sizes: "144x144",
            type: "image/png",
          },
          {
            src: "/icon-152.png",
            sizes: "152x152",
            type: "image/png",
          },
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icon-192-maskable.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icon-256.png",
            sizes: "256x256",
            type: "image/png",
          },
          {
            src: "/icon-384.png",
            sizes: "384x384",
            type: "image/png",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern:
              /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern:
              /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern:
              /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    host: true,
  },
});
