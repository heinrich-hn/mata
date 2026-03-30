import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
    server: {
        host: "::",
        port: 5175,
        cors: true,
        // Add this to ensure proper MIME types
        headers: {
            'Access-Control-Allow-Origin': '*',
        },
    },
    plugins: [
        react(),
        // Always include PWA plugin but configure differently for dev
        VitePWA({
            registerType: "autoUpdate",
            // Disable PWA in dev — Codespaces tunnel intercepts registerSW.js & manifest
            devOptions: {
                enabled: false,
            },
            includeAssets: [
                "icons/icon-72x72.png",
                "icons/icon-96x96.png",
                "icons/icon-128x128.png",
                "icons/icon-144x144.png",
                "icons/icon-152x152.png",
                "icons/icon-192x192.png",
                "icons/icon-384x384.png",
                "icons/icon-512x512.png",
            ],
            manifest: {
                name: "Matanuska Driver App",
                short_name: "Matanuska",
                description: "Fleet management driver application for Matanuska",
                theme_color: "#2563EB",
                background_color: "#ffffff",
                display: "standalone",
                orientation: "portrait",
                scope: "/",
                start_url: "/",
                categories: ["business", "productivity"],
                icons: [
                    {
                        src: "icons/icon-72x72.png",
                        sizes: "72x72",
                        type: "image/png",
                        purpose: "maskable any",
                    },
                    {
                        src: "icons/icon-96x96.png",
                        sizes: "96x96",
                        type: "image/png",
                        purpose: "maskable any",
                    },
                    {
                        src: "icons/icon-128x128.png",
                        sizes: "128x128",
                        type: "image/png",
                        purpose: "maskable any",
                    },
                    {
                        src: "icons/icon-144x144.png",
                        sizes: "144x144",
                        type: "image/png",
                        purpose: "maskable any",
                    },
                    {
                        src: "icons/icon-152x152.png",
                        sizes: "152x152",
                        type: "image/png",
                        purpose: "maskable any",
                    },
                    {
                        src: "icons/icon-192x192.png",
                        sizes: "192x192",
                        type: "image/png",
                        purpose: "maskable any",
                    },
                    {
                        src: "icons/icon-384x384.png",
                        sizes: "384x384",
                        type: "image/png",
                        purpose: "maskable any",
                    },
                    {
                        src: "icons/icon-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "maskable any",
                    },
                ],
            },
            workbox: {
                globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
                navigateFallback: "/index.html",
                navigateFallbackDenylist: [/^\/api/, /^\/auth/],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: "CacheFirst",
                        options: {
                            cacheName: "google-fonts-cache",
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365,
                            },
                        },
                    },
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
        dedupe: ["react", "react-dom"],
        extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
    },
    build: {
        sourcemap: true,
        cssCodeSplit: false,
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, "index.html"),
            },
            output: {
                manualChunks: {
                    "react-vendor": ["react", "react-dom", "react-router-dom"],
                    "supabase-vendor": ["@supabase/supabase-js"],
                },
            },
        },
    },
    optimizeDeps: {
        include: ['react', 'react-dom', 'react-router-dom'],
    },
});