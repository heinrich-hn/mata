import { useEffect } from 'react';

/**
 * Registers the client portal service worker and injects PWA manifest + meta tags.
 * Should only be rendered on /portal/* routes so the main admin app is unaffected.
 */
export function ClientPWARegistration() {
  useEffect(() => {
    const [, , clientId] = window.location.pathname.split('/');
    const portalPath = clientId ? `/portal/${clientId}` : '/portal/';

    const manifest = {
      name: 'Matanuska - Client Portal',
      short_name: 'Matanuska',
      description: 'Track your deliveries, view loads, and monitor fleet in real-time',
      start_url: portalPath,
      scope: '/portal/',
      display: 'standalone',
      orientation: 'any',
      background_color: '#ffffff',
      theme_color: '#1e40af',
      categories: ['business', 'logistics', 'transportation'],
      icons: [
        { src: '/pwa-icons/icon-72x72.png', sizes: '72x72', type: 'image/png', purpose: 'any' },
        { src: '/pwa-icons/icon-96x96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
        { src: '/pwa-icons/icon-128x128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
        { src: '/pwa-icons/icon-144x144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
        { src: '/pwa-icons/icon-152x152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
        { src: '/pwa-icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/pwa-icons/icon-384x384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
        { src: '/pwa-icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/pwa-icons/icon-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: '/pwa-icons/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      screenshots: [],
      shortcuts: [
        { name: 'Live Map', short_name: 'Map', url: `${portalPath}/live-map`, icons: [] },
      ],
    };
    const manifestUrl = URL.createObjectURL(
      new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' })
    );

    // --- Inject manifest link ---
    let manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = manifestUrl;

    // --- Inject PWA meta tags ---
    const metaTags: Record<string, string> = {
      'theme-color': '#1e40af',
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'default',
      'apple-mobile-web-app-title': 'Matanuska',
      'mobile-web-app-capable': 'yes',
    };

    const addedMeta: HTMLMetaElement[] = [];
    for (const [name, content] of Object.entries(metaTags)) {
      let existing = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!existing) {
        existing = document.createElement('meta');
        existing.name = name;
        document.head.appendChild(existing);
        addedMeta.push(existing);
      }
      existing.content = content;
    }

    // --- Inject Apple touch icon ---
    let appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (!appleIcon) {
      appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      document.head.appendChild(appleIcon);
    }
    appleIcon.href = '/pwa-icons/icon-192x192.png';

    // --- Register service worker ---
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/client-sw.js', { scope: '/portal/' })
        .then((reg) => {
          console.log('[Client PWA] Service worker registered, scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[Client PWA] Service worker registration failed:', err);
        });
    }

    // Cleanup: remove injected tags when leaving portal
    return () => {
      manifestLink?.remove();
      URL.revokeObjectURL(manifestUrl);
      appleIcon?.remove();
      addedMeta.forEach((el) => el.remove());
    };
  }, []);

  return null;
}