import { supabase } from '@/integrations/supabase/client';
import { TripAlertContext, TripAlertMetadata } from '@/types/tripAlerts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

function mapContextToMetadata(
  context: TripAlertContext,
  issueType: TripAlertMetadata['issue_type'],
  additionalData: Partial<TripAlertMetadata> = {}
): TripAlertMetadata {
  return {
    trip_id: context.tripId,
    trip_number: context.tripNumber,
    issue_type: issueType,
    fleet_number: context.fleetNumber,
    driver_name: context.driverName,
    client_name: context.clientName,
    ...additionalData
  };
}

/**
 * Check if an active or recently-resolved alert already exists for a trip + issue type.
 * Returns the existing alert ID if found (skip creation), or null to proceed.
 */
async function findExistingTripAlert(
  sourceId: string,
  category: string,
  issueType: string
): Promise<string | null> {
  if (!isValidUUID(sourceId)) {
    console.warn(`findExistingTripAlert: sourceId "${sourceId}" is not a valid UUID, skipping`);
    return null;
  }

  // Check for any existing alert (active or resolved) for this source + issue type
  const { data, error } = await supabase
    .from('alerts')
    .select('id, status')
    .eq('source_type', 'trip')
    .eq('source_id', sourceId)
    .eq('category', category)
    .filter('metadata->>issue_type', 'eq', issueType)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error checking existing alert:', error);
    return 'ERROR_SKIP'; // Fail CLOSED — do NOT allow creation when check fails
  }

  if (data && data.length > 0) {
    return data[0].id; // Alert exists — don't create a new one
  }

  return null;
}

/**
 * Check for existing duplicate POD alert by pod_number metadata
 */
async function findExistingDuplicatePODAlert(
  podNumber: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('alerts')
    .select('id, status')
    .eq('category', 'duplicate_pod')
    .filter('metadata->>pod_number', 'eq', podNumber)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error checking existing duplicate POD alert:', error);
    return null;
  }

  if (data && data.length > 0) {
    return data[0].id;
  }

  return null;
}

