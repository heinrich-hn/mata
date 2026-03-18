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

/**
 * Ensures an alert exists - either returns existing active alert ID or creates a new one
 * Integrates with Wialon fleet system by optionally adding fleet context to metadata
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

  // Add fleet context to metadata if provided
  const enrichedMetadata = {
    ...metadata,
    ...(fleetNumber && { fleet_number: fleetNumber }),
    created_from: 'monitor-app',
    created_at: new Date().toISOString(),
  };

  // Check if active alert exists
  let query = supabase
    .from('alerts')
    .select('id, status')
    .eq('source_type', sourceType)
    .eq('category', category)
    .eq('status', 'active');

  if (sourceId !== null) {
    query = query.eq('source_id', sourceId);
  } else {
    query = query.is('source_id', null);
  }

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    console.log(`Active alert already exists for ${sourceType}:${sourceId} ${category}`);
    return existing.id;
  }

  // Create new alert
  const { data, error } = await supabase
    .from('alerts')
    .insert({
      source_type: sourceType,
      source_id: sourceId ?? null,
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

  console.log(`Created new alert ${data.id} for ${sourceType}:${sourceId} ${category}`);
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