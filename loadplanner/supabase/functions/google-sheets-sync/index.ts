import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const DEST_URL = Deno.env.get('DEST_SUPABASE_URL') || 'https://wxvhkljrbcpcgpgdqhsp.supabase.co';
const DEST_ANON_KEY = Deno.env.get('DEST_SUPABASE_ANON_KEY') ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4dmhrbGpyYmNwY2dwZ2RxaHNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2MjYzMTEsImV4cCI6MjA3NDIwMjMxMX0.8VTE9TMQYAu2kMLpHX8EzBlCspBWddNW-FYOnDZSkHU';
const RECEIVER_URL = `${DEST_URL}/functions/v1/import-trips-from-webhook`;

const SPREADSHEET_ID = '1fE5ULTrA7LT624aUn2hGppUvJjKrepEjv4B4AcwWsCM';
const SHEET_NAME = 'Trips';
const SERVICE_ACCOUNT_EMAIL = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL') || '';
const SERVICE_ACCOUNT_KEY = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── Google Auth ───────────────────────────────────────────────────
function base64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getGoogleAccessToken(): Promise<string> {
  if (!SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_KEY) {
    throw new Error('Google credentials not configured');
  }

  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: SERVICE_ACCOUNT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  
  const h = base64url(enc.encode(JSON.stringify(header)));
  const p = base64url(enc.encode(JSON.stringify(payload)));
  const unsigned = `${h}.${p}`;

  const pemKey = SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n');
  const pemBody = pemKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, enc.encode(unsigned)),
  );
  const jwt = `${unsigned}.${base64url(sig)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  return (await res.json()).access_token;
}

// ── Sheets helpers ────────────────────────────────────────────────
async function ensureSheetExists(token: string): Promise<void> {
  const meta = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${token}` } },
  ).then((r) => r.json());
  
  if (meta.sheets?.some((s: any) => s.properties?.title === SHEET_NAME)) return;
  
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] }),
  });
}

async function clearSheet(token: string): Promise<void> {
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    },
  );
}

async function writeRows(token: string, rows: (string | number | null)[][]): Promise<void> {
  const range = `${SHEET_NAME}!A1`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ range, majorDimension: 'ROWS', values: rows }),
    },
  );
  if (!res.ok) throw new Error(`Sheets write failed: ${await res.text()}`);
}

async function applyFormatting(token: string, totalRows: number): Promise<void> {
  const meta = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } },
  ).then((r) => r.json());
  
  const sheet = meta.sheets?.find((s: any) => s.properties?.title === SHEET_NAME);
  if (!sheet) return;
  
  const sheetId = sheet.properties.sheetId;
  const colCount = HEADER_ROW.length;
  
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: colCount },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.16, green: 0.25, blue: 0.45 },
                textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 1, green: 1, blue: 1 } },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        },
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        },
        {
          autoResizeDimensions: {
            dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: colCount },
          },
        },
      ],
    }),
  });
}

// ── Helpers ───────────────────────────────────────────────────────
function fmtDate(val: string | null | undefined): string {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch { return val; }
}

function parseTW(tw: any): { origin: any; destination: any } {
  try {
    const d = typeof tw === 'string' ? JSON.parse(tw || '{}') : (tw ?? {});
    return { origin: d.origin || {}, destination: d.destination || {} };
  } catch {
    return { origin: {}, destination: {} };
  }
}

// ── Sheet columns ─────────────────────────────────────────────────
const HEADER_ROW = [
  'Load ID', 'Status', 'Vehicle', 'Driver',
  'Origin', 'Destination', 'Route', 'Cargo Type',
  'Loading Date', 'Offloading Date',
  'Planned Loading Arrival', 'Planned Loading Departure',
  'Planned Offloading Arrival', 'Planned Offloading Departure',
  'Notes', 'Last Synced',
];

