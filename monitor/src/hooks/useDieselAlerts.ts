import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  createMissingDebriefAlert,
  resolveDieselRecordAlerts,
  DieselRecordData,
} from '@/lib/dieselAlerts';

interface DieselRecord extends DieselRecordData {
  id: string;
  created_at?: string;
  updated_at?: string;
  debrief_signed?: boolean;
  debrief_signed_at?: string;
}

export function useDieselAlerts(enabled: boolean = true) {
  const processedRecords = useRef<Set<string>>(new Set());
  const previousRecordStates = useRef<Map<string, DieselRecord>>(new Map());

  // First, clean up any existing alerts for debriefed records on mount
  useEffect(() => {
    const cleanupExistingAlerts = async () => {
      console.log('Running initial cleanup of alerts for debriefed records...');

      const { data: alerts, error } = await supabase
        .from('alerts')
        .select('id, source_id')
        .eq('source_type', 'fuel')
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching alerts for cleanup:', error);
        return;
      }

      for (const alert of alerts || []) {
        const { data: record } = await supabase
          .from('diesel_records')
          .select('debrief_signed')
          .eq('id', alert.source_id)
          .single();

        if (record?.debrief_signed) {
          console.log(`Cleaning up alert ${alert.id} for debriefed record ${alert.source_id}`);
          await resolveDieselRecordAlerts(alert.source_id);
        }
      }
    };

    if (enabled) {
      cleanupExistingAlerts();
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const checkDieselRecords = async () => {
      console.log('Checking diesel records for missing debriefs...');

      const { data: records, error } = await supabase
        .from('diesel_records')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching diesel records:', error);
        return;
      }

      const today = new Date();
      const resolvedRecords = new Set<string>();

      // First, resolve alerts for ANY debriefed record we find
      for (const record of (records as DieselRecord[] || [])) {
        if (record.debrief_signed) {
          console.log(`Record ${record.id} (${record.fleet_number}) is debriefed, ensuring alerts are resolved`);
          await resolveDieselRecordAlerts(record.id);
          processedRecords.current.add(record.id);
          previousRecordStates.current.set(record.id, { ...record });
        }
      }

      // Check for resolved missing debrief issues by comparing with previous state
      for (const record of (records as DieselRecord[] || [])) {
        // Skip debriefed records - they're already handled
        if (record.debrief_signed) continue;

        const previousRecord = previousRecordStates.current.get(record.id);

        if (previousRecord) {
          // Check if missing debrief was resolved
          const hadMissingDebrief = !previousRecord.debrief_signed;
          const hasMissingDebriefNow = !record.debrief_signed;

          // If missing debrief was resolved, mark for alert resolution
          if (hadMissingDebrief && !hasMissingDebriefNow) {
            console.log(`Record ${record.id} was debriefed, marking for alert resolution`);
            resolvedRecords.add(record.id);
          }
        }

        // Update previous state
        previousRecordStates.current.set(record.id, { ...record });
      }

      // Resolve alerts for records that were debriefed
      if (resolvedRecords.size > 0) {
        console.log(`Resolving alerts for ${resolvedRecords.size} records that were debriefed`);
        for (const recordId of resolvedRecords) {
          try {
            await resolveDieselRecordAlerts(recordId);
            processedRecords.current.delete(recordId);
          } catch (error) {
            console.error('Error resolving alerts for diesel record:', recordId, error);
          }
        }
      }

      // Check for new missing debriefs (only for non-debriefed records)
      for (const record of (records as DieselRecord[] || [])) {
        // Skip if already processed OR if record is debriefed
        if (processedRecords.current.has(record.id) || record.debrief_signed) {
          continue;
        }

        // ONLY check for missing debrief - removed all other alert types
        if (record.date) {
          const recordDate = new Date(record.date);
          const daysOld = Math.ceil((today.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));

          if (daysOld >= 1) { // Alert after 1 day
            await createMissingDebriefAlert(record, daysOld);
          }
        }

        processedRecords.current.add(record.id);
      }
    };

    // Initial check
    checkDieselRecords();

    // Set up realtime subscription
    const subscription = supabase
      .channel('diesel-records-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'diesel_records',
        },
        async (payload) => {
          console.log('Diesel record change detected:', payload.eventType);

          if (payload.eventType === 'DELETE') {
            const oldRecord = payload.old as DieselRecord;
            if (oldRecord?.id) {
              await resolveDieselRecordAlerts(oldRecord.id);
              processedRecords.current.delete(oldRecord.id);
              previousRecordStates.current.delete(oldRecord.id);
            }
          } else {
            const record = payload.new as DieselRecord;

            // If record is debriefed, resolve alerts immediately
            if (record.debrief_signed) {
              await resolveDieselRecordAlerts(record.id);
            }

            processedRecords.current.delete(record.id);
            setTimeout(() => checkDieselRecords(), 100);
          }
        }
      )
      .subscribe();

    const interval = setInterval(checkDieselRecords, 30 * 1000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [enabled]);
}