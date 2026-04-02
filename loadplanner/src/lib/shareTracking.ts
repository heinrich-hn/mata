import { supabase } from '@/integrations/supabase/client';

/**
 * Generate a unique token for shareable tracking links
 */
function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export interface CreateShareLinkParams {
  loadId: string;
  telematicsAssetId: string;
  expiryHours: number;
}

export interface ShareLinkResult {
  id: string;
  token: string;
  expiresAt: string;
  shareUrl: string;
}

export interface TrackingShareLink {
  id: string;
  token: string;
  load_id: string;
  telematics_asset_id: string;
  expires_at: string;
  created_at: string;
  created_by: string | null;
  view_count: number;
  last_viewed_at: string | null;
}

/**
 * Create a shareable tracking link for a load
 * Note: Uses type assertion because the tracking_share_links table 
 * is created via migration and types need to be regenerated
 */
export async function createShareableTrackingLink(
  params: CreateShareLinkParams
): Promise<ShareLinkResult> {
  const { loadId, telematicsAssetId, expiryHours } = params;

  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiryHours);

  // Use type assertion for the new table until types are regenerated
  const { data, error } = await (supabase as unknown as {
    from: (table: string) => {
      insert: (values: Record<string, unknown>) => {
        select: () => {
          single: () => Promise<{ data: TrackingShareLink | null; error: Error | null }>;
        };
      };
    };
  }).from('tracking_share_links')
    .insert({
      token,
      load_id: loadId,
      telematics_asset_id: telematicsAssetId,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create share link: ${error.message}`);
  }

  if (!data) {
    throw new Error('Failed to create share link: No data returned');
  }

  const shareUrl = `${window.location.origin}/track?token=${token}`;

  return {
    id: data.id,
    token: data.token,
    expiresAt: data.expires_at,
    shareUrl,
  };
}

/**
 * Get all active share links for a load
 */
export async function getShareLinksForLoad(loadId: string): Promise<TrackingShareLink[]> {
  const { data, error } = await (supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          gt: (column: string, value: string) => {
            order: (column: string, options: { ascending: boolean }) => Promise<{ data: TrackingShareLink[] | null; error: Error | null }>;
          };
        };
      };
    };
  }).from('tracking_share_links')
    .select('*')
    .eq('load_id', loadId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch share links: ${error.message}`);
  }

  return data || [];
}

/**
 * Delete a share link
 */
export async function deleteShareLink(linkId: string): Promise<void> {
  const { error } = await (supabase as unknown as {
    from: (table: string) => {
      delete: () => {
        eq: (column: string, value: string) => Promise<{ error: Error | null }>;
      };
    };
  }).from('tracking_share_links')
    .delete()
    .eq('id', linkId);

  if (error) {
    throw new Error(`Failed to delete share link: ${error.message}`);
  }
}

/**
 * Validate and get share link by token
 */
export async function getShareLinkByToken(token: string): Promise<TrackingShareLink | null> {
  const { data, error } = await (supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          gt: (column: string, value: string) => {
            single: () => Promise<{ data: TrackingShareLink | null; error: Error | null }>;
          };
        };
      };
    };
  }).from('tracking_share_links')
    .select('*')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Message format style options
 */
export type ShareMessageStyle = 'professional' | 'detailed' | 'compact' | 'minimal';

/**
 * Load information interface for sharing
 */
export interface ShareableLoadInfo {
  load_id: string;
  origin: string;
  destination: string;
  loading_date: string;
  offloading_date: string;
  cargo_type: string;
  status?: string;
  time_window?: unknown;
  driver?: { name: string; contact?: string } | null;
  fleet_vehicle?: { vehicle_id: string; type?: string } | null;
  client_name?: string;
}

/**
 * Vehicle information interface for sharing
 */
export interface ShareableVehicleInfo {
  name?: string;
  speedKmH?: number;
  inTrip?: boolean;
  latitude?: number;
  longitude?: number;
  lastConnected?: string;
}

/**
 * Generate a clean progress bar using Unicode block characters (business-appropriate visual)
 */
