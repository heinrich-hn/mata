/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV === 'development';

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: isDev,
  buildExcludes: [/middleware-manifest\.json$/],
  runtimeCaching: [], 
  sw: 'sw.js',
  cacheOnFrontEndNav: true,
  reloadOnOnline: true,
  fallbacks: {
    document: '/offline',
  },
});

const nextConfig = {
  reactStrictMode: true,
  
  turbopack: {
    root: process.cwd(),  // FIXED: must be absolute
  },
  
  typedRoutes: true,
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'wxvhkljrbcpcgpgdqhsp.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'wxvhkljrbcpcgpgdqhsp.supabase.co',
        pathname: '/auth/v1/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  compiler: {
    removeConsole: !isDev ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  experimental: {
    optimizeCss: !isDev,
    scrollRestoration: true,
  },

  // FIXED: moved out of experimental
  outputFileTracingExcludes: {
    '*': [
      './node_modules/@swc/**',
      './node_modules/sharp/**',
      './node_modules/esbuild/**',
      './node_modules/webpack/**',
      './node_modules/terser/**',
    ],
  },

  typescript: {
    ignoreBuildErrors: false,
    tsconfigPath: './tsconfig.json',
  },

  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],

  webpack: (config) => {
    return config;
  },
};

module.exports = withPWA(nextConfig);