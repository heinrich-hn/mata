import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IncomingEvent {
  fleetNumber: string;
  driverName: string;
  eventType: string;
  eventDate: string;
  eventTime: string;
  description: string;
  location: string;
  severity: string;
  status: string;
  points: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { events } = await req.json();

    if (!Array.isArray(events) || events.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No events provided or invalid format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📥 Received ${events.length} driver behavior events`);

    let imported = 0;
    let skipped = 0;
    const processingDetails: any[] = [];

    for (const event of events as IncomingEvent[]) {
      try {
        // Validate required fields
        if (!event.fleetNumber || !event.eventType || !event.eventDate) {
          skipped++;
          processingDetails.push({
            fleetNumber: event.fleetNumber,
            status: 'skipped',
            reason: 'Missing required fields'
          });
          continue;
        }

        // Check if event already exists
        const { data: existing } = await supabase
          .from('driver_behavior_events')
          .select('id')
          .eq('fleet_number', event.fleetNumber)
          .eq('event_date', event.eventDate)
          .eq('event_time', event.eventTime)
          .eq('event_type', event.eventType)
          .maybeSingle();

        if (existing) {
          skipped++;
          processingDetails.push({
            fleetNumber: event.fleetNumber,
            eventDate: event.eventDate,
            status: 'skipped',
            reason: 'Event already exists'
          });
          continue;
        }

        // Insert new event
        const { error: insertError } = await supabase
          .from('driver_behavior_events')
          .insert({
            fleet_number: event.fleetNumber,
            driver_name: event.driverName,
            event_type: event.eventType,
            event_date: event.eventDate,
            event_time: event.eventTime,
            description: event.description,
            location: event.location,
            severity: event.severity || 'medium',
            status: event.status || 'open',
            points: event.points || 0
          });

        if (insertError) {
          console.error(`Error inserting event:`, insertError);
          skipped++;
          processingDetails.push({
            fleetNumber: event.fleetNumber,
            eventDate: event.eventDate,
            status: 'error',
            reason: insertError.message
          });
        } else {
          imported++;
          processingDetails.push({
            fleetNumber: event.fleetNumber,
            eventDate: event.eventDate,
            status: 'imported'
          });
        }
      } catch (eventError) {
        console.error(`Error processing event:`, eventError);
        skipped++;
        processingDetails.push({
          fleetNumber: event.fleetNumber,
          status: 'error',
          reason: eventError instanceof Error ? eventError.message : 'Unknown error'
        });
      }
    }

    console.log(`✅ Import complete: ${imported} imported, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        skipped,
        processingDetails
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Critical error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
