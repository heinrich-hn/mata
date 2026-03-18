import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-source, x-batch-size, x-target-collection'
};

const REQUIRED_STATUS = 'active';
const REQUIRED_CURRENCY = 'USD';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Webhook received - Starting ACTIVE trip import process');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase environment variables');
      return new Response(JSON.stringify({
        status: 'error',
        message: 'Missing Supabase environment variables'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body;
    try {
      body = await req.json();
      console.log('📦 Received payload:', JSON.stringify(body, null, 2));
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown parsing error';
      return new Response(JSON.stringify({
        status: 'error',
        message: 'Invalid JSON payload',
        error: errorMessage
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { trips } = body || {};

    if (!trips || !Array.isArray(trips)) {
      return new Response(JSON.stringify({
        status: 'error',
        message: 'Invalid payload: trips array required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📦 Processing ${trips.length} trips from webhook`);

    const results = {
      success: [] as string[],
      failed: [] as Array<{ loadRef: string; error: string }>,
      updated: [] as string[],
      created: [] as string[]
    };

    for (const trip of trips) {
      try {
        if (!trip?.loadRef) {
          results.failed.push({
            loadRef: 'unknown',
            error: 'Missing loadRef'
          });
          continue;
        }

        console.log(`📝 Processing trip: ${trip.loadRef}`);

        // Base trip data - NO automatic revenue calculation
        const tripData: any = {
          trip_number: trip.loadRef,
          origin: trip.origin || null,
          destination: trip.destination || null,
          route: trip.origin && trip.destination ? `${trip.origin} - ${trip.destination}` : null,
          departure_date: trip.shippedDate || null,
          arrival_date: trip.deliveredDate || null,
          load_type: trip.cargoType || null,
          description: trip.notes || null,
          revenue_currency: trip.currency || REQUIRED_CURRENCY,
          status: REQUIRED_STATUS,
          payment_status: 'unpaid',
          shipped_status: trip.shippedStatus === 'delivered' || trip.shippedStatus === 'scheduled',
          delivered_status: trip.deliveredStatus === 'delivered',
          external_load_ref: trip.loadRef,
          trip_duration_hours: trip.tripDurationHours,
          import_source: trip.importSource || 'loads_sync',
          updated_at: new Date().toISOString(),
          edit_history: {
            imported_at: new Date().toISOString(),
            imported_from: trip.importSource || 'loads_sync',
            webhook_data: trip
          }
        };

        // 1. Handle Client - Direct UUID match
        if (trip.clientId) {
          const { data: client } = await supabase
            .from('clients')
            .select('id, name')
            .eq('id', trip.clientId)
            .maybeSingle();

          if (client) {
            tripData.client_id = client.id;
            tripData.client_name = client.name;
            console.log(`✅ Found client: ${client.name} (${client.id})`);
          } else {
            console.log(`⚠️ Client ID ${trip.clientId} not found, using name: ${trip.customer}`);
            tripData.client_name = trip.customer;
          }
        } else if (trip.customer) {
          tripData.client_name = trip.customer;
        }

        // 2. Handle Vehicle - IMPROVED MATCHING
        if (trip.fleetNumber) {
          console.log(`🔍 Looking for vehicle with fleet number: "${trip.fleetNumber}"`);

          // Try multiple matching strategies
          let vehicle = null;

          // Strategy 1: Exact match on fleet_number
          const { data: exactMatch } = await supabase
            .from('wialon_vehicles')
            .select('id, fleet_number, registration, name')
            .eq('fleet_number', trip.fleetNumber)
            .maybeSingle();

          if (exactMatch) {
            vehicle = exactMatch;
            console.log(`✅ Exact match found: ${vehicle.fleet_number}`);
          } else {
            // Strategy 2: Try to extract fleet number from name (e.g., "23H - AFQ 1324")
            const { data: nameMatch } = await supabase
              .from('wialon_vehicles')
              .select('id, fleet_number, registration, name')
              .ilike('name', `%${trip.fleetNumber}%`)
              .maybeSingle();

            if (nameMatch) {
              vehicle = nameMatch;
              console.log(`✅ Name match found: ${vehicle.name} -> fleet: ${vehicle.fleet_number}`);
            } else {
              // Strategy 3: Try wialon_vehicles with null fleet_number but matching name pattern
              const { data: patternMatch } = await supabase
                .from('wialon_vehicles')
                .select('id, fleet_number, registration, name')
                .ilike('name', `${trip.fleetNumber}%`)
                .maybeSingle();

              if (patternMatch) {
                vehicle = patternMatch;
                console.log(`✅ Pattern match found: ${vehicle.name}`);
              }
            }
          }

          if (vehicle) {
            tripData.vehicle_id = vehicle.id;
            console.log(`✅ Assigned vehicle ID: ${vehicle.id} for fleet: ${trip.fleetNumber}`);
          } else {
            console.log(`❌ No vehicle found for fleet number: ${trip.fleetNumber}`);

            // Log available vehicles for debugging
            const { data: availableVehicles } = await supabase
              .from('wialon_vehicles')
              .select('fleet_number, name')
              .not('fleet_number', 'is', null)
              .limit(10);

            console.log('📋 Available fleet numbers:', availableVehicles?.map(v => v.fleet_number).join(', '));
          }
        } else {
          console.log('⚠️ No fleetNumber provided in payload');
        }

        // 3. Handle Driver - Match by name
        if (trip.driverName) {
          console.log(`🔍 Looking for driver: "${trip.driverName}"`);

          const nameParts = trip.driverName.toLowerCase().split(' ').filter(p => p.length > 0);

          if (nameParts.length > 0) {
            // Try to match by first_name and last_name
            const conditions = nameParts.map(part =>
              `first_name.ilike.%${part}%,last_name.ilike.%${part}%`
            ).join(',');

            const { data: driver } = await supabase
              .from('drivers')
              .select('id, first_name, last_name')
              .or(conditions)
              .maybeSingle();

            if (driver) {
              tripData.driver_name = `${driver.first_name} ${driver.last_name}`.trim();
              console.log(`✅ Found driver: ${tripData.driver_name}`);
            } else {
              console.log(`⚠️ No driver found for name: ${trip.driverName}, storing as-is`);
              tripData.driver_name = trip.driverName;
            }
          } else {
            tripData.driver_name = trip.driverName;
          }
        }

        // Check if trip already exists
        const { data: existingTrip, error: checkError } = await supabase
          .from('trips')
          .select('id')
          .eq('trip_number', trip.loadRef)
          .maybeSingle();

        if (checkError) {
          console.error(`❌ Error checking trip ${trip.loadRef}:`, checkError);
          results.failed.push({
            loadRef: trip.loadRef,
            error: `Database check error: ${checkError.message}`
          });
          continue;
        }

        if (existingTrip) {
          // Update existing trip
          const { id, created_at, ...updateData } = tripData;
          const { error: updateError } = await supabase
            .from('trips')
            .update({
              ...updateData,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingTrip.id);

          if (updateError) {
            console.error(`❌ Error updating trip ${trip.loadRef}:`, updateError);
            results.failed.push({
              loadRef: trip.loadRef,
              error: `Update error: ${updateError.message}`
            });
          } else {
            console.log(`✅ Updated trip: ${trip.loadRef}`);
            results.updated.push(trip.loadRef);
            results.success.push(trip.loadRef);
          }
        } else {
          // Create new trip
          const { error: insertError } = await supabase
            .from('trips')
            .insert({
              ...tripData,
              created_at: new Date().toISOString()
            });

          if (insertError) {
            console.error(`❌ Error creating trip ${trip.loadRef}:`, insertError);
            results.failed.push({
              loadRef: trip.loadRef,
              error: `Insert error: ${insertError.message}`
            });
          } else {
            console.log(`✅ Created trip: ${trip.loadRef}`);
            results.created.push(trip.loadRef);
            results.success.push(trip.loadRef);
          }
        }
      } catch (tripError) {
        const errorMessage = tripError instanceof Error ? tripError.message : 'Unknown error';
        console.error(`❌ Error processing trip ${trip?.loadRef}:`, errorMessage);
        results.failed.push({
          loadRef: trip?.loadRef || 'unknown',
          error: errorMessage
        });
      }
    }

    const response = {
      status: results.failed.length > 0 ? 'partial_success' : 'success',
      message: `Processed ${trips.length} trip(s) — ${results.created.length} created, ${results.updated.length} updated, ${results.failed.length} failed`,
      results: {
        total: trips.length,
        successful: results.success.length,
        created: results.created.length,
        updated: results.updated.length,
        failed: results.failed.length
      },
      details: {
        success: results.success,
        failed: results.failed.map(f => ({
          loadRef: String(f.loadRef),
          error: String(f.error)
        }))
      },
      timestamp: new Date().toISOString()
    };

    console.log('📊 Sending response:', JSON.stringify(response, null, 2));

    return new Response(JSON.stringify(response), {
      status: results.failed.length > 0 ? 207 : 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Fatal error:', error);
    return new Response(JSON.stringify({
      status: 'error',
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});