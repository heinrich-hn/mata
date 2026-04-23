import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEMATICS_API_BASE = 'https://api-emea04.telematics.guru';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const TELEMATICS_SYSTEM_USER = Deno.env.get('TELEMATICS_SYSTEM_USER');
const TELEMATICS_SYSTEM_PASS = Deno.env.get('TELEMATICS_SYSTEM_PASS');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telematics-token',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Cache for system token
let systemToken: string | null = null;
let systemTokenExpiry: number | null = null;

// Valid actions enum
const ValidActions = {
  AUTHENTICATE: 'authenticate',
  GET_ORGANISATIONS: 'getOrganisations',
  GET_ASSETS: 'getAssets',
  GET_ASSET_DETAILS: 'getAssetDetails',
  GET_ASSET_BY_SHARE_TOKEN: 'getAssetByShareToken',
  GET_GEOFENCES: 'getGeofences',
  GET_GEOFENCE_DETAILS: 'getGeofenceDetails',
  GET_PORTAL_ASSETS: 'getPortalAssets',
  GEOFENCE_EVENT: 'geofenceEvent',
} as const;

async function getSystemToken(): Promise<string | null> {
  if (systemToken && systemTokenExpiry && Date.now() < systemTokenExpiry) {
    return systemToken;
  }

  if (!TELEMATICS_SYSTEM_USER || !TELEMATICS_SYSTEM_PASS) {
    console.error('System telematics credentials not configured');
    return null;
  }

  try {
    const formData = new URLSearchParams();
    formData.append('Username', TELEMATICS_SYSTEM_USER);
    formData.append('Password', TELEMATICS_SYSTEM_PASS);

    const response = await fetch(`${TELEMATICS_API_BASE}/v1/user/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    if (!response.ok) {
      console.error('System auth failed:', response.status);
      return null;
    }

    const data = await response.json();

    systemToken = data.access_token;
    systemTokenExpiry = Date.now() + ((data.expires_in || 3600) * 1000) - 60000;

    console.log('System token obtained, expires at:', new Date(systemTokenExpiry).toISOString());
    return systemToken;
  } catch (error) {
    console.error('System auth error:', error);
    return null;
  }
}

async function makeTelematicsRequest(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (response.status === 401 && token === systemToken) {
    console.log('System token expired, refreshing...');
    systemToken = null;
    systemTokenExpiry = null;
    const newToken = await getSystemToken();
    if (newToken) {
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${newToken}`,
          'Accept': 'application/json',
        },
      });
    }
  }

  return response;
}