function buildRow(load: any): (string | number | null)[] {
  const v = load.fleet_vehicles as any;
  const dr = load.drivers as any;
  const tw = parseTW(load.time_window);
  const o = load.origin || '';
  const d = load.destination || '';
  
  return [
    load.load_id || '',
    load.status || '',
    v?.vehicle_id || '',
    dr?.name || '',
    o,
    d,
    o && d ? `${o} - ${d}` : (o || d),
    load.cargo_type || '',
    fmtDate(load.loading_date),
    fmtDate(load.offloading_date),
    tw.origin.plannedArrival || '',
    tw.origin.plannedDeparture || '',
    tw.destination.plannedArrival || '',
    tw.destination.plannedDeparture || '',
    load.notes || '',
    fmtDate(new Date().toISOString()),
  ];
}

// ── Enhanced Lookup Functions ─────────────────────────────────────
async function getClientName(clientId: string): Promise<string | null> {
  if (!clientId) return null;
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: client } = await supabase
    .from('clients')
    .select('name')
    .eq('id', clientId)
    .maybeSingle();
  
  return client?.name || null;
}

async function getDriverName(driverId: string): Promise<string | null> {
  if (!driverId) return null;
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: driver } = await supabase
    .from('drivers')
    .select('name')
    .eq('id', driverId)
    .maybeSingle();
  
  return driver?.name || null;
}

// ── ENHANCED: Vehicle info with receiver name format ─────────────
async function getVehicleInfo(fleetVehicleId: string): Promise<{ 
  fleetNumber: string | null; 
  vehicleId: string | null;
  vehicleType: string | null;
  receiverVehicleName: string | null;
}> {
  if (!fleetVehicleId) return { 
    fleetNumber: null, 
    vehicleId: null, 
    vehicleType: null,
    receiverVehicleName: null 
  };
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  
  const { data: fleetVehicle } = await supabase
    .from('fleet_vehicles')
    .select('vehicle_id, type, make_model')
    .eq('id', fleetVehicleId)
    .maybeSingle();
  
  if (!fleetVehicle) return { 
    fleetNumber: null, 
    vehicleId: null, 
    vehicleType: null,
    receiverVehicleName: null 
  };
  
  const fleetNumber = fleetVehicle.vehicle_id;
  
  // Map fleet numbers to receiver's vehicle name format
  const receiverVehicleNames: Record<string, string> = {
    '4H': '4H',
    '6H': '6H',
    '14L': '14L - (ABA 3918)',
    '15L': '15L - (AAX 2987)',
    '21H': '21H - ADS 4865',
    '22H': '22H - AGZ 3812 (ADS 4866)',
    '23H': '23H - AFQ 1324 (Int Sim)',
    '24H': '24H - AFQ 1325 (Int Sim)',
    '26H': '26H - AFQ 1327 (Int Sim)',
    '28H': '28H - AFQ 1329 (Int Sim)',
    '29H': '29H - AGJ 3466',
    '30H': '30H - AGL 4216',
    '31H': '31H - AGZ 1963 (Int sim)',
    '32H': '32H - JF964 FS (Int sim)',
    '33H': '33H - JFK 963 FS (Int sim)',
    '34H': '34H - (MR86PVGP)',
    'UD': 'UD',
    'BVTR 25': 'BVTR 25 - DEMO TO BE RETURNED'
  };
  
  const receiverVehicleName = receiverVehicleNames[fleetNumber] || fleetNumber;
  
  console.log(`🔍 Vehicle mapping: ${fleetNumber} → Receiver name: "${receiverVehicleName}"`);
  
  return {
    fleetNumber: fleetNumber,
    vehicleId: fleetNumber,
    vehicleType: fleetVehicle.type,
    receiverVehicleName: receiverVehicleName
  };
}

// ── ENHANCED: Bepaal operasie tipe ───────────────────────────────
function determineOperation(load: any): 'upsert' | 'update_only' | 'create_only' {
  // As daar force flags is, gebruik dit
  if (load.force_create === true) {
    return 'create_only';
  }
  if (load.force_update === true) {
    return 'update_only';
  }

  // As die load nie 'n ID het nie, is dit definitely 'n create
  if (!load.id) {
    return 'create_only';
  }

  // Check hoe oud die load is
  if (load.created_at) {
    const createdTime = new Date(load.created_at).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    // Jonger as 5 minute - mag 'n nuwe wees (upsert)
    if (now - createdTime < fiveMinutes) {
      return 'upsert';
    }
  }

  // Default vir bestaande loads is update_only
  return 'update_only';
}

