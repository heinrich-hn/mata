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
        const payload = await req.json();

        // Validate required fields
        const { source_breakdown_id, description, breakdown_date, severity, category } = payload;

        if (!description || !breakdown_date || !severity || !category) {
            return new Response(
                JSON.stringify({ error: "Missing required fields: description, breakdown_date, severity, category" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Initialize main app Supabase client
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Check for duplicate (idempotency)
        if (source_breakdown_id) {
            const { data: existing } = await supabase
                .from("fleet_breakdowns")
                .select("id")
                .eq("source_breakdown_id", source_breakdown_id)
                .maybeSingle();

            if (existing) {
                return new Response(
                    JSON.stringify({
                        id: existing.id,
                        message: "Breakdown already exists in main app",
                        duplicate: true,
                    }),
                    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        }

        // Try to match vehicle by registration number if provided
        let vehicleId: string | null = null;
        if (payload.vehicle_id_text) {
            const { data: vehicle } = await supabase
                .from("vehicles")
                .select("id")
                .or(`registration_number.eq.${payload.vehicle_id_text},fleet_number.eq.${payload.vehicle_id_text}`)
                .maybeSingle();

            if (vehicle) {
                vehicleId = vehicle.id;
            }
        }

        // Insert the breakdown into the main app
        const { data, error } = await supabase
            .from("fleet_breakdowns")
            .insert({
                source_app: "loadplanner",
                source_breakdown_id: source_breakdown_id ?? null,
                source_breakdown_number: payload.source_breakdown_number ?? null,
                vehicle_registration: payload.vehicle_id_text ?? null,
                vehicle_id: vehicleId,
                driver_name: payload.driver_name ?? null,
                breakdown_date,
                location: payload.location ?? null,
                description,
                severity,
                category,
                load_number: payload.load_number ?? null,
                status: "pending_review",
            })
            .select("id")
            .single();

        if (error) {
            console.error("Insert error:", error);
            throw new Error(`Failed to create breakdown: ${error.message}`);
        }

        console.log(`Received breakdown from loadplanner: ${data.id}`);

        return new Response(
            JSON.stringify({
                id: data.id,
                message: "Breakdown received and created successfully",
            }),
            { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Receive breakdown error:", error);
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : "Unknown error",
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
