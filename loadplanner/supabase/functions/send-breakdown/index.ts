import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { breakdown_id } = await req.json();

        if (!breakdown_id) {
            return new Response(
                JSON.stringify({ error: "breakdown_id is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Initialize loadplanner Supabase client (source)
        const sourceUrl = Deno.env.get("SUPABASE_URL")!;
        const sourceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const sourceClient = createClient(sourceUrl, sourceKey);

        // Fetch the breakdown with relations
        const { data: breakdown, error: fetchError } = await sourceClient
            .from("breakdowns")
            .select(`
        *,
        load:loads(id, load_id),
        fleet_vehicle:fleet_vehicles(id, vehicle_id, type),
        driver:drivers(id, name, contact)
      `)
            .eq("id", breakdown_id)
            .single();

        if (fetchError || !breakdown) {
            return new Response(
                JSON.stringify({ error: "Breakdown not found", details: fetchError?.message }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (breakdown.sent_to_main_app) {
            return new Response(
                JSON.stringify({ error: "Breakdown has already been sent to the main app" }),
                { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Initialize main app Supabase client (destination)
        const destUrl = Deno.env.get("DEST_SUPABASE_URL");
        const destKey = Deno.env.get("DEST_SUPABASE_SERVICE_ROLE_KEY");

        if (!destUrl || !destKey) {
            throw new Error("Missing DEST_SUPABASE_URL or DEST_SUPABASE_SERVICE_ROLE_KEY");
        }

        // Call the receiver edge function on the main app
        const receiverUrl = `${destUrl}/functions/v1/receive-breakdown`;
        const payload = {
            source_breakdown_id: breakdown.id,
            source_breakdown_number: breakdown.breakdown_number,
            vehicle_id_text: breakdown.fleet_vehicle?.vehicle_id ?? null,
            driver_name: breakdown.driver?.name ?? null,
            breakdown_date: breakdown.breakdown_date,
            location: breakdown.location,
            description: breakdown.description,
            severity: breakdown.severity,
            category: breakdown.category,
            load_number: breakdown.load?.load_id ?? null,
            reported_by: breakdown.reported_by,
        };

        const receiverResponse = await fetch(receiverUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${destKey}`,
            },
            body: JSON.stringify(payload),
        });

        if (!receiverResponse.ok) {
            const errBody = await receiverResponse.text();
            throw new Error(`Receiver returned ${receiverResponse.status}: ${errBody}`);
        }

        const result = await receiverResponse.json();

        // Mark as sent in source DB
        const { error: updateError } = await sourceClient
            .from("breakdowns")
            .update({
                sent_to_main_app: true,
                sent_at: new Date().toISOString(),
                main_app_breakdown_id: result.id ?? null,
            })
            .eq("id", breakdown_id);

        if (updateError) {
            console.error("Warning: Sent successfully but failed to mark as sent:", updateError);
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: "Breakdown sent to workshop successfully",
                main_app_id: result.id,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Send breakdown error:", error);
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : "Unknown error",
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