// ── ENHANCED: Post to receiver met operasie beheer ───────────────
async function postToReceiver(load: any): Promise<{ ok: boolean; created: boolean; updated: boolean; error: string }> {
  const clientName = load.client_id ? await getClientName(load.client_id) : null;
  const driverName = load.driver_id ? await getDriverName(load.driver_id) : null;
  const vehicleInfo = load.fleet_vehicle_id ? await getVehicleInfo(load.fleet_vehicle_id) : { 
    fleetNumber: null, 
    vehicleId: null,
    vehicleType: null,
    receiverVehicleName: null
  };

  // Bepaal operasie tipe
  const operation = determineOperation(load);

  let tripDurationHours: number | null = null;
  if (load.loading_date && load.offloading_date) {
    try {
      const diff = new Date(load.offloading_date).getTime() - new Date(load.loading_date).getTime();
      if (diff > 0) {
        tripDurationHours = Math.round((diff / 3600000) * 10) / 10;
      }
    } catch (e) {
      console.warn(`⚠️ Could not calculate duration for ${load.load_id}:`, e);
    }
  }

  // Payload met operasie instruksies
  const payload = {
    // Operasie beheer
    operation: operation,
    
    // Trip identifikasie - DIT BLY KONSTANT
    loadRef: load.load_id,
    
    // Trip data
    customer: clientName,
    origin: load.origin || null,
    destination: load.destination || null,
    shippedDate: load.loading_date || null,
    deliveredDate: load.offloading_date || null,
    shippedStatus: load.status,
    deliveredStatus: null,
    tripDurationHours: tripDurationHours,
    importSource: 'loads_sync',
    currency: 'USD',
    
    // Driver info
    driverName: driverName,
    driverId: load.driver_id,
    
    // Vehicle info - MULTIPLE FORMATS
    fleetNumber: vehicleInfo.fleetNumber,
    vehicleId: vehicleInfo.vehicleId,
    vehicleType: vehicleInfo.vehicleType,
    receiverVehicleName: vehicleInfo.receiverVehicleName,
    vehicleNamePrefix: vehicleInfo.fleetNumber,
    
    // Cargo and client info
    cargoType: load.cargo_type || null,
    notes: load.notes || null,
    clientId: load.client_id || null,
    
    // Metadata vir receiver om duplikate te voorkom
    metadata: {
      sender_id: load.id,
      sender_created_at: load.created_at,
      sender_updated_at: load.updated_at || load.created_at,
      sender_version: load.version || 1,
      sync_timestamp: new Date().toISOString()
    }
  };

  console.log(`📤 → Receiver for load: ${load.load_id} (Operation: ${operation})`);
  console.log(`   Fleet: ${vehicleInfo.fleetNumber} → Receiver name: "${vehicleInfo.receiverVehicleName}"`);
  console.log(`   Driver: ${driverName || 'None'}`);
  console.log(`   Client: ${clientName || 'None'}`);

  try {
    const res = await fetch(RECEIVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEST_ANON_KEY}`,
        'apikey': DEST_ANON_KEY,
        'x-source': 'loads_sync',
        'x-operation': operation,
      },
      body: JSON.stringify({ trips: [payload] }),
    });

    const responseText = await res.text();
    
    if (!res.ok) {
      console.error(`❌ Receiver error (${res.status}) for ${load.load_id}:`, responseText);
      return { 
        ok: false, 
        created: false, 
        updated: false, 
        error: `HTTP ${res.status}: ${responseText}`
      };
    }

    try {
      const data = JSON.parse(responseText);
      const created = data.results?.created > 0;
      const updated = data.results?.updated > 0;
      
      // Check of die operasie ooreenstem met wat verwag is
      if (operation === 'update_only' && created) {
        console.warn(`⚠️ Warning: Expected update but got create for ${load.load_id}`);
      } else if (operation === 'create_only' && updated) {
        console.warn(`⚠️ Warning: Expected create but got update for ${load.load_id}`);
      }
      
      console.log(`✅ Receiver success for ${load.load_id}: created=${created}, updated=${updated}`);
      return { ok: true, created, updated: updated || !created, error: '' };
    } catch {
      return { ok: true, created: false, updated: true, error: '' };
    }

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Receiver fetch error for ${load.load_id}:`, errorMsg);
    return { ok: false, created: false, updated: false, error: errorMsg };
  }
}

