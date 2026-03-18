// supabase/functions/get-wialon-token/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const WIALON_HOST = Deno.env.get("WIALON_HOST") || "https://hst-api.wialon.com";
const WIALON_USER = Deno.env.get("WIALON_USER") || "";
const WIALON_PASS = Deno.env.get("WIALON_PASS") || "";
const WIALON_APP_NAME = Deno.env.get("WIALON_APP_NAME") || "";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Accept both GET and POST. supabase.functions.invoke() sends POST by default,
  // while direct HTTP requests (or manual tests) may use GET.
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  if (!WIALON_USER || !WIALON_PASS || !WIALON_APP_NAME) {
    return new Response(JSON.stringify({ error: "Missing Wialon configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Step 1: Login to get SID
    const loginParams = { user: WIALON_USER, password: WIALON_PASS };
    const loginUrl = `${WIALON_HOST}/wialon/ajax.html?svc=core/login&params=${encodeURIComponent(JSON.stringify(loginParams))}`;

    const loginRes = await fetch(loginUrl);
    const loginData = await loginRes.json();

    if (loginData.error) {
      throw new Error(`Login failed: ${loginData.error}`);
    }

    const sid = loginData.eid;

    // Step 2: Create token with SID
    const tokenParams = {
      callMode: "create",
      app: WIALON_APP_NAME,
      at: 0,           // Activate now
      dur: 2592000,    // 30 days
      fl: -1,          // Unlimited access
      p: "{}",         // Minimal params
    };

    const tokenUrl = `${WIALON_HOST}/wialon/ajax.html?svc=token/update&params=${encodeURIComponent(JSON.stringify(tokenParams))}&sid=${sid}`;

    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      throw new Error(`Token creation failed: ${tokenData.error}`);
    }

    return new Response(JSON.stringify({ token: tokenData.h }), {  // 'h' is the token name/field
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