export async function createDuplicatePODAlert(
  podNumber: string,
  count: number,
  tripIds: string[],
  context: TripAlertContext
): Promise<string | null> {
  if (!isValidUUID(context.tripId)) {
    console.warn(`createDuplicatePODAlert: tripId "${context.tripId}" is not a valid UUID, skipping`);
    return null;
  }

  // Check for existing alert (active or resolved) — don't recreate
  const existingId = await findExistingDuplicatePODAlert(podNumber);
  if (existingId) return existingId;

  const metadata = mapContextToMetadata(context, 'duplicate_pod', {
    duplicate_count: count,
    is_flagged: true,
    needs_review: true
  });

  const { data, error } = await supabase
    .from('alerts')
    .insert({
      source_type: 'trip',
      source_id: context.tripId,
      source_label: `Trip ${context.tripNumber}`,
      category: 'duplicate_pod',
      severity: 'high',
      title: 'Duplicate POD Detected',
      message: `POD ${podNumber} appears ${count} times`,
      metadata: {
        ...metadata,
        pod_number: podNumber,
        duplicate_trip_ids: tripIds
      },
      status: 'active',
      triggered_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data.id;
}

export async function createMissingRevenueAlert(
  tripId: string,
  tripNumber: string,
  context: TripAlertContext
): Promise<string | null> {
  if (!isValidUUID(tripId)) {
    console.warn(`createMissingRevenueAlert: tripId "${tripId}" is not a valid UUID, skipping`);
    return null;
  }

  // Check for existing alert — don't recreate if resolved externally
  const existingId = await findExistingTripAlert(tripId, 'load_exception', 'missing_revenue');
  if (existingId) return existingId;

  const metadata = mapContextToMetadata(context, 'missing_revenue', {
    is_flagged: true,
    needs_review: true
  });

  const { data, error } = await supabase
    .from('alerts')
    .insert({
      source_type: 'trip',
      source_id: tripId,
      source_label: `Trip ${tripNumber}`,
      category: 'load_exception',
      severity: 'high',
      title: 'Missing Revenue',
      message: `Trip ${tripNumber} has no revenue data`,
      metadata,
      status: 'active',
      triggered_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data.id;
}

export async function createFlaggedCostAlert(
  tripId: string,
  tripNumber: string,
  flaggedCount: number,
  details?: string,
  context?: TripAlertContext
): Promise<string | null> {
  if (!isValidUUID(tripId)) {
    console.warn(`createFlaggedCostAlert: tripId "${tripId}" is not a valid UUID, skipping`);
    return null;
  }

  // Check for existing alert
  const existingId = await findExistingTripAlert(tripId, 'fuel_anomaly', 'flagged_costs');
  if (existingId) return existingId;

  const metadata = mapContextToMetadata(context!, 'flagged_costs', {
    flagged_count: flaggedCount,
    flag_reason: details || 'Costs require investigation',
    is_flagged: true,
    needs_review: true
  });

  const { data, error } = await supabase
    .from('alerts')
    .insert({
      source_type: 'trip',
      source_id: tripId,
      source_label: `Trip ${tripNumber}`,
      category: 'fuel_anomaly',
      severity: 'medium',
      title: 'Flagged Costs',
      message: `Trip ${tripNumber} has ${flaggedCount} flagged cost(s)`,
      metadata,
      status: 'active',
      triggered_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data.id;
}

export async function createNoCostsAlert(
  tripId: string,
  tripNumber: string,
  daysInProgress?: number,
  context?: TripAlertContext
): Promise<string | null> {
  if (!isValidUUID(tripId)) {
    console.warn(`createNoCostsAlert: tripId "${tripId}" is not a valid UUID, skipping`);
    return null;
  }

  // Check for existing alert
  const existingId = await findExistingTripAlert(tripId, 'fuel_anomaly', 'no_costs');
  if (existingId) return existingId;

  const metadata = mapContextToMetadata(context!, 'no_costs', {
    days_in_progress: daysInProgress,
    is_flagged: true,
    needs_review: true
  });

  const { data, error } = await supabase
    .from('alerts')
    .insert({
      source_type: 'trip',
      source_id: tripId,
      source_label: `Trip ${tripNumber}`,
      category: 'fuel_anomaly',
      severity: 'medium',
      title: 'No Costs Recorded',
      message: daysInProgress
        ? `Trip ${tripNumber} has no costs after ${daysInProgress} days`
        : `Trip ${tripNumber} has no costs recorded`,
      metadata,
      status: 'active',
      triggered_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data.id;
}

export async function createLongRunningTripAlert(
  tripId: string,
  tripNumber: string,
  daysInProgress: number,
  context?: TripAlertContext
): Promise<string> {
  if (!isValidUUID(tripId)) {
    throw new Error(`createLongRunningTripAlert: tripId "${tripId}" is not a valid UUID`);
  }

  const metadata = mapContextToMetadata(context!, 'long_running', {
    days_in_progress: daysInProgress,
    is_flagged: true,
    needs_review: true
  });

  const { data, error } = await supabase
    .from('alerts')
    .insert({
      source_type: 'trip',
      source_id: tripId,
      source_label: `Trip ${tripNumber}`,
      category: 'trip_delay',
      severity: 'low',
      title: 'Long Running Trip',
      message: `Trip ${tripNumber} has been in progress for ${daysInProgress} days`,
      metadata,
      status: 'active',
      triggered_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data.id;
}

export async function createFlaggedTripAlert(
  tripId: string,
  tripNumber: string,
  reason: string,
  context?: TripAlertContext
): Promise<string> {
  if (!isValidUUID(tripId)) {
    throw new Error(`createFlaggedTripAlert: tripId "${tripId}" is not a valid UUID`);
  }

  const metadata = mapContextToMetadata(context!, 'flagged_trip', {
    flag_reason: reason,
    is_flagged: true,
    needs_review: true
  });

  const { data, error } = await supabase
    .from('alerts')
    .insert({
      source_type: 'trip',
      source_id: tripId,
      source_label: `Trip ${tripNumber}`,
      category: 'load_exception',
      severity: 'high',
      title: 'Flagged Trip',
      message: `Trip ${tripNumber} requires review`,
      metadata,
      status: 'active',
      triggered_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data.id;
}

// Note: createPaymentStatusAlert has been removed