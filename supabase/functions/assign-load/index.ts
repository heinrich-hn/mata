// supabase/functions/assign-load/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_ANON_KEY") || ""
);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { load_id, vehicle_id, driver_id } = await req.json();

    if (!load_id || !vehicle_id || !driver_id) {
      return new Response(JSON.stringify({ error: "Missing load_id, vehicle_id, or driver_id" }), { status: 400 });
    }

    // Start transaction-like update
    const { error: loadError } = await supabase
      .from("loads")
      .update({
        assigned_vehicle_id: vehicle_id,
        driver_id,
        status: "assigned",
        updated_at: new Date().toISOString(),
      })
      .eq("id", load_id);

    if (loadError) throw loadError;

    const { error: vehicleError } = await supabase
      .from("vehicles")
      .update({ status: "assigned" })
      .eq("id", vehicle_id);

    if (vehicleError) throw vehicleError;

    const { error: driverError } = await supabase
      .from("drivers")
      .update({ status: "busy" })
      .eq("id", driver_id);

    if (driverError) throw driverError;

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("Assignment error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
