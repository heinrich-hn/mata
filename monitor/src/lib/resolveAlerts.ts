import { supabase } from '@/integrations/supabase/client';

export async function resolveAlert(alertId: string) {
  const { error } = await supabase
    .from('alerts')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString()
    })
    .eq('id', alertId);

  if (error) {
    console.error('Error resolving alert:', error);
    throw error;
  }
}

export async function resolveAlertsByTrip(tripId: string, categories?: string[], issueType?: string) {
  let query = supabase
    .from('alerts')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString()
    })
    .eq('source_type', 'trip')
    .eq('source_id', tripId)
    .eq('status', 'active');

  if (categories && categories.length > 0) {
    query = query.in('category', categories);
  }

  // Filter by issue_type in metadata to avoid cross-resolving
  // (e.g. no_costs and flagged_costs both use fuel_anomaly category)
  if (issueType) {
    query = query.filter('metadata->>issue_type', 'eq', issueType);
  }

  const { error } = await query;

  if (error) {
    console.error('Error resolving alerts:', error);
    throw error;
  }
}

/**
 * When resolving a flagged cost alert from the monitor,
 * also resolve the underlying cost entries in the cost_entries table
 * so the main dashboard reflects the resolution.
 */
export async function resolveFlaggedCostEntries(tripId: string) {
  const { error } = await supabase
    .from('cost_entries')
    .update({
      investigation_status: 'resolved',
      resolved_at: new Date().toISOString()
    })
    .eq('trip_id', tripId)
    .eq('is_flagged', true)
    .is('resolved_at', null);

  if (error) {
    console.error('Error resolving flagged cost entries:', error);
    throw error;
  }
}

export async function resolveDuplicatePODAlerts(podNumber: string) {
  const { error } = await supabase
    .from('alerts')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString()
    })
    .eq('category', 'duplicate_pod')
    .eq('status', 'active')
    .filter('metadata->pod_number', 'eq', podNumber);

  if (error) {
    console.error('Error resolving duplicate POD alerts:', error);
    throw error;
  }
}