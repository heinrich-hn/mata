import { supabase } from "@/integrations/supabase/client";

export interface AlertPayload {
  sourceType: string;
  sourceId: string | null;
  sourceLabel: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  fleetNumber?: string | null; // Optional fleet number for better context
}

// UUID v4 regex for validating source_id before DB operations
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Ensures an alert exists - either returns existing active alert ID or creates a new one
 * Integrates with Wialon fleet system by optionally adding fleet context to metadata
 *
 * When sourceId is not a valid UUID (e.g. a POD number like "4H18/03"),
 * the value is stored in metadata instead and source_id is set to null.
 * Dedup queries then match on metadata->>source_reference + category.
 */
export async function ensureAlert(payload: AlertPayload) {
  const {
    sourceType,
    sourceId,
    category,
    severity,
    title,
    message,
    metadata = {},
    sourceLabel,
    fleetNumber
  } = payload;

  // Determine if sourceId can be used as a UUID column value
  const sourceIdIsUUID = sourceId !== null && isValidUUID(sourceId);
  const dbSourceId = sourceIdIsUUID ? sourceId : null;

  // Add fleet context to metadata if provided
  const enrichedMetadata = {
    ...metadata,
    ...(fleetNumber && { fleet_number: fleetNumber }),
    // Store non-UUID sourceId in metadata for dedup lookups
    ...(!sourceIdIsUUID && sourceId ? { source_reference: sourceId } : {}),
    created_from: 'dashboard-app',
    created_at: new Date().toISOString(),
  };

  // Check if active alert exists
  let query = supabase
    .from('alerts')
    .select('id, status')
    .eq('source_type', sourceType)
    .eq('category', category)
    .eq('status', 'active');

  if (dbSourceId !== null) {
    query = query.eq('source_id', dbSourceId);
  } else if (sourceId !== null) {
    // Non-UUID sourceId — match via metadata
    query = query.is('source_id', null)
      .filter('metadata->>source_reference', 'eq', sourceId);
  } else {
    query = query.is('source_id', null);
  }

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    return existing.id;
  }

  // Create new alert
  const { data, error } = await supabase
    .from('alerts')
    .insert({
      source_type: sourceType,
      source_id: dbSourceId,
      source_label: sourceLabel,
      title,
      message,
      category,
      severity,
      metadata: enrichedMetadata,
      status: 'active' as const,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to create alert:', error);
    throw error;
  }

  return data.id;
}

/**
 * Helper function to create vehicle-specific alerts with fleet context
 */
export async function createVehicleAlert(
  vehicleId: string,
  vehicleName: string,
  fleetNumber: string | null,
  severity: AlertPayload['severity'],
  category: string,
  title: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  return ensureAlert({
    sourceType: 'vehicle',
    sourceId: vehicleId,
    sourceLabel: vehicleName,
    category,
    severity,
    title,
    message,
    fleetNumber,
    metadata: {
      ...metadata,
      vehicle_id: vehicleId,
      vehicle_name: vehicleName,
    },
  });
}

/**
 * Helper function to create Wialon-specific vehicle alerts
 */
export async function createWialonVehicleAlert(
  wialonVehicleId: string,
  vehicleName: string,
  fleetNumber: string | null,
  severity: AlertPayload['severity'],
  category: string,
  title: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  return ensureAlert({
    sourceType: 'vehicle', // Using 'vehicle' as source type for consistency
    sourceId: wialonVehicleId,
    sourceLabel: vehicleName,
    category,
    severity,
    title,
    message,
    fleetNumber,
    metadata: {
      ...metadata,
      wialon_vehicle_id: wialonVehicleId,
      vehicle_name: vehicleName,
      source: 'wialon',
    },
  });
}

/**
 * Helper function to resolve an alert when condition is no longer active
 */
export async function resolveAlert(alertId: string, resolutionNote?: string) {
  const { error } = await supabase
    .from('alerts')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolution_note: resolutionNote || 'Condition cleared',
    })
    .eq('id', alertId);

  if (error) {
    console.error('Failed to resolve alert:', error);
    throw error;
  }

  console.log(`Resolved alert ${alertId}`);
  return true;
}