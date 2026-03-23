import { supabase } from '@/integrations/supabase/client';
import { ensureAlert } from './alertUtils';

export interface FaultData {
  id: string;
  fault_number: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'identified' | 'acknowledged' | 'resolved';
  fault_description: string;
  reported_by: string;
  reported_date: string;
  resolved_date?: string | null;
  resolution_notes?: string | null;
  vehicle?: {
    fleet_number: string | null;
    registration_number: string;
    make: string;
    model: string;
  } | null;
}

/**
 * Create an alert for a new vehicle fault
 */
export async function createFaultAlert(fault: FaultData) {
  // Only create alerts for identified or acknowledged faults
  if (fault.status === 'resolved') return null;

  const severity = fault.severity === 'critical' ? 'critical' :
    fault.severity === 'high' ? 'high' : 'medium';

  const vehicleInfo = fault.vehicle
    ? `${fault.vehicle.fleet_number || fault.vehicle.registration_number} (${fault.vehicle.make} ${fault.vehicle.model})`
    : 'Unknown Vehicle';

  return ensureAlert({
    sourceType: 'vehicle',
    sourceId: fault.id,
    sourceLabel: `Fault: ${fault.fault_number}`,
    category: 'vehicle_fault',
    severity,
    title: `Vehicle Fault: ${fault.fault_description.substring(0, 60)}${fault.fault_description.length > 60 ? '...' : ''}`,
    message: `${vehicleInfo} - ${fault.fault_description}`,
    fleetNumber: fault.vehicle?.fleet_number,
    metadata: {
      fault_id: fault.id,
      fault_number: fault.fault_number,
      fault_description: fault.fault_description,
      reported_by: fault.reported_by,
      reported_date: fault.reported_date,
      status: fault.status,
      vehicle_fleet: fault.vehicle?.fleet_number,
      vehicle_reg: fault.vehicle?.registration_number,
      vehicle_make: fault.vehicle?.make,
      vehicle_model: fault.vehicle?.model,
      issue_type: 'vehicle_fault',
    },
  });
}

/**
 * Update alert when fault status changes
 */
export async function updateFaultAlert(fault: FaultData) {
  // Check if alert exists
  const { data: existing } = await supabase
    .from('alerts')
    .select('id, status')
    .eq('source_id', fault.id)
    .in('category', ['vehicle_fault', 'maintenance_due'])
    .in('status', ['active', 'acknowledged'])
    .maybeSingle();

  if (fault.status === 'resolved') {
    // Resolve the alert if it exists
    if (existing) {
      const { error } = await supabase
        .from('alerts')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolution_note: fault.resolution_notes || 'Fault resolved',
        })
        .eq('id', existing.id);

      if (error) console.error('Failed to resolve fault alert:', error);
    }
  } else {
    if (existing) {
      // Update existing alert
      const severity = fault.severity === 'critical' ? 'critical' :
        fault.severity === 'high' ? 'high' : 'medium';

      await supabase
        .from('alerts')
        .update({
          severity,
          metadata: {
            fault_id: fault.id,
            fault_number: fault.fault_number,
            fault_description: fault.fault_description,
            reported_by: fault.reported_by,
            reported_date: fault.reported_date,
            status: fault.status,
            vehicle_fleet: fault.vehicle?.fleet_number,
            vehicle_reg: fault.vehicle?.registration_number,
            vehicle_make: fault.vehicle?.make,
            vehicle_model: fault.vehicle?.model,
            issue_type: 'vehicle_fault',
            updated_at: new Date().toISOString(),
          },
        })
        .eq('id', existing.id);
    } else {
      // Create new alert
      await createFaultAlert(fault);
    }
  }
}