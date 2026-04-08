// Supabase Edge Function: surfsight-proxy
// Proxies requests to Surfsight API (EU environment) to keep credentials server-side.
// Handles: authentication, fetching events, fetching event media download links, listing devices.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SURFSIGHT_BASE = "https://api.de.surfsight.net/v2";
const SURFSIGHT_EMAIL = Deno.env.get("SURFSIGHT_EMAIL") || "";
const SURFSIGHT_PASSWORD = Deno.env.get("SURFSIGHT_PASSWORD") || "";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory token cache (edge functions are short-lived, so this helps within a single instance)
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string> {
    if (cachedToken && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    const res = await fetch(`${SURFSIGHT_BASE}/authenticate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: SURFSIGHT_EMAIL, password: SURFSIGHT_PASSWORD }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Surfsight auth failed (${res.status}): ${text}`);
    }

    const json = await res.json();
    cachedToken = json.data.token;
    // Token valid for 24h, refresh at 23h
    tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
    return cachedToken!;
}

async function surfsightGet(path: string, token: string): Promise<Response> {
    const res = await fetch(`${SURFSIGHT_BASE}${path}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
    });
    return res;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { action } = body;

        if (!SURFSIGHT_EMAIL || !SURFSIGHT_PASSWORD) {
            return new Response(
                JSON.stringify({ error: "Surfsight credentials not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const token = await getToken();

        switch (action) {
            // List all devices in the org
            case "devices": {
                const orgId = body.orgId || "14478";
                const res = await surfsightGet(`/organizations/${orgId}/devices`, token);
                const data = await res.json();
                return new Response(JSON.stringify(data), {
                    status: res.status,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Get events for a device within a time range
            case "events": {
                const { imei, start, end } = body;
                if (!imei || !start || !end) {
                    return new Response(
                        JSON.stringify({ error: "imei, start, and end are required" }),
                        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }
                const res = await surfsightGet(
                    `/devices/${encodeURIComponent(imei)}/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
                    token
                );
                const data = await res.json();
                return new Response(JSON.stringify(data), {
                    status: res.status,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Get a download link for event media (snapshot or video)
            case "event-media-link": {
                const { imei, fileId, cameraId, fileType } = body;
                if (!imei || !fileId || !cameraId || !fileType) {
                    return new Response(
                        JSON.stringify({ error: "imei, fileId, cameraId, and fileType are required" }),
                        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }
                const res = await surfsightGet(
                    `/devices/${encodeURIComponent(imei)}/event-file-link?fileId=${encodeURIComponent(fileId)}&cameraId=${encodeURIComponent(cameraId)}&fileType=${encodeURIComponent(fileType)}`,
                    token
                );
                const data = await res.json();
                return new Response(JSON.stringify(data), {
                    status: res.status,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            // Get links for all cameras of an event at once
            case "event-media-links": {
                const { imei, fileId, fileType, cameraIds } = body;
                if (!imei || !fileId || !fileType) {
                    return new Response(
                        JSON.stringify({ error: "imei, fileId, and fileType are required" }),
                        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }
                const ids = cameraIds || "1,2";
                const res = await surfsightGet(
                    `/devices/${encodeURIComponent(imei)}/event-file-link?fileId=${encodeURIComponent(fileId)}&cameraId=0&fileType=${encodeURIComponent(fileType)}&cameraIds=${encodeURIComponent(ids)}`,
                    token
                );
                const data = await res.json();
                return new Response(JSON.stringify(data), {
                    status: res.status,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            default:
                return new Response(
                    JSON.stringify({ error: `Unknown action: ${action}` }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
        }
    } catch (err) {
        console.error("surfsight-proxy error:", err);
        return new Response(
            JSON.stringify({ error: err.message || "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
