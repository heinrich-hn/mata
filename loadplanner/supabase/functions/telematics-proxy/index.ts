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

type ValidAction = typeof ValidActions[keyof typeof ValidActions];

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

// Helper function to send standardized error responses
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

// Helper function to send success responses
function sendSuccess(data: any, status: number = 200): Response {
  return new Response(
    JSON.stringify(data),
    { 
      status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

// Handle geofence webhook events
async function handleGeofenceEvent(body: any, supabase: any) {
  const eventType = body.eventType || body.action?.replace('geofenceEvent', '');
  const assetId = body.assetId || body.asset_id;
  const geofenceId = body.geofenceId || body.geofence_id;
  const timestamp = body.timestamp || new Date().toISOString();
  const eventData = body.data || body;
  
  console.log(`Geofence event received: ${eventType} for asset ${assetId} at geofence ${geofenceId}`);
  
  // Find the load associated with this asset
  const { data: loadData, error: loadError } = await supabase
    .from('loads')
    .select(`
      *,
      fleet_vehicle:fleet_vehicles!inner(*)
    `)
    .eq('fleet_vehicle.telematics_asset_id', assetId?.toString())
    .in('status', ['in-transit', 'scheduled', 'pending', 'loading', 'offloading'])
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

  // Get geofence details from Telematics Guru
  const sysToken = await getSystemToken();
  let geofenceName = `Geofence-${geofenceId}`;
  
  if (sysToken && geofenceId) {
    try {
      const geofenceResponse = await makeTelematicsRequest(
        `${TELEMATICS_API_BASE}/v1/geofence/${geofenceId}`,
        sysToken
      );

      if (geofenceResponse.ok) {
        const geofenceData = await geofenceResponse.json();
        geofenceName = geofenceData.Name || geofenceData.name || geofenceName;
      }
    } catch (e) {
      console.error('Error fetching geofence details:', e);
    }
  }

  // Process the geofence event based on type
  const eventTypeLower = (eventType || '').toLowerCase();
  
  if (eventTypeLower.includes('entry')) {
    // Check if this is the origin geofence
    const originMatch = loadData.origin?.toLowerCase().includes(geofenceName.toLowerCase()) ||
                       geofenceName.toLowerCase().includes(loadData.origin?.toLowerCase() || '');
    
    if (originMatch) {
      // At origin - update load status to loading
      await supabase
        .from('loads')
        .update({ 
          status: 'loading',
          updated_at: new Date().toISOString()
        })
        .eq('id', loadData.id);
      
      console.log(`Load ${loadData.load_id} arrived at origin: ${geofenceName}`);
    }
    
    // Check if this is the destination geofence
    const destMatch = loadData.destination?.toLowerCase().includes(geofenceName.toLowerCase()) ||
                     geofenceName.toLowerCase().includes(loadData.destination?.toLowerCase() || '');
    
    if (destMatch) {
      // At destination - update load status to offloading
      await supabase
        .from('loads')
        .update({ 
          status: 'offloading',
          updated_at: new Date().toISOString()
        })
        .eq('id', loadData.id);
      
      console.log(`Load ${loadData.load_id} arrived at destination: ${geofenceName}`);
    }
  } else if (eventTypeLower.includes('exit')) {
    // Special handling for BV as origin - exit after loading means in-transit
    if (geofenceName.includes('BV') && loadData.origin?.includes('BV') && loadData.status === 'loading') {
      await supabase
        .from('loads')
        .update({ 
          status: 'in-transit',
          updated_at: new Date().toISOString()
        })
        .eq('id', loadData.id);
      
      console.log(`Load ${loadData.load_id} departed from BV origin, now in-transit`);
    }
  }

  // Record the geofence event in database for history
  await supabase
    .from('geofence_events')
    .insert({
      load_id: loadData.id,
      asset_id: assetId,
      geofence_id: geofenceId,
      geofence_name: geofenceName,
      event_type: eventTypeLower.includes('entry') ? 'entry' : 'exit',
      timestamp: timestamp,
      metadata: eventData || {}
    });

  return sendSuccess({ 
    success: true, 
    message: `Processed ${eventType} event for load ${loadData.load_id}` 
  });
}

// Handle portal assets fetch
async function handleGetPortalAssets(body: any, token?: string) {
  const authToken = token || await getSystemToken();
  
  if (!authToken) {
    return sendError(401, 'Authentication required. Please provide a valid token or check system credentials.');
  }

  // If organisationId is provided, use it directly
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

  // Otherwise, get organisations first
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

  // Get the first organisation ID
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
  
  // Return assets with metadata
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return sendError(405, 'Method not allowed. Only POST requests are accepted.');
  }

  try {
    // Parse request body
    let body;
    try {
      const bodyText = await req.text();
      console.log('Raw request received:', bodyText.substring(0, 200)); // Log first 200 chars for debugging
      
      if (!bodyText || bodyText.trim() === '') {
        return sendError(400, 'Request body is empty', { 
          expected_format: {
            action: 'one of: authenticate, getOrganisations, getAssets, getAssetDetails, getAssetByShareToken, getGeofences, getGeofenceDetails, getPortalAssets',
            ...(req.headers.get('content-type')?.includes('application/json') ? {} : { note: 'Content-Type should be application/json' })
          }
        });
      }
      
      body = JSON.parse(bodyText);
      console.log('Parsed body action:', body.action);
    } catch (e) {
      return sendError(400, 'Invalid JSON in request body', e.message);
    }

    // Validate action field
    if (!body.action) {
      return sendError(400, 'Missing required field: action', {
        received_fields: Object.keys(body),
        valid_actions: Object.values(ValidActions)
      });
    }

    // Create Supabase client for database operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Route to appropriate handler based on action
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