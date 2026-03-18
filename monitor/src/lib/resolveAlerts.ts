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

export async function resolveAlertsByTrip(tripId: string, categories?: string[]) {
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

  const { error } = await query;

  if (error) {
    console.error('Error resolving alerts:', error);
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