function sendError(status: number, message: string, details?: any): Response {
  console.error(`Error ${status}: ${message}`, details);
  return new Response(
    JSON.stringify({
      error: message,
      details: details || undefined,
      timestamp: new Date().toISOString()
    }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

function sendSuccess(data: any, status: number = 200): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

// Enhanced geofence matching function
function isGeofenceMatch(geofenceName: string, locationName: string): boolean {
  if (!geofenceName || !locationName) return false;

  const normalizedGeofence = geofenceName.toLowerCase().trim();
  const normalizedLocation = locationName.toLowerCase().trim();

  // Exact match
  if (normalizedGeofence === normalizedLocation) return true;

  // Geofence contains location name
  if (normalizedGeofence.includes(normalizedLocation)) return true;

  // Location name contains geofence
  if (normalizedLocation.includes(normalizedGeofence)) return true;

  // Remove common prefixes/suffixes and compare
  const cleanGeofence = normalizedGeofence.replace(/^(geofence[-_\s]*)/i, '').replace(/[-_\s]*geofence$/i, '');
  const cleanLocation = normalizedLocation.replace(/^(origin|destination|loading|offloading)[-_\s]*/i, '');

  return cleanGeofence === cleanLocation || cleanGeofence.includes(cleanLocation) || cleanLocation.includes(cleanGeofence);
}

// Depot-specific arrival offset (in minutes). Mirrors the client-side
// `arrivalOffsetMinutes` in src/lib/depots.ts. Currently only BV uses this:
// arrival timestamps get +offset, departure timestamps get -offset, to account
// for the long internal road between the geofence boundary and the actual
// loading point.
const DEPOT_ARRIVAL_OFFSETS_MIN: Record<string, number> = {
  bv: 45,
};

function getDepotOffsetMinutes(geofenceName: string, locationName: string): number {
  const candidates = [geofenceName, locationName].map(s => (s || '').toLowerCase().trim());
  for (const [key, mins] of Object.entries(DEPOT_ARRIVAL_OFFSETS_MIN)) {
    if (candidates.some(c => c === key || c.includes(key))) return mins;
  }
  return 0;
}

function applyOffset(rawIso: string, offsetMin: number, isArrival: boolean): string {
  if (!offsetMin) return rawIso;
  const ms = new Date(rawIso).getTime() + (isArrival ? 1 : -1) * offsetMin * 60_000;
  return new Date(ms).toISOString();
}

// Handle geofence webhook events with enhanced logic
async function handleGeofenceEvent(body: any, supabase: any) {
  const eventType = body.eventType || body.action?.replace('geofenceEvent', '');
  const assetId = body.assetId || body.asset_id;
  const geofenceId = body.geofenceId || body.geofence_id;
  const timestamp = body.timestamp || new Date().toISOString();
  const eventData = body.data || body;

  console.log(`========================================`);
  console.log(`Geofence event received:`);
  console.log(`- Event Type: ${eventType}`);
  console.log(`- Asset ID: ${assetId}`);
  console.log(`- Geofence ID: ${geofenceId}`);
  console.log(`- Timestamp: ${timestamp}`);
  console.log(`========================================`);

  // Find the load associated with this asset.
  // Valid LoadStatus values (src/types/Trips.ts): 'pending' | 'scheduled' | 'in-transit' | 'delivered'
  const { data: loadData, error: loadError } = await supabase
    .from('loads')
    .select(`
      *,
      fleet_vehicle:fleet_vehicles!inner(*)
    `)
    .eq('fleet_vehicle.telematics_asset_id', assetId?.toString())
    .in('status', ['pending', 'scheduled', 'in-transit'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (loadError) {
    console.error('Error finding load:', loadError);
    return sendError(500, 'Database error while finding load', loadError.message);
  }

  if (!loadData) {
    console.log(`No active load found for asset ${assetId}`);
    return sendSuccess({ message: 'No active load found', event: eventType });
  }

  console.log(`Found load: ${loadData.load_id}`);
  console.log(`- Current status: ${loadData.status}`);
  console.log(`- Origin: ${loadData.origin}`);
  console.log(`- Destination: ${loadData.destination}`);

  // Get geofence details from Telematics Guru (for the geofence name)
  const sysToken = await getSystemToken();
  let geofenceName = `Geofence-${geofenceId}`;
  let geofenceDetails: any = null;

  if (sysToken && geofenceId) {
    try {
      const geofenceResponse = await makeTelematicsRequest(
        `${TELEMATICS_API_BASE}/v1/geofence/${geofenceId}`,
        sysToken
      );

      if (geofenceResponse.ok) {
        geofenceDetails = await geofenceResponse.json();
        geofenceName = geofenceDetails.Name || geofenceDetails.name || geofenceName;
        console.log(`Geofence details retrieved: ${geofenceName}`);
      } else {
        console.error(`Failed to fetch geofence details: ${geofenceResponse.status}`);
      }
    } catch (e) {
      console.error('Error fetching geofence details:', e);
    }
  }

  const eventTypeLower = (eventType || '').toLowerCase();
  const isEntry = eventTypeLower.includes('entry');
  const isExit = eventTypeLower.includes('exit');
  const normalizedEventType = isEntry ? 'entry' : (isExit ? 'exit' : eventTypeLower);

  const matchesOrigin = isGeofenceMatch(geofenceName, loadData.origin || '');
  const matchesDestination = isGeofenceMatch(geofenceName, loadData.destination || '');

  // Apply BV-style arrival offset: +N min on entry (arrival), -N min on exit (departure).
  // Mirrors useTrips.ts:362-378 which reads `arrivalOffsetMinutes` from depots.ts.
  const offsetMin = getDepotOffsetMinutes(geofenceName, matchesOrigin ? loadData.origin : (matchesDestination ? loadData.destination : ''));
  const adjustedIso = (matchesOrigin || matchesDestination)
    ? applyOffset(timestamp, offsetMin, isEntry)
    : timestamp;

  if (offsetMin) {
    console.log(`Depot offset applied: ${isEntry ? '+' : '-'}${offsetMin}min  raw=${timestamp}  adjusted=${adjustedIso}`);
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  let statusUpdated = false;
  let updateReason = '';
  let newStatus: string | null = null;

  // ---- ORIGIN ----
  if (matchesOrigin && isEntry) {
    if (!loadData.actual_loading_arrival) {
      updates.actual_loading_arrival = adjustedIso;
      updates.actual_loading_arrival_verified = true;
      updates.actual_loading_arrival_source = 'auto';
    }
    if (loadData.status === 'pending') {
      updates.status = 'scheduled';
      newStatus = 'scheduled';
    }
    updateReason = `Arrived at origin geofence: ${geofenceName}`;
  } else if (matchesOrigin && isExit) {
    if (!loadData.actual_loading_departure) {
      updates.actual_loading_departure = adjustedIso;
      updates.actual_loading_departure_verified = true;
      updates.actual_loading_departure_source = 'auto';
    }
    if (loadData.status === 'scheduled' || loadData.status === 'pending') {
      updates.status = 'in-transit';
      newStatus = 'in-transit';
    }
    updateReason = `Departed from origin geofence: ${geofenceName}`;
  }

  // ---- DESTINATION ----
  if (matchesDestination && isEntry) {
    if (!loadData.actual_offloading_arrival) {
      updates.actual_offloading_arrival = adjustedIso;
      updates.actual_offloading_arrival_verified = true;
      updates.actual_offloading_arrival_source = 'auto';
    }
    // Polling path does NOT change status on destination arrival; keep parity.
    updateReason = `Arrived at destination geofence: ${geofenceName}`;
  } else if (matchesDestination && isExit) {
    if (!loadData.actual_offloading_departure) {
      updates.actual_offloading_departure = adjustedIso;
      updates.actual_offloading_departure_verified = true;
      updates.actual_offloading_departure_source = 'auto';
    }
    if (loadData.status === 'in-transit') {
      updates.status = 'delivered';
      newStatus = 'delivered';
    }
    updateReason = `Departed from destination geofence: ${geofenceName}`;
  }

  // Only run UPDATE if there is something to write besides updated_at
  const hasMeaningfulUpdate = Object.keys(updates).some(k => k !== 'updated_at');
  if (hasMeaningfulUpdate) {
    const { error: updateError } = await supabase
      .from('loads')
      .update(updates)
      .eq('id', loadData.id);

    if (updateError) {
      console.error('Failed to update load:', updateError);
    } else {
      statusUpdated = !!newStatus;
      console.log(`✅ Load ${loadData.load_id} updated. status=${newStatus ?? loadData.status}, fields=${Object.keys(updates).join(',')}`);
    }
  } else {
    console.log(`No matching origin/destination for geofence "${geofenceName}" — no load fields updated.`);
  }

  // Record the geofence event in database for history.
  // Column names must match src/lib/telematicsGuru.ts getGeofenceEvents().
  const { error: insertError } = await supabase
    .from('geofence_events')
    .insert({
      load_id: loadData.id,
      load_number: loadData.load_id,
      vehicle_registration: loadData.fleet_vehicle?.vehicle_id ?? null,
      telematics_asset_id: assetId?.toString() ?? null,
      event_type: normalizedEventType,
      geofence_name: geofenceName,
      latitude: eventData?.latitude ?? eventData?.Latitude ?? null,
      longitude: eventData?.longitude ?? eventData?.Longitude ?? null,
      event_time: timestamp,
      source: 'telematics-webhook',
    });

  if (insertError) {
    console.error('Failed to record geofence event:', insertError);
  } else {
    console.log(`Geofence event recorded in database`);
  }

  console.log(`========================================`);
  console.log(`Geofence event processing complete`);
  console.log(`Status updated: ${statusUpdated}`);
  if (statusUpdated) console.log(`Reason: ${updateReason}`);
  console.log(`========================================`);

  return sendSuccess({
    success: true,
    message: `Processed ${eventType} event for load ${loadData.load_id}`,
    status_updated: statusUpdated,
    update_reason: updateReason,
    current_status: newStatus ?? loadData.status,
    fields_written: Object.keys(updates).filter(k => k !== 'updated_at'),
    offset_applied_min: offsetMin || 0,
  });
}

// Handle portal assets fetch
async function handleGetPortalAssets(body: any, token?: string) {
  const authToken = token || await getSystemToken();

  if (!authToken) {
    return sendError(401, 'Authentication required. Please provide a valid token or check system credentials.');
  }

  if (body.organisationId) {
    const assetsResponse = await makeTelematicsRequest(
      `${TELEMATICS_API_BASE}/v1/organisation/${body.organisationId}/asset`,
      authToken
    );

    if (!assetsResponse.ok) {
      return sendError(assetsResponse.status, 'Failed to fetch assets from Telematics Guru');
    }

    const assets = await assetsResponse.json();
    return sendSuccess(assets);
  }

  const orgsResponse = await makeTelematicsRequest(
    `${TELEMATICS_API_BASE}/v1/user/organisation`,
    authToken
  );

  if (!orgsResponse.ok) {
    return sendError(orgsResponse.status, 'Failed to fetch organisations');
  }

  const organisations = await orgsResponse.json();

  if (!organisations || (Array.isArray(organisations) && organisations.length === 0)) {
    return sendError(404, 'No organisations found for this user');
  }

  const firstOrg = Array.isArray(organisations) ? organisations[0] : organisations;
  const orgId = firstOrg?.Id || firstOrg?.id;

  if (!orgId) {
    return sendError(400, 'Unable to determine organisation ID from response');
  }

  const assetsResponse = await makeTelematicsRequest(
    `${TELEMATICS_API_BASE}/v1/organisation/${orgId}/asset`,
    authToken
  );

  if (!assetsResponse.ok) {
    return sendError(assetsResponse.status, 'Failed to fetch assets');
  }

  const assets = await assetsResponse.json();

  return sendSuccess({
    assets,
    organisation: {
      id: orgId,
      name: firstOrg?.Name || firstOrg?.name
    },
    timestamp: new Date().toISOString()
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return sendError(405, 'Method not allowed. Only POST requests are accepted.');
  }

  try {
    let body;
    try {
      const bodyText = await req.text();
      console.log('Raw request received:', bodyText.substring(0, 200));

      if (!bodyText || bodyText.trim() === '') {
        return sendError(400, 'Request body is empty', {
          expected_format: {
            action: 'one of: authenticate, getOrganisations, getAssets, getAssetDetails, getAssetByShareToken, getGeofences, getGeofenceDetails, getPortalAssets, geofenceEvent'
          }
        });
      }

      body = JSON.parse(bodyText);
      console.log('Parsed body action:', body.action);
    } catch (e) {
      return sendError(400, 'Invalid JSON in request body', e.message);
    }

    if (!body.action) {
      return sendError(400, 'Missing required field: action', {
        received_fields: Object.keys(body),
        valid_actions: Object.values(ValidActions)
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    switch (body.action) {
      case ValidActions.GEOFENCE_EVENT:
        return await handleGeofenceEvent(body, supabase);

      case ValidActions.AUTHENTICATE:
        if (!body.username || !body.password) {
          return sendError(400, 'Username and password are required');
        }

        const formData = new URLSearchParams();
        formData.append('Username', body.username);
        formData.append('Password', body.password);

        const authResponse = await fetch(`${TELEMATICS_API_BASE}/v1/user/authenticate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        });

        if (!authResponse.ok) {
          return sendError(authResponse.status, 'Authentication failed');
        }

        const authData = await authResponse.json();
        return sendSuccess(authData);

      case ValidActions.GET_ORGANISATIONS:
        const token = body.token || await getSystemToken();
        if (!token) {
          return sendError(401, 'Authentication required. Please provide a valid token.');
        }

        const orgsResponse = await makeTelematicsRequest(
          `${TELEMATICS_API_BASE}/v1/user/organisation`,
          token
        );

        if (!orgsResponse.ok) {
          return sendError(orgsResponse.status, 'Failed to fetch organisations');
        }

        const orgsData = await orgsResponse.json();
        return sendSuccess(orgsData);

      case ValidActions.GET_ASSETS:
        const assetsToken = body.token || await getSystemToken();
        if (!assetsToken) {
          return sendError(401, 'Authentication required. Please provide a valid token.');
        }

        if (!body.organisationId) {
          return sendError(400, 'organisationId is required to fetch assets');
        }

        const assetsResponse = await makeTelematicsRequest(
          `${TELEMATICS_API_BASE}/v1/organisation/${body.organisationId}/asset`,
          assetsToken
        );

        if (!assetsResponse.ok) {
          return sendError(assetsResponse.status, 'Failed to fetch assets');
        }

        const assetsData = await assetsResponse.json();
        return sendSuccess(assetsData);

      case ValidActions.GET_ASSET_DETAILS:
        const detailsToken = body.token || await getSystemToken();
        if (!detailsToken) {
          return sendError(401, 'Authentication required. Please provide a valid token.');
        }

        if (!body.assetId) {
          return sendError(400, 'assetId is required');
        }

        const assetResponse = await makeTelematicsRequest(
          `${TELEMATICS_API_BASE}/v1/asset/${body.assetId}`,
          detailsToken
        );

        if (!assetResponse.ok) {
          return sendError(assetResponse.status, 'Failed to fetch asset details');
        }

        const assetData = await assetResponse.json();
        return sendSuccess(assetData);

      case ValidActions.GET_ASSET_BY_SHARE_TOKEN:
        if (!body.shareToken) {
          return sendError(400, 'shareToken is required');
        }

        const { data: shareLink, error: linkError } = await supabase
          .from('tracking_share_links')
          .select(`
            *,
            load:loads(
              load_id,
              origin,
              destination,
              loading_date,
              offloading_date,
              cargo_type,
              status,
              driver:drivers!loads_driver_id_fkey(name, contact),
              fleet_vehicle:fleet_vehicles(vehicle_id, type, telematics_asset_id)
            )
          `)
          .eq('token', body.shareToken)
          .gt('expires_at', new Date().toISOString())
          .single();

        if (linkError || !shareLink) {
          return sendError(403, 'Invalid or expired share token');
        }

        const assetIdToFetch = body.assetId
          ? String(body.assetId)
          : (shareLink.load?.fleet_vehicle?.telematics_asset_id || shareLink.telematics_asset_id);

        if (!assetIdToFetch) {
          return sendError(400, 'No telematics asset ID available');
        }

        const assetIdNum = parseInt(assetIdToFetch);
        if (isNaN(assetIdNum)) {
          return sendError(400, 'Invalid asset ID format');
        }

        const sysToken = await getSystemToken();
        if (!sysToken) {
          return sendError(503, 'Tracking service temporarily unavailable');
        }

        const positionResponse = await makeTelematicsRequest(
          `${TELEMATICS_API_BASE}/v1/asset/${assetIdNum}`,
          sysToken
        );

        if (!positionResponse.ok) {
          return sendError(positionResponse.status, 'Failed to fetch vehicle position');
        }

        const rawData = await positionResponse.json();
        const assetPosition = rawData.Assets?.[0] || rawData;

        const normalizedAsset = {
          id: assetPosition.Id ?? assetPosition.id ?? assetIdNum,
          name: assetPosition.Name || assetPosition.name || shareLink.load?.fleet_vehicle?.vehicle_id || 'Vehicle',
          code: assetPosition.Code || assetPosition.code || `ASSET-${assetIdNum}`,
          lastLatitude: assetPosition.LastLatitude ?? assetPosition.lastLatitude ?? null,
          lastLongitude: assetPosition.LastLongitude ?? assetPosition.lastLongitude ?? null,
          heading: assetPosition.Heading ?? assetPosition.heading ?? 0,
          speedKmH: assetPosition.SpeedKmH ?? assetPosition.speedKmH ?? 0,
          inTrip: assetPosition.InTrip ?? assetPosition.inTrip ?? false,
          isEnabled: assetPosition.IsEnabled ?? assetPosition.isEnabled ?? true,
          lastConnectedUtc: assetPosition.LastConnectedUtc || assetPosition.lastConnectedUtc || new Date().toISOString(),
        };

        return sendSuccess(normalizedAsset);

      case ValidActions.GET_GEOFENCES:
        const geofenceToken = body.token || await getSystemToken();
        if (!geofenceToken) {
          return sendError(401, 'Authentication required. Please provide a valid token.');
        }

        if (!body.organisationId) {
          return sendError(400, 'organisationId is required');
        }

        const geofencesResponse = await makeTelematicsRequest(
          `${TELEMATICS_API_BASE}/v1/organisation/${body.organisationId}/geofence`,
          geofenceToken
        );

        if (geofencesResponse.status === 404) {
          return sendSuccess([]);
        }

        if (!geofencesResponse.ok) {
          return sendError(geofencesResponse.status, 'Failed to fetch geofences');
        }

        const geofencesData = await geofencesResponse.json();
        return sendSuccess(geofencesData);

      case ValidActions.GET_GEOFENCE_DETAILS:
        const geofenceDetailsToken = body.token || await getSystemToken();
        if (!geofenceDetailsToken) {
          return sendError(401, 'Authentication required. Please provide a valid token.');
        }

        if (!body.geofenceId) {
          return sendError(400, 'geofenceId is required');
        }

        const geofenceDetailsResponse = await makeTelematicsRequest(
          `${TELEMATICS_API_BASE}/v1/geofence/${body.geofenceId}`,
          geofenceDetailsToken
        );

        if (!geofenceDetailsResponse.ok) {
          return sendError(geofenceDetailsResponse.status, 'Failed to fetch geofence details');
        }

        const geofenceDetailsData = await geofenceDetailsResponse.json();
        return sendSuccess(geofenceDetailsData);

      case ValidActions.GET_PORTAL_ASSETS:
        const portalToken = body.token || await getSystemToken();
        return await handleGetPortalAssets(body, portalToken);

      default:
        return sendError(400, `Invalid action: "${body.action}"`, {
          valid_actions: Object.values(ValidActions),
          received_action: body.action
        });
    }

  } catch (error) {
    console.error('Unhandled proxy error:', error);
    return sendError(500, 'Internal server error', error.message);
  }
});