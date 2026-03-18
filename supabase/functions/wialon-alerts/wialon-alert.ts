import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_KEY')!);

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const payload = await req.json();
  console.log('Wialon alert:', payload);

  // Parse: { unit_id, zone_id, time, type: 'enter'/'exit' }
  const { unit_id, zone_id, time, type } = payload;

  // Find load by vehicle
  const { data: load } = await supabase
    .from('loads')
    .select('id')
    .eq('assigned_vehicle_id', unit_id) // Assume vehicle ID matches
    .eq('status', 'in_transit')
    .single();

  if (load) {
    // Update event
    await supabase.from('delivery_events').insert({
      load_id: load.id,
      event_type: type === 'enter' ? 'arrived_destination' : 'departed_origin',
      event_timestamp: new Date(time * 1000).toISOString(),
      location_name: `Zone ${zone_id}`,
      description: `${type.toUpperCase()} geofence`
    });

    // Update status
    await supabase.from('loads').update({
      status: type === 'enter' ? 'arrived_at_delivery' : 'in_transit'
    }).eq('id', load.id);
  }

  return new Response('OK');
});
