/**
 * Vercel Edge Function – Dynamic Open Graph meta tags for shared links.
 *
 * Serves minimal HTML with route-specific OG tags when social-media crawlers
 * (WhatsApp, Facebook, Twitter, Slack, etc.) fetch /track or /portal URLs.
 * Regular users never hit this – they get the SPA via the catch-all rewrite.
 *
 * Query parameters (set by vercel.json rewrites):
 *   type      – "track" | "portal"
 *   token     – tracking share token (for type=track)
 *   clientId  – client UUID        (for type=portal)
 */

export const config = { runtime: 'edge' };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEnv(name: string): string | undefined {
    const denoEnv = (globalThis as { Deno?: { env?: { get: (key: string) => string | undefined } } }).Deno?.env;
    if (denoEnv) return denoEnv.get(name);
    if (typeof process !== 'undefined' && process.env) return process.env[name];
    return undefined;
}

/** Escape HTML special characters to prevent XSS in injected meta values. */
function esc(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/** Fire-and-forget Supabase REST query. Returns parsed JSON or null. */
async function supabaseFetch(table: string, query: string): Promise<unknown[] | null> {
    const baseUrl = getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL');
    const anonKey = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY');
    if (!baseUrl || !anonKey) return null;

    try {
        const res = await fetch(`${baseUrl}/rest/v1/${table}?${query}`, {
            headers: {
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`,
                Accept: 'application/json',
            },
        });
        if (!res.ok) return null;
        return (await res.json()) as unknown[];
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// OG data builders
// ---------------------------------------------------------------------------

interface OgData {
    title: string;
    description: string;
    canonicalUrl: string;
    imageUrl: string;
}

async function buildTrackOg(origin: string, token: string | null): Promise<OgData> {
    const base: OgData = {
        title: 'LoadPlan – Live Shipment Tracking',
        description: 'Track your shipment in real-time with live GPS updates.',
        canonicalUrl: token ? `${origin}/track?token=${token}` : `${origin}/track`,
        imageUrl: `${origin}/loadplan-logo.png`,
    };

    if (!token) return base;

    try {
        // 1. Validate the share link
        const links = (await supabaseFetch(
            'tracking_share_links',
            `token=eq.${encodeURIComponent(token)}&expires_at=gt.${new Date().toISOString()}&select=load_id`,
        )) as { load_id: string }[] | null;

        if (!links?.[0]?.load_id) return base;

        // 2. Fetch the related load
        const loads = (await supabaseFetch(
            'loads',
            `id=eq.${encodeURIComponent(links[0].load_id)}&select=load_id,origin,destination,status,client_id`,
        )) as {
            load_id: string;
            origin: string;
            destination: string;
            status: string;
            client_id: string | null;
        }[] | null;

        if (!loads?.[0]) return base;

        const load = loads[0];
        base.title = `LoadPlan – Tracking ${load.load_id}`;
        if (load.origin && load.destination) {
            base.description = `${load.origin} → ${load.destination} · Track this shipment live on LoadPlan.`;
        }
    } catch {
        // Fall through to defaults
    }

    return base;
}

async function buildPortalOg(origin: string, clientId: string | null): Promise<OgData> {
    const base: OgData = {
        title: 'LoadPlan – Client Portal',
        description: 'View live tracking, deliveries, and documents for your shipments.',
        canonicalUrl: clientId ? `${origin}/portal/${clientId}` : `${origin}/portal`,
        imageUrl: `${origin}/loadplan-logo.png`,
    };

    if (!clientId) return base;

    try {
        const clients = (await supabaseFetch(
            'clients',
            `id=eq.${encodeURIComponent(clientId)}&select=name`,
        )) as { name: string }[] | null;

        if (clients?.[0]?.name) {
            const name = clients[0].name;
            base.title = `LoadPlan – ${name}`;
            base.description = `${name} — Live tracking, deliveries & documents.`;
        }
    } catch {
        // Fall through to defaults
    }

    return base;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    const origin = url.origin;

    let og: OgData;

    if (type === 'track') {
        og = await buildTrackOg(origin, url.searchParams.get('token'));
    } else if (type === 'portal') {
        og = await buildPortalOg(origin, url.searchParams.get('clientId'));
    } else {
        og = {
            title: 'LoadPlan',
            description: 'Fleet management, load planning & live tracking.',
            canonicalUrl: origin,
            imageUrl: `${origin}/loadplan-logo.png`,
        };
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(og.title)}</title>

<!-- Open Graph -->
<meta property="og:title"       content="${esc(og.title)}"/>
<meta property="og:description" content="${esc(og.description)}"/>
<meta property="og:image"       content="${esc(og.imageUrl)}"/>
<meta property="og:image:width" content="512"/>
<meta property="og:image:height" content="512"/>
<meta property="og:url"         content="${esc(og.canonicalUrl)}"/>
<meta property="og:type"        content="website"/>
<meta property="og:site_name"   content="LoadPlan"/>

<!-- Twitter Card -->
<meta name="twitter:card"        content="summary"/>
<meta name="twitter:title"       content="${esc(og.title)}"/>
<meta name="twitter:description" content="${esc(og.description)}"/>
<meta name="twitter:image"       content="${esc(og.imageUrl)}"/>

<!-- PWA deep-link hint -->
<link rel="manifest" href="/client-manifest.json"/>
<meta name="mobile-web-app-capable"       content="yes"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>

<!-- Redirect real users (non-crawlers) to the SPA page -->
<meta http-equiv="refresh" content="0;url=${esc(og.canonicalUrl)}"/>
</head>
<body>
<p>Redirecting to <a href="${esc(og.canonicalUrl)}">${esc(og.title)}</a>…</p>
</body>
</html>`;

    return new Response(html, {
        status: 200,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=60, s-maxage=300',
        },
    });
}
