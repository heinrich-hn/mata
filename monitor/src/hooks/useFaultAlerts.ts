import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createFaultAlert, updateFaultAlert, FaultData } from '@/lib/faultAlerts';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Remove the unused VehicleFaultRow interface
// Helper function to safely get ID from payload
function getFaultIdFromPayload(payload: RealtimePostgresChangesPayload<Record<string, unknown>>): string | null {
  if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
    return payload.new.id as string;
  }
  if (payload.old && typeof payload.old === 'object' && 'id' in payload.old) {
    return payload.old.id as string;
  }
  return null;
}

export function useFaultAlerts(enabled: boolean = true) {
  const processedFaults = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;

    // Initial sync of existing faults
    const syncExistingFaults = async () => {
      const { data: faults, error } = await supabase
        .from('vehicle_faults')
        .select(`
          *,
          vehicles (
            fleet_number,
            registration_number,
            make,
            model
          )
        `)
        .in('status', ['identified', 'acknowledged'])
        .order('reported_date', { ascending: false });

      if (error) {
        console.error('Error fetching faults:', error);
        return;
      }

      for (const fault of faults) {
        if (!processedFaults.current.has(fault.id)) {
          processedFaults.current.add(fault.id);
          await createFaultAlert(fault as FaultData);
        }
      }
    };

    syncExistingFaults();

    // Subscribe to realtime changes
    const subscription = supabase
      .channel('vehicle_faults_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vehicle_faults',
        },
        async (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const faultId = getFaultIdFromPayload(payload);

          if (!faultId) return;

          // Fetch full fault data with vehicle info
          const { data: fault } = await supabase
            .from('vehicle_faults')
            .select(`
              *,
              vehicles (
                fleet_number,
                registration_number,
                make,
                model
              )
            `)
            .eq('id', faultId)
            .single();

          if (fault) {
            if (payload.eventType === 'DELETE') {
              // Resolve alert when fault is deleted
              const oldId = payload.old && typeof payload.old === 'object' && 'id' in payload.old
                ? payload.old.id as string
                : null;

              if (oldId) {
                await supabase
                  .from('alerts')
                  .update({
                    status: 'resolved',
                    resolved_at: new Date().toISOString(),
                    resolution_note: 'Fault deleted',
                  })
                  .eq('source_id', oldId)
                  .in('category', ['vehicle_fault', 'maintenance_due'])
                  .in('status', ['active', 'acknowledged']);
              }
            } else {
              // Update or create alert
              await updateFaultAlert(fault as FaultData);
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [enabled]);
}