// ── Main handler ──────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_KEY) {
      return new Response(
        JSON.stringify({ error: 'Google Sheets credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let body;
    try {
      body = await req.json();
      console.log('📦 Request body:', JSON.stringify(body, null, 2));
    } catch {
      body = {};
    }

    let loadIds: string[] | null = null;
    
    if (body.id) {
      loadIds = [body.id];
    } else if (body.load_id) {
      loadIds = [body.load_id];
    } else if (body.loadIds && Array.isArray(body.loadIds)) {
      loadIds = body.loadIds;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    let query = supabase
      .from('loads')
      .select(`
        id, load_id, status, origin, destination, cargo_type,
        loading_date, offloading_date, time_window, notes, created_at, updated_at,
        client_id, fleet_vehicle_id, driver_id,
        fleet_vehicles!loads_fleet_vehicle_id_fkey ( vehicle_id, type ),
        drivers!loads_driver_id_fkey ( name, contact )
      `)
      .order('loading_date', { ascending: false });

    if (loadIds && loadIds.length > 0) {
      query = query.in('id', loadIds);
    }

    const { data: loads, error: loadError } = await query.limit(500);
    
    if (loadError) {
      console.error('❌ Database error:', loadError);
      throw loadError;
    }

    if (!loads || loads.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No loads found to sync', 
          rowsSynced: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`📊 Found ${loads.length} loads to process`);

    for (const load of loads as any[]) {
      if (!load.fleet_vehicles && load.fleet_vehicle_id) {
        const { data: v } = await supabase
          .from('fleet_vehicles')
          .select('vehicle_id, type')
          .eq('id', load.fleet_vehicle_id)
          .maybeSingle();
        load.fleet_vehicles = v || null;
      }
      
      if (!load.drivers && load.driver_id) {
        const { data: d } = await supabase
          .from('drivers')
          .select('name, contact')
          .eq('id', load.driver_id)
          .maybeSingle();
        load.drivers = d || null;
      }
    }

    console.log('📊 Syncing to Google Sheets...');
    const dataRows = (loads as any[]).map(buildRow);
    const allRows = [HEADER_ROW, ...dataRows];

    const token = await getGoogleAccessToken();
    await ensureSheetExists(token);
    await clearSheet(token);
    await writeRows(token, allRows);
    await applyFormatting(token, allRows.length);

    console.log(`✅ Synced ${dataRows.length} loads to Google Sheets`);

    console.log('📤 Posting to receiver webhook...');
    const receiverResults = {
      success: 0,
      failed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[]
    };

    for (const load of loads as any[]) {
      const result = await postToReceiver(load);
      if (result.ok) {
        receiverResults.success++;
        if (result.created) receiverResults.created++;
        if (result.updated) receiverResults.updated++;
      } else {
        receiverResults.failed++;
        receiverResults.errors.push(`${load.load_id}: ${result.error}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const response = {
      success: true,
      message: `Synced ${dataRows.length} loads to Google Sheets and posted to webhook`,
      sheets: {
        rowsSynced: dataRows.length,
        spreadsheetId: SPREADSHEET_ID,
        sheetName: SHEET_NAME,
      },
      webhook: {
        total: loads.length,
        success: receiverResults.success,
        failed: receiverResults.failed,
        created: receiverResults.created,
        updated: receiverResults.updated,
        skipped: receiverResults.skipped,
        errors: receiverResults.errors,
      },
      timestamp: new Date().toISOString()
    };

    console.log('📊 Final response:', JSON.stringify(response, null, 2));

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error) {
    console.error('❌ Fatal error:', error);
    
    const errorResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: (error as any)?.code,
      details: (error as any)?.details,
      hint: (error as any)?.hint,
      timestamp: new Date().toISOString()
    };

    return new Response(
      JSON.stringify(errorResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});