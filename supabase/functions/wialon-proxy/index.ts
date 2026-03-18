// supabase/functions/wialon-proxy/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const WIALON_HOST = Deno.env.get("WIALON_HOST") || "https://hst-api.wialon.eu";
const WIALON_TOKEN = Deno.env.get("WIALON_TOKEN") || "";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { service, params, sid } = await req.json();

    if (!service) {
      return new Response(
        JSON.stringify({ error: 'Service parameter required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use provided token or fall back to env token
    const token = params?.token || WIALON_TOKEN;

    if (!token && !sid) {
      return new Response(
        JSON.stringify({ error: 'Wialon token or session ID required' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build Wialon API URL with session ID if provided
    let url = `${WIALON_HOST}/wialon/ajax.html?svc=${service}`;
    if (sid) {
      url += `&sid=${sid}`;
    }

    // Make request to Wialon API
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `params=${encodeURIComponent(JSON.stringify(params))}`,
    });

    const data = await response.json();

    return new Response(
      JSON.stringify(data),
      {
        status: response.ok ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Wialon proxy error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
