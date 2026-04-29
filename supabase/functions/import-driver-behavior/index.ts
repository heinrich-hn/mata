// Supabase Edge Function for import-driver-behavior
// Accepts { records: [...] } from Google Apps Script (Sheet "2")
// Also accepts legacy { events: [...] } format for backward compatibility
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Allowed event types: raw device names AND human-readable → normalized form
const EVENT_TYPE_MAP: Record<string, string> = {
  // Raw device events
  'harsh_acceleration': 'Harsh Acceleration',
  'acceleration': 'Harsh Acceleration',
  'Acceleration': 'Harsh Acceleration',
  'seatbelt_violation_beep': 'Seatbelt Violation',
  'seatbelt_violation': 'Seatbelt Violation',
  'cell_phone_use_beep': 'Cell Phone Use',
  'cell_phone_use': 'Cell Phone Use',
  'fatigue_alert_beep': 'Fatigue Alert',
  'yawn_beep': 'Yawn Alert',
  'harsh_braking': 'Harsh Braking',
  'speedlimit': 'Speed Limit Violation',
  'Speed Limit': 'Speed Limit Violation',
  'lane_weaving': 'Lane Weaving',
  'distracted_driver_beep': 'Distracted Driving',
  'distracted_driving': 'Distracted Driving',
  'tailgating': 'Tailgating',
  'accident': 'Accident',
  'possible_accident': 'Possible Accident',
  'driver_unbelted_beep': 'Driver Unbelted',
  'driverUnbelted': 'Driver Unbelted',
  'passenger_unbelted': 'Passenger Unbelted',
  'passenger_unbelted_beep': 'Passenger Unbelted',
  'passenger_limit': 'Passenger Limit',
  'obstruction': 'Obstruction',
  'violent_left_turn': 'Violent Left Turn',
  'violent_turn': 'Violent Turn',
  // Human-readable pass-through (from enriched Sheet "2")
  'Harsh Acceleration': 'Harsh Acceleration',
  'Acceleration': 'Harsh Acceleration',
  'Seatbelt Violation': 'Seatbelt Violation',
  'Cell Phone Use': 'Cell Phone Use',
  'Fatigue Alert': 'Fatigue Alert',
  'Yawn Alert': 'Yawn Alert',
  'Harsh Braking': 'Harsh Braking',
  'Speed Limit Violation': 'Speed Limit Violation',
  'Lane Weaving': 'Lane Weaving',
  'Distracted Driving': 'Distracted Driving',
  'Tailgating': 'Tailgating',
  'Accident': 'Accident',
  'Possible Accident': 'Possible Accident',
  'Driver Unbelted': 'Driver Unbelted',
  'Passenger Unbelted': 'Passenger Unbelted',
  'Passenger Limit': 'Passenger Limit',
  'Obstruction': 'Obstruction',
  'Violent Left Turn': 'Violent Left Turn',
  'Violent Turn': 'Violent Turn',
  'Speed Limit': 'Speed Limit Violation',
};

// Default risk score (1-5) per canonical event type. Mirrors
// src/lib/driverBehaviorRiskScores.ts. Debriefer can override later.
const DEFAULT_RISK_SCORE: Record<string, number> = {
  'Accident': 5,
  'Possible Accident': 5,
  'Violent Left Turn': 4,
  'Violent Turn': 4,
  'Tailgating': 4,
  'Speed Limit Violation': 4,
  'Speeding': 4,
  'Distracted Driving': 4,
  'Cell Phone Use': 4,
  'Fatigue Alert': 4,
  'Near Miss': 4,
  'Traffic Violation': 4,
  'Harsh Braking': 3,
  'Harsh Acceleration': 3,
  'Sharp Cornering': 3,
  'Lane Weaving': 3,
  'Driver Unbelted': 3,
  'Seatbelt Violation': 3,
  'Obstruction': 3,
  'Yawn Alert': 3,
  'Passenger Unbelted': 2,
  'Passenger Limit': 2,
  'Customer Complaint': 2,
  'Other': 2,
};

// Default severity per canonical event type. Falls back to 'medium'.
const DEFAULT_SEVERITY: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
  'Accident': 'critical',
  'Possible Accident': 'critical',
  'Violent Left Turn': 'high',
  'Violent Turn': 'high',
  'Tailgating': 'high',
  'Speed Limit Violation': 'high',
  'Speeding': 'high',
  'Distracted Driving': 'high',
  'Cell Phone Use': 'high',
  'Fatigue Alert': 'high',
  'Near Miss': 'high',
  'Traffic Violation': 'high',
  'Harsh Braking': 'medium',
  'Harsh Acceleration': 'medium',
  'Sharp Cornering': 'medium',
  'Lane Weaving': 'medium',
  'Driver Unbelted': 'medium',
  'Seatbelt Violation': 'medium',
  'Obstruction': 'medium',
  'Yawn Alert': 'medium',
  'Passenger Unbelted': 'low',
  'Passenger Limit': 'low',
  'Customer Complaint': 'low',
  'Other': 'low',
};

