import { ensureAlert, resolveAlert } from './alertUtils';
import { supabase } from '@/integrations/supabase/client';

export interface DieselRecordData {
  id: string;
  trip_number?: string;
  vehicle_identifier?: string;
  driver_name?: string;
  fleet_number?: string;
  date?: string;
  fuel_station?: string;
  litres_filled?: number;
  total_cost?: number;
  currency?: 'ZAR' | 'USD';
  distance_travelled?: number;
  debrief_signed?: boolean;
  debrief_notes?: string;
}

export interface DieselAlertMetadata {
  diesel_record_id: string;
  trip_number?: string;
  fleet_number?: string;
  driver_name?: string;
  date?: string;
  issue_type: 'missing_debrief';
  days_old?: number;
}

/**
 * Create an alert for missing debrief
 */
export async function createMissingDebriefAlert(
  dieselRecord: DieselRecordData,
  daysOld: number
): Promise<string> {
  const severity = daysOld > 7 ? 'high' : daysOld > 3 ? 'medium' : 'low';

  return ensureAlert({
    sourceType: 'fuel',
    sourceId: dieselRecord.id,
    sourceLabel: `Diesel: ${dieselRecord.fleet_number || dieselRecord.vehicle_identifier || 'Unknown'}`,
    category: 'fuel_anomaly',
    severity,
    title: `Diesel Record Missing Debrief`,
    message: `${dieselRecord.fleet_number || dieselRecord.vehicle_identifier} diesel record from ${dieselRecord.date} has not been debriefed for ${daysOld} days`,
    fleetNumber: dieselRecord.fleet_number,
    metadata: {
      diesel_record_id: dieselRecord.id,
      trip_number: dieselRecord.trip_number,
      fleet_number: dieselRecord.fleet_number,
      driver_name: dieselRecord.driver_name,
      date: dieselRecord.date,
      days_old: daysOld,
      issue_type: 'missing_debrief',
    },
  });
}

/**
 * Resolve all active alerts for a specific diesel record
 */
export async function resolveDieselRecordAlerts(recordId: string): Promise<void> {
  console.log(`Resolving alerts for diesel record: ${recordId}`);

  const { data: alerts, error } = await supabase
    .from('alerts')
    .select('id')
    .eq('source_type', 'fuel')
    .eq('source_id', recordId)
    .eq('status', 'active');

  if (error) {
    console.error('Error fetching diesel alerts to resolve:', error);
    return;
  }

  console.log(`Found ${alerts?.length || 0} active alerts to resolve for record ${recordId}`);

  for (const alert of alerts || []) {
    await resolveAlert(alert.id, 'Issue resolved in diesel record');
  }
}