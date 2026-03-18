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
  fleetNumber?: string | null;
}

// Define a type for metadata
interface AlertMetadata extends Record<string, unknown> {
  fleet_number?: string;
  created_from: string;
  created_at: string;
  original_source_id?: string;
}

/**
 * Checks if a string is a valid UUID
 */
function isValidUUID(uuid: string | null): boolean {
  if (!uuid) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Ensures an alert exists - either returns existing active alert ID or creates a new one
 */
export async function ensureAlert(payload: AlertPayload): Promise<string> {
  const {
    sourceType,
    sourceId,
    category,
    severity,
    title,
    message,
    metadata = {},
    sourceLabel,
    fleetNumber,
  } = payload;

  // Add fleet context + system metadata
  const enrichedMetadata: AlertMetadata = {
    ...metadata,
    ...(fleetNumber && { fleet_number: fleetNumber }),
    created_from: 'monitor-app',
    created_at: new Date().toISOString(),
  };

  // Store original sourceId in metadata if it's not a valid UUID
  if (sourceId && !isValidUUID(sourceId)) {
    enrichedMetadata.original_source_id = sourceId;
  }

  try {
    // Check if active alert exists
    let query = supabase
      .from('alerts')
      .select('id, status')
      .eq('source_type', sourceType)
      .eq('category', category)
      .eq('status', 'active');

    // Only add source_id filter if it's a valid UUID
    if (sourceId !== null) {
      if (isValidUUID(sourceId)) {
        query = query.eq('source_id', sourceId);
      } else {
        console.log(`sourceId ${sourceId} is not a UUID, skipping source_id filter in existence check`);
      }
    } else {
      query = query.is('source_id', null);
    }

    const { data: existingAlerts, error: checkError } = await query
      .order('created_at', { ascending: false })
      .limit(1);

    if (checkError) {
      console.error('Error checking for existing alert:', checkError);
    }

    const existing = existingAlerts && existingAlerts.length > 0 ? existingAlerts[0] : null;

    if (existing) {
      console.log(`Active alert already exists for ${sourceType}:${sourceId ?? 'null'} ${category}`);
      return existing.id;
    }

    // Create new alert
    const insertData: {
      source_type: string;
      source_id: string | null;
      source_label: string;
      title: string;
      message: string;
      category: string;
      severity: string;
      metadata: AlertMetadata;
      status: 'active';
    } = {
      source_type: sourceType,
      source_id: null,
      source_label: sourceLabel,
      title,
      message,
      category,
      severity,
      metadata: enrichedMetadata,
      status: 'active',
    };

    // Only set source_id if it's a valid UUID
    if (sourceId !== null && isValidUUID(sourceId)) {
      insertData.source_id = sourceId;
    }

    const { data, error } = await supabase
      .from('alerts')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      console.error('Failed to create alert:', error);
      throw error;
    }

    if (!data) {
      throw new Error('Alert created but no ID returned');
    }

    console.log(`Created new alert ${data.id} for ${sourceType}:${sourceId ?? 'null'} ${category}`);
    return data.id;
  } catch (err) {
    console.error('Error in ensureAlert:', err);
    throw err;
  }
}

/**
 * Helper function to resolve an alert when condition is no longer active
 */
export async function resolveAlert(alertId: string, resolutionNote?: string): Promise<boolean> {
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

/**
 * Helper function to resolve all alerts for a source
 */
export async function resolveAlertsBySource(sourceType: string, sourceId: string): Promise<void> {
  const { data: alerts, error } = await supabase
    .from('alerts')
    .select('id')
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .eq('status', 'active');

  if (error) {
    console.error('Error fetching alerts to resolve:', error);
    return;
  }

  for (const alert of alerts || []) {
    await resolveAlert(alert.id, `Resolved by source ${sourceType}:${sourceId}`);
  }
}

// Note: acknowledgeAlert function has been removed as it's no longer needed