function generateProgressBar(percentage: number, length = 10): string {
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Get clean status label (no emojis or colors)
 */
function getStatusDisplay(status?: string, inTrip?: boolean): string {
  if (inTrip) {
    return 'IN TRANSIT';
  }

  switch (status?.toLowerCase()) {
    case 'delivered':
      return 'DELIVERED';
    case 'in-transit':
      return 'IN TRANSIT';
    case 'scheduled':
      return 'SCHEDULED';
    case 'pending':
      return 'PENDING';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Check if a date string is valid
 */
function isValidDate(dateStr: string | undefined | null): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Calculate progress percentage based on load dates and actual time window data.
 * Uses time-based interpolation between loading and offloading dates for
 * in-transit loads, and respects actual departure/arrival timestamps when available.
 */
function calculateProgress(
  status?: string,
  inTrip?: boolean,
  loadingDate?: string | null,
  offloadingDate?: string | null,
  timeWindow?: unknown,
): number | null {
  // Terminal / pre-start states
  if (status?.toLowerCase() === 'delivered') return 100;
  if (status?.toLowerCase() === 'pending') return 0;

  // Parse time_window for actual times
  let actualOriginDeparture: Date | null = null;
  let actualDestArrival: Date | null = null;
  try {
    const tw = typeof timeWindow === 'string' ? JSON.parse(timeWindow) : timeWindow;
    if (tw && typeof tw === 'object') {
      const origin = (tw as Record<string, unknown>).origin as Record<string, string> | undefined;
      const dest = (tw as Record<string, unknown>).destination as Record<string, string> | undefined;

      // If we have an actual departure from origin, use that as the real start
      if (origin?.actualDeparture && loadingDate && isValidDate(loadingDate)) {
        const depTime = origin.actualDeparture; // e.g. "08:30"
        if (/^\d{1,2}:\d{2}/.test(depTime)) {
          const d = new Date(loadingDate);
          const [h, m] = depTime.split(':').map(Number);
          d.setHours(h, m, 0, 0);
          actualOriginDeparture = d;
        }
      }

      // If we already have an actual arrival at destination → effectively delivered
      if (dest?.actualArrival && offloadingDate && isValidDate(offloadingDate)) {
        const arrTime = dest.actualArrival;
        if (/^\d{1,2}:\d{2}/.test(arrTime)) {
          actualDestArrival = new Date(offloadingDate);
          const [h, m] = arrTime.split(':').map(Number);
          actualDestArrival.setHours(h, m, 0, 0);
        }
      }
    }
  } catch { /* ignore parse errors */ }

  // If actual destination arrival recorded, treat as complete
  if (actualDestArrival && actualDestArrival.getTime() <= Date.now()) {
    return 100;
  }

  // For scheduled loads not yet in transit, show small fixed progress
  if (status?.toLowerCase() === 'scheduled' && !inTrip) {
    return 5;
  }

  // Time-based interpolation for in-transit / inTrip
  if ((status?.toLowerCase() === 'in-transit' || inTrip) && isValidDate(loadingDate) && isValidDate(offloadingDate)) {
    const now = Date.now();
    const start = actualOriginDeparture
      ? actualOriginDeparture.getTime()
      : new Date(loadingDate!).getTime();
    const end = new Date(offloadingDate!).getTime();

    // Guard: if start >= end the dates are invalid / same-day — fall back
    if (end <= start) return 50;

    const elapsed = now - start;
    const total = end - start;
    const pct = Math.round((elapsed / total) * 100);

    // Clamp between 5 and 99 (never show 0 or 100 while still in transit)
    return Math.max(5, Math.min(99, pct));
  }

  return null;
}

/**
 * Format date in a friendly way
 */
function formatFriendlyDate(dateStr: string | undefined | null): string | null {
  if (!isValidDate(dateStr)) return null;

  const date = new Date(dateStr!);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr!.trim());

  if (date.toDateString() === today.toDateString()) {
    if (isDateOnly) return 'Today';
    return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    if (isDateOnly) return 'Tomorrow';
    return `Tomorrow, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Build an ETA string from offloading_date + time_window's planned arrival
 */
function formatETA(offloadingDate: string, timeWindow?: unknown): string | null {
  let plannedArrival: string | undefined;
  try {
    const tw = typeof timeWindow === 'string' ? JSON.parse(timeWindow) : timeWindow;
    if (tw && typeof tw === 'object') {
      const dest = (tw as Record<string, unknown>).destination;
      if (dest && typeof dest === 'object') {
        const pa = (dest as Record<string, string>).plannedArrival;
        if (pa && /^\d{1,2}:\d{2}/.test(pa)) {
          plannedArrival = pa;
        }
      }
    }
  } catch { /* ignore parse errors */ }

  const friendlyDate = formatFriendlyDate(offloadingDate);
  if (!friendlyDate) return null;

  if (plannedArrival) {
    return `${friendlyDate}, ${plannedArrival}`;
  }
  return friendlyDate;
}

/**
 * Format share message for different platforms with full load details
 * All styles now use professional business-class formatting
 */
export function formatShareMessage(
  load: ShareableLoadInfo,
  vehicleInfo: ShareableVehicleInfo,
  shareUrl?: string,
  style: ShareMessageStyle = 'professional'
): string {
  switch (style) {
    case 'professional':
      return formatProfessionalMessage(load, vehicleInfo, shareUrl);
    case 'detailed':
      return formatDetailedMessage(load, vehicleInfo, shareUrl);
    case 'compact':
      return formatCompactMessage(load, vehicleInfo, shareUrl);
    case 'minimal':
      return formatMinimalMessage(load, vehicleInfo, shareUrl);
    default:
      return formatProfessionalMessage(load, vehicleInfo, shareUrl);
  }
}

/**
 * Professional format – clean corporate layout with aligned fields
 */
function formatProfessionalMessage(
  load: ShareableLoadInfo,
  vehicleInfo: ShareableVehicleInfo,
  shareUrl?: string
): string {
  const status = getStatusDisplay(load.status, vehicleInfo.inTrip);
  const progress = calculateProgress(load.status, vehicleInfo.inTrip, load.loading_date, load.offloading_date, load.time_window);
  const loadedDate = formatFriendlyDate(load.loading_date);
  const etaDate = formatETA(load.offloading_date, load.time_window);

  const lines = [
    'TRACKING UPDATE',
    '════════════════════════════════════',
    '',
    `Status      : ${status}`,
    '',
    'SHIPMENT DETAILS',
    '──────────────────────────────',
    `Load ID     : ${load.load_id}`,
    `Route       : ${load.origin} → ${load.destination}`,
    '',
  ];

  if (loadedDate) {
    lines.push(`Loading     : ${loadedDate}`);
  }
  if (etaDate) {
    lines.push(`ETA         : ${etaDate}`);
  }

  if (progress !== null) {
    lines.push('');
    lines.push(`Progress    : ${generateProgressBar(progress)} ${progress}%`);
  }

  lines.push('');

  if (load.cargo_type || load.client_name) {
    lines.push('CARGO INFORMATION');
    lines.push('──────────────────────────────');
    if (load.cargo_type) lines.push(`Cargo Type  : ${load.cargo_type}`);
    if (load.client_name) lines.push(`Client      : ${load.client_name}`);
    lines.push('');
  }

  if (load.fleet_vehicle?.vehicle_id || load.driver?.name) {
    lines.push('VEHICLE & DRIVER');
    lines.push('──────────────────────────────');
    if (load.fleet_vehicle?.vehicle_id) {
      const vehicleDesc = load.fleet_vehicle.type
        ? `${load.fleet_vehicle.vehicle_id} (${load.fleet_vehicle.type})`
        : load.fleet_vehicle.vehicle_id;
      lines.push(`Vehicle     : ${vehicleDesc}`);
    }
    if (load.driver?.name) {
      lines.push(`Driver      : ${load.driver.name}`);
      if (load.driver.contact) {
        lines.push(`Contact     : ${load.driver.contact}`);
      }
    }
    lines.push('');
  }

  if (vehicleInfo.speedKmH !== undefined || (vehicleInfo.latitude && vehicleInfo.longitude)) {
    lines.push('CURRENT POSITION');
    lines.push('──────────────────────────────');
    if (vehicleInfo.speedKmH !== undefined) {
      lines.push(`Speed       : ${vehicleInfo.speedKmH} km/h`);
    }
    if (vehicleInfo.latitude && vehicleInfo.longitude) {
      lines.push(`GPS         : ${vehicleInfo.latitude.toFixed(6)}, ${vehicleInfo.longitude.toFixed(6)}`);
      lines.push('');
      lines.push('View on Maps:');
      lines.push(`https://maps.google.com/?q=${vehicleInfo.latitude},${vehicleInfo.longitude}`);
    }
    lines.push('');
  }

  if (shareUrl) {
    lines.push('════════════════════════════════════');
    lines.push('LIVE TRACKING LINK');
    lines.push('');
    lines.push('Tap to track in real-time:');
    lines.push(shareUrl);
    lines.push('');
    lines.push('Live updates • No login required');
    lines.push('════════════════════════════════════');
  }

  lines.push('');
  lines.push('_Powered by LoadPlan™_');

  return lines.join('\n');
}

/**
 * Detailed format – comprehensive information for internal or partner use
 */
function formatDetailedMessage(
  load: ShareableLoadInfo,
  vehicleInfo: ShareableVehicleInfo,
  shareUrl?: string
): string {
  const status = getStatusDisplay(load.status, vehicleInfo.inTrip);
  const progress = calculateProgress(load.status, vehicleInfo.inTrip, load.loading_date, load.offloading_date, load.time_window);

  const lines = [
    'LIVE VEHICLE TRACKING',
    '════════════════════════════════════',
    '',
    `Status      : ${status}`,
    '',
    'SHIPMENT INFORMATION',
    '──────────────────────────────',
    `Load ID     : ${load.load_id}`,
    `Route       : ${load.origin} → ${load.destination}`,
  ];

  if (isValidDate(load.loading_date)) {
    lines.push(`Loading     : ${new Date(load.loading_date).toLocaleDateString('en-GB')}`);
  }
  if (isValidDate(load.offloading_date)) {
    const eta = formatETA(load.offloading_date, load.time_window);
    lines.push(`Expected Arrival : ${eta || new Date(load.offloading_date).toLocaleDateString('en-GB')}`);
  }
  if (load.cargo_type) {
    lines.push(`Cargo Type  : ${load.cargo_type}`);
  }
  if (progress !== null) {
    lines.push(`Progress    : ${progress}%`);
  }
  if (load.client_name) {
    lines.push(`Client      : ${load.client_name}`);
  }

  if (load.driver?.name) {
    lines.push('');
    lines.push('DRIVER INFORMATION');
    lines.push('──────────────────────────────');
    lines.push(`Name        : ${load.driver.name}`);
    if (load.driver.contact) {
      lines.push(`Contact     : ${load.driver.contact}`);
    }
  }

  if (load.fleet_vehicle?.vehicle_id) {
    lines.push('');
    lines.push('VEHICLE INFORMATION');
    lines.push('──────────────────────────────');
    lines.push(`Fleet No    : ${load.fleet_vehicle.vehicle_id}`);
    if (load.fleet_vehicle.type) {
      lines.push(`Type        : ${load.fleet_vehicle.type}`);
    }
  }

  if (vehicleInfo.speedKmH !== undefined) {
    lines.push('');
    lines.push('CURRENT STATUS');
    lines.push('──────────────────────────────');
    lines.push(`Speed       : ${vehicleInfo.speedKmH} km/h`);
    lines.push(`Movement    : ${vehicleInfo.inTrip ? 'In Motion' : 'Stationary'}`);
    if (vehicleInfo.lastConnected) {
      lines.push(`Last Update : ${vehicleInfo.lastConnected}`);
    }
  }

  if (vehicleInfo.latitude && vehicleInfo.longitude) {
    lines.push('');
    lines.push('CURRENT LOCATION');
    lines.push('──────────────────────────────');
    lines.push(`GPS         : ${vehicleInfo.latitude.toFixed(6)}, ${vehicleInfo.longitude.toFixed(6)}`);
    lines.push('');
    lines.push('View on Google Maps:');
    lines.push(`https://www.google.com/maps?q=${vehicleInfo.latitude},${vehicleInfo.longitude}`);
  }

  if (shareUrl) {
    lines.push('');
    lines.push('════════════════════════════════════');
    lines.push('LIVE TRACKING LINK');
    lines.push('──────────────────────────────');
    lines.push(shareUrl);
    lines.push('');
    lines.push('This link provides real-time vehicle tracking updates.');
    lines.push('════════════════════════════════════');
  }

  lines.push('');
  lines.push('_LoadPlan Fleet Management_');

  return lines.join('\n');
}

/**
 * Compact format – for quick shares and SMS
 */
function formatCompactMessage(
  load: ShareableLoadInfo,
  vehicleInfo: ShareableVehicleInfo,
  shareUrl?: string
): string {
  const status = getStatusDisplay(load.status, vehicleInfo.inTrip);
  const etaDate = formatETA(load.offloading_date, load.time_window);

  const lines = [
    `${status} • ${load.load_id}`,
    `${load.origin} → ${load.destination}`,
  ];

  if (etaDate) {
    lines.push(`ETA: ${etaDate}`);
  }

  if (load.driver?.name) {
    lines.push(`Driver: ${load.driver.name}${load.driver.contact ? ` | ${load.driver.contact}` : ''}`);
  }

  if (vehicleInfo.latitude && vehicleInfo.longitude) {
    lines.push(`Location: https://maps.google.com/?q=${vehicleInfo.latitude},${vehicleInfo.longitude}`);
  }

  if (shareUrl) {
    lines.push('');
    lines.push('Track Live:');
    lines.push(shareUrl);
  }

  return lines.join('\n');
}

/**
 * Minimal format – essentials only
 */
function formatMinimalMessage(
  load: ShareableLoadInfo,
  vehicleInfo: ShareableVehicleInfo,
  shareUrl?: string
): string {
  const lines = [
    `Load ${load.load_id}`,
    `${load.origin} → ${load.destination}`,
  ];

  if (isValidDate(load.offloading_date)) {
    const eta = formatETA(load.offloading_date, load.time_window);
    lines.push(`ETA: ${eta || new Date(load.offloading_date).toLocaleDateString('en-GB')}`);
  }

  if (load.driver?.name) {
    lines.push(`Driver: ${load.driver.name}`);
  }

  if (shareUrl) {
    lines.push(`Track: ${shareUrl}`);
  } else if (vehicleInfo.latitude && vehicleInfo.longitude) {
    lines.push(`Location: https://maps.google.com/?q=${vehicleInfo.latitude},${vehicleInfo.longitude}`);
  }

  return lines.join('\n');
}

/**
 * Generate a QR code placeholder message (QR codes can't be embedded in WhatsApp text)
 */
export function formatQRInstructionsMessage(
  load: ShareableLoadInfo,
  shareUrl: string
): string {
  return [
    'TRACKING INSTRUCTIONS',
    '════════════════════════════════════',
    '',
    `Load ID     : ${load.load_id}`,
    `Route       : ${load.origin} → ${load.destination}`,
    '',
    'LIVE TRACKING LINK',
    '──────────────────────────────',
    '',
    'Tap the link below:',
    shareUrl,
    '',
    'Alternatively, scan the QR code',
    'provided on the delivery documentation.',
    '',
    '════════════════════════════════════',
    '_Powered by LoadPlan™_',
  ].join('\n');
}

/**
 * Generate a customer-facing notification message
 * Formal tone suitable for end customers
 */
export function formatCustomerNotificationMessage(
  load: ShareableLoadInfo,
  vehicleInfo: ShareableVehicleInfo,
  shareUrl: string,
  companyName = 'LoadPlan'
): string {
  const etaFormatted = new Date(load.offloading_date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  const lines = [
    `Dear Customer,`,
    '',
    `Your shipment from ${companyName} is on its way.`,
    '',
    '════════════════════════════════════',
    '',
    `Order Reference : ${load.load_id}`,
    `Destination     : ${load.destination}`,
    `Expected Delivery : ${etaFormatted}`,
    '',
  ];

  if (load.driver?.name) {
    lines.push(`Driver          : ${load.driver.name}`);
  }
  if (load.driver?.contact) {
    lines.push(`Driver Contact  : ${load.driver.contact}`);
  }

  lines.push('');
  lines.push('════════════════════════════════════');
  lines.push('');
  lines.push('LIVE TRACKING');
  lines.push('');
  lines.push('Tap below to see real-time location:');
  lines.push(shareUrl);
  lines.push('');
  lines.push('════════════════════════════════════');
  lines.push('');
  lines.push(`Thank you for choosing ${companyName}.`);
  lines.push('');
  lines.push('This is an automated notification.');
  lines.push('For queries, please contact our support team.');

  return lines.join('\n');
}

/**
 * Format a simpler message for SMS
 */
export function formatSmsMessage(
  load: {
    load_id: string;
    origin: string;
    destination: string;
    offloading_date: string;
    driver?: { name: string } | null;
  },
  shareUrl: string
): string {
  const arrivalDate = new Date(load.offloading_date).toLocaleDateString('en-GB');
  return `Load ${load.load_id}: ${load.origin} to ${load.destination}. ETA: ${arrivalDate}. ${load.driver?.name ? `Driver: ${load.driver.name}. ` : ''}Track live: ${shareUrl}`;
}