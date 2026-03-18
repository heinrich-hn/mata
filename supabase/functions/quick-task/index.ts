import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-source, x-batch-size, x-target-collection'
};

// Default values for trips (can be overridden and fully editable after import)
const DEFAULT_STATUS = 'active';
const DEFAULT_CURRENCY = 'ZAR';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Webhook received - Starting trip import process');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { trips } = await req.json();

    if (!trips || !Array.isArray(trips)) {
      console.error('Invalid payload: trips array missing or invalid');
      return new Response(
        JSON.stringify({ error: 'Invalid payload: trips array required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Processing ${trips.length} loads from webhook`);

    const results = {
      success: [],
      failed: [],
      updated: [],
      created: []
    };

    // Process each load (webhook data represents loads, not trips)
    for (const trip of trips) {
      try {
        // Validate required fields
        if (!trip.loadRef) {
          results.failed.push({
            loadRef: 'unknown',
            error: 'Missing loadRef'
          });
          continue;
        }

        // Map incoming data to Supabase LOADS table schema
        // Use provided values or defaults (all fields remain fully editable after import)
        const loadData = {
          load_number: trip.loadRef,
          customer_name: trip.customer || 'Unknown',
          cargo_type: trip.cargoType || 'General Freight',
          weight_kg: trip.weightKg || 0,
          origin: trip.origin || 'TBD',
          destination: trip.destination || 'TBD',
          origin_address: trip.originAddress || null,
          destination_address: trip.destinationAddress || null,
          pickup_datetime: trip.shippedDate ? new Date(trip.shippedDate).toISOString() : new Date().toISOString(),
          delivery_datetime: trip.deliveredDate ? new Date(trip.deliveredDate).toISOString() : new Date().toISOString(),
          actual_pickup_datetime: trip.shippedDate ? new Date(trip.shippedDate).toISOString() : null,
          actual_delivery_datetime: trip.deliveredDate ? new Date(trip.deliveredDate).toISOString() : null,
          // Use provided status/currency or defaults (fully editable after import)
          status: trip.status || DEFAULT_STATUS,
          currency: trip.currency || DEFAULT_CURRENCY,
          // Note: assigned_trip_id and assigned_vehicle_id will be null until manually assigned via UI
          assigned_trip_id: null,
          assigned_vehicle_id: null,
          channel: trip.channel || null,
          packaging_type: trip.packagingType || null,
          pallet_count: trip.palletCount || null,
          volume_m3: trip.volumeM3 || null,
          quoted_price: trip.quotedPrice || null,
          final_price: trip.finalPrice || null,
          priority: trip.priority || null,
          special_instructions: trip.specialInstructions || null,
          special_requirements: trip.specialRequirements || null,
          contact_person: trip.contactPerson || null,
          contact_phone: trip.contactPhone || null,
          notes: trip.notes || null,
          updated_at: new Date().toISOString(),
          attachments: {
            imported_at: new Date().toISOString(),
            import_source: trip.importSource || 'web_book',
            webhook_data: {
              shipped_status: trip.shippedStatus,
              delivered_status: trip.deliveredStatus,
              trip_duration_hours: trip.tripDurationHours,
              original_loadRef: trip.loadRef
            }
          }
        };

        console.log(`Processing load: ${trip.loadRef} - STATUS: ${loadData.status}`);

        // Check if load already exists
        const { data: existingLoad, error: checkError } = await supabase
          .from('loads')
          .select('id, load_number')
          .eq('load_number', trip.loadRef)
          .maybeSingle();

        if (checkError) {
          console.error(`Error checking load ${trip.loadRef}:`, checkError);
          results.failed.push({
            loadRef: trip.loadRef,
            error: checkError.message
          });
          continue;
        }

        if (existingLoad) {
          // Update existing load with provided data
          console.log(`Updating existing load ${trip.loadRef}`);

          const { error: updateError } = await supabase
            .from('loads')
            .update(loadData)
            .eq('id', existingLoad.id);

          if (updateError) {
            console.error(`Error updating load ${trip.loadRef}:`, updateError);
            results.failed.push({
              loadRef: trip.loadRef,
              error: updateError.message
            });
          } else {
            console.log(`Updated load: ${trip.loadRef}`);
            results.updated.push(trip.loadRef);
            results.success.push(trip.loadRef);
          }
        } else {
          // Create new load with provided data
          console.log(`Creating new load ${trip.loadRef}`);

          const { error: insertError } = await supabase
            .from('loads')
            .insert(loadData);

          if (insertError) {
            console.error(`Error creating load ${trip.loadRef}:`, insertError);
            results.failed.push({
              loadRef: trip.loadRef,
              error: insertError.message
            });
          } else {
            console.log(`Created load: ${trip.loadRef}`);
            results.created.push(trip.loadRef);
            results.success.push(trip.loadRef);
          }
        }
      } catch (tripError) {
        console.error(`Unexpected error processing load ${trip.loadRef}:`, tripError);
        results.failed.push({
          loadRef: trip.loadRef,
          error: tripError instanceof Error ? tripError.message : 'Unknown error'
        });
      }
    }

    // Log summary
    console.log(`\n📊 Import Summary:`);
    console.log(`   ✅ Successful: ${results.success.length}`);
    console.log(`   🆕 Created: ${results.created.length}`);
    console.log(`   🔄 Updated: ${results.updated.length}`);
    console.log(`   ❌ Failed: ${results.failed.length}`);
    console.log(`🏁 Webhook processing completed - All loads imported and editable\n`);

    // Return response
    const response = {
      status: 'success',
      message: `Processed ${trips.length} loads - All fields are fully editable. Use LoadAssignmentDialog to assign to trips.`,
      results: {
        total: trips.length,
        successful: results.success.length,
        created: results.created.length,
        updated: results.updated.length,
        failed: results.failed.length
      },
      details: {
        success: results.success,
        failed: results.failed
      },
      note: 'Loads created without trip assignment. Use UI to assign loads to trips and vehicles.',
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(response), {
      status: results.failed.length > 0 ? 207 : 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unexpected error in webhook handler:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
