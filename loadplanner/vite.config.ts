import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === "development";

  return {
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      allowedHosts: true,
      cors: {
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
      },
      hmr: {
        clientPort: 443,
        protocol: 'wss',
        host: 'localhost'
      },
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true'
      }
    },
    plugins: [
      react(),
      isDev && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "stream": "stream-browserify",
        "buffer": "buffer",
        "process": "process/browser",
        "util": "util",
        "events": "events",
      },
    },
    define: {
      global: "globalThis",
      'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production'),
    },
    build: {
      manifest: false,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom', 'react-hook-form'],
            'vendor-ui': [
              '@radix-ui/react-accordion',
              '@radix-ui/react-alert-dialog',
              '@radix-ui/react-checkbox',
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-label',
              '@radix-ui/react-popover',
              '@radix-ui/react-select',
              '@radix-ui/react-separator',
              '@radix-ui/react-slider',
              '@radix-ui/react-slot',
              '@radix-ui/react-switch',
              '@radix-ui/react-tabs',
              '@radix-ui/react-toast',
              '@radix-ui/react-tooltip'
            ],
            'vendor-data': [
              'date-fns', 
              'zod',
              '@hookform/resolvers',
              '@tanstack/react-query',
              'clsx',
              'tailwind-merge',
              'class-variance-authority'
            ],
            'vendor-maps': ['leaflet', 'react-leaflet'],
            'vendor-charts': ['recharts'],
            'vendor-api': ['@supabase/supabase-js'],
            'vendor-utils': ['xlsx', 'jspdf', 'jspdf-autotable']
          }
        }
      },
      chunkSizeWarningLimit: 1000,
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: "globalThis"
        },
      },
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'leaflet',
        'recharts',
        '@supabase/supabase-js',
        'xlsx'
      ]
    },
  };
});