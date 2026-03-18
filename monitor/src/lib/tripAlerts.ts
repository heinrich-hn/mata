import { supabase } from '@/integrations/supabase/client';
import { TripAlertContext, TripAlertMetadata } from '@/types/tripAlerts';

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

export async function createDuplicatePODAlert(
  podNumber: string,
  count: number,
  tripIds: string[],
  context: TripAlertContext
): Promise<string> {
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
): Promise<string> {
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
): Promise<string> {
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
): Promise<string> {
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