/**
 * Parse DD/MM/YYYY or DD/MM/YYYY HH:mm:ss → { date: 'YYYY-MM-DD', time: 'HH:mm' | null }
 * Also handles YYYY-MM-DD and YYYY/MM/DD formats
 */
function parseDatetime(str: string): { date: string; time: string | null } {
  if (!str) return { date: '', time: null };
  const s = String(str).trim();

  // DD/MM/YYYY HH:mm:ss
  const dtMatch = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (dtMatch) {
    const day = dtMatch[1].padStart(2, '0');
    const month = dtMatch[2].padStart(2, '0');
    const year = dtMatch[3];
    const hours = dtMatch[4].padStart(2, '0');
    const minutes = dtMatch[5].padStart(2, '0');
    return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
  }

  // DD/MM/YYYY only
  const dMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dMatch) {
    const day = dMatch[1].padStart(2, '0');
    const month = dMatch[2].padStart(2, '0');
    const year = dMatch[3];
    return { date: `${year}-${month}-${day}`, time: null };
  }

  // YYYY-MM-DD or YYYY/MM/DD (with optional time)
  const isoMatch = s.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    const time = isoMatch[4] && isoMatch[5]
      ? `${isoMatch[4].padStart(2, '0')}:${isoMatch[5]}`
      : null;
    return { date: `${year}-${month}-${day}`, time };
  }

  return { date: '', time: null };
}

/** Convert "HH:mm" to total minutes for 5-minute cooldown comparison */
function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const match = String(timeStr).match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}

const handleTestRequest = () => {
  return new Response(
    JSON.stringify({
      success: true,
      message: "Connection test successful — import-driver-behavior is live",
      imported: 0,
      skipped: 0
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    return handleTestRequest();
  }

  try {
    console.log("Starting driver behavior import function");

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      throw new Error("Server configuration error");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let body;
    try {
      body = await req.json();
    } catch (_jsonError) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body', imported: 0, skipped: 0 }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Accept new format { records: [...] } or legacy { events: [...] }
    const records = body?.records || body?.events || [];
    if (!Array.isArray(records) || records.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No records provided or invalid format', imported: 0, skipped: 0 }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📥 Received ${records.length} driver behavior records`);

    let imported = 0;
    let skipped = 0;
    const processingDetails: Array<Record<string, unknown>> = [];

    for (const record of records) {
      try {
        // --- 1. Driver name is REQUIRED — skip if missing ---
        const driverName = (record['Driver'] || record.driver || record.driverName || '').trim();
        if (!driverName) {
          console.log('Skipping: no driver name');
          skipped++;
          processingDetails.push({
            vehicleId: record['Vehicle ID'] || record.vehicleId || record.fleetNumber || null,
            driver: null,
            status: 'skipped',
            reason: 'No driver name — event not posted'
          });
          continue;
        }

        // --- 2. Normalize & validate event type against allowed list ---
        const rawEventType = (record['Event Type'] || record.eventType || record.event_type || '').trim();
        const normalizedEventType = EVENT_TYPE_MAP[rawEventType];

        if (!normalizedEventType) {
          console.log(`Skipping: event type '${rawEventType}' not in allowed list`);
          skipped++;
          processingDetails.push({
            vehicleId: record['Vehicle ID'] || record.vehicleId || record.fleetNumber || null,
            driver: driverName,
            status: 'skipped',
            reason: `Event type '${rawEventType}' not allowed`
          });
          continue;
        }

        // --- 3. Parse date & time ---
        const eventTimeParsed = parseDatetime(record['Event Time'] || record.eventTime || '');
        const idParsed = parseDatetime(record['ID'] || record.id || record.eventDate || '');

        const eventDate = eventTimeParsed.date || idParsed.date;
        const eventTime = eventTimeParsed.time || null;

        if (!eventDate) {
          console.log('Skipping: no valid date');
          skipped++;
          processingDetails.push({
            vehicleId: record['Vehicle ID'] || record.vehicleId || record.fleetNumber || null,
            driver: driverName,
            status: 'skipped',
            reason: 'No valid date'
          });
          continue;
        }

        // --- 4. Dedup: driver_name + event_type + event_date with 5-min cooldown ---
        const { data: existing, error: queryError } = await supabase
          .from('driver_behavior_events')
          .select('id, event_time')
          .eq('driver_name', driverName)
          .eq('event_type', normalizedEventType)
          .eq('event_date', eventDate);

        if (queryError) {
          console.error("Dedup query error:", queryError);
          throw new Error(`Database query error: ${queryError.message}`);
        }

        if (existing && existing.length > 0) {
          if (eventTime) {
            const incomingMinutes = timeToMinutes(eventTime);
            const isDuplicate = existing.some((e: { event_time: string | null }) => {
              if (!e.event_time) return true;
              return Math.abs(incomingMinutes - timeToMinutes(e.event_time)) < 5;
            });
            if (isDuplicate) {
              console.log(`Duplicate (5-min): ${driverName} | ${normalizedEventType} | ${eventDate} ~${eventTime}`);
              skipped++;
              processingDetails.push({
                vehicleId: record['Vehicle ID'] || record.vehicleId || record.fleetNumber || null,
                driver: driverName,
                eventDate,
                status: 'skipped',
                reason: 'Duplicate (within 5-min window)'
              });
              continue;
            }
          } else {
            // No time — same day/type/driver = duplicate
            console.log(`Duplicate: ${driverName} | ${normalizedEventType} | ${eventDate}`);
            skipped++;
            processingDetails.push({
              vehicleId: record['Vehicle ID'] || record.vehicleId || record.fleetNumber || null,
              driver: driverName,
              eventDate,
              status: 'skipped',
              reason: 'Duplicate event (same day)'
            });
            continue;
          }
        }

        // --- 5. Build DB record ---
        const fleetNumber = (record['Vehicle ID'] || record.vehicleId || record.fleetNumber || '').trim() || null;
        const locationUrl = record['Location URL'] || record.locationUrl || record.location || null;
        // Only store location if it's an actual URL (filter out display text like "Video Link", "View on Map", etc.)
        const location = (locationUrl && /^https?:\/\//i.test(locationUrl)) ? locationUrl : null;
        const description = record.description
          || `${normalizedEventType} by ${driverName} on ${eventDate}`;

        const dbRecord: Record<string, unknown> = {
          driver_name: driverName,
          event_type: normalizedEventType,
          event_date: eventDate,
          description,
          severity: DEFAULT_SEVERITY[normalizedEventType] ?? 'medium',
          status: 'pending',
          points: DEFAULT_RISK_SCORE[normalizedEventType] ?? 3,
          risk_score: DEFAULT_RISK_SCORE[normalizedEventType] ?? 3,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (eventTime) dbRecord.event_time = eventTime;
        if (fleetNumber) dbRecord.fleet_number = fleetNumber;
        if (location) dbRecord.location = location;
        if (record.witnessName) dbRecord.witness_name = record.witnessName;
        if (record.witnessStatement) dbRecord.witness_statement = record.witnessStatement;
        if (record.correctiveActionTaken) dbRecord.corrective_action_taken = record.correctiveActionTaken;
        if (record.followUpRequired !== undefined) dbRecord.follow_up_required = record.followUpRequired;
        if (record.followUpDate) dbRecord.follow_up_date = record.followUpDate;

        // UUID-validate car_report_id if provided
        if (record.carReportId) {
          const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          if (uuidPattern.test(record.carReportId)) {
            dbRecord.car_report_id = record.carReportId;
          }
        }

        console.log(`Inserting: ${driverName} | ${normalizedEventType} | ${eventDate} ${eventTime || ''} | Fleet: ${fleetNumber || '-'}`);

        // --- 6. Insert ---
        const { error: insertError } = await supabase
          .from('driver_behavior_events')
          .insert(dbRecord);

        if (insertError) {
          console.error('Insert error:', insertError);
          skipped++;
          processingDetails.push({
            vehicleId: fleetNumber,
            driver: driverName,
            eventDate,
            status: 'error',
            reason: insertError.message || 'Database insert error'
          });
        } else {
          imported++;
          processingDetails.push({
            vehicleId: fleetNumber,
            driver: driverName,
            eventDate,
            eventType: normalizedEventType,
            status: 'imported'
          });
        }
      } catch (eventError) {
        console.error('Error processing record:', eventError);
        skipped++;
        processingDetails.push({
          driver: record.driver || record.driverName || 'unknown',
          status: 'error',
          reason: eventError instanceof Error ? eventError.message : 'Unknown error'
        });
      }
    }

    console.log(`✅ Import complete: ${imported} imported, ${skipped} skipped`);

    return new Response(
      JSON.stringify({ success: true, imported, skipped, processingDetails }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Critical error:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        imported: 0,
        skipped: 0
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});