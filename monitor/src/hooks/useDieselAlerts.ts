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
  requires_debrief?: boolean;
}

export function useDieselAlerts(enabled: boolean = true) {
  const processedRecords = useRef<Set<string>>(new Set());
  const previousRecordStates = useRef<Map<string, DieselRecord>>(new Map());

  // On mount, clean up stale alerts: debriefed records OR records that no longer require debrief
  useEffect(() => {
    const cleanupStaleAlerts = async () => {
      const { data: alerts, error } = await supabase
        .from('alerts')
        .select('id, source_id')
        .eq('source_type', 'fuel')
        .eq('status', 'active');

      if (error || !alerts?.length) return;

      for (const alert of alerts) {
        const { data: record } = await supabase
          .from('diesel_records')
          .select('debrief_signed, requires_debrief')
          .eq('id', alert.source_id)
          .single();

        // Resolve if debriefed, no longer requires debrief, or record deleted
        if (!record || record.debrief_signed || !record.requires_debrief) {
          await resolveDieselRecordAlerts(alert.source_id);
        }
      }
    };

    if (enabled) {
      cleanupStaleAlerts();
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const checkDieselRecords = async () => {
      console.log('Checking diesel records for missing debriefs...');

      const { data: records, error } = await supabase
        .from('diesel_records')
        .select('*')
        .eq('requires_debrief', true)
        .eq('debrief_signed', false)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching diesel records:', error);
        return;
      }

      const today = new Date();

      // These records all have requires_debrief=true, debrief_signed=false
      // Create alerts for any we haven't processed yet
      for (const record of (records as DieselRecord[] || [])) {
        if (processedRecords.current.has(record.id)) continue;

        if (record.date) {
          const recordDate = new Date(record.date);
          const daysOld = Math.ceil((today.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));

          if (daysOld >= 1) {
            await createMissingDebriefAlert(record, daysOld);
          }
        }

        processedRecords.current.add(record.id);
        previousRecordStates.current.set(record.id, { ...record });
      }

      // Resolve alerts for records no longer in the result set (debriefed or no longer require debrief)
      for (const [recordId] of previousRecordStates.current) {
        const stillPending = (records as DieselRecord[] || []).some(r => r.id === recordId);
        if (!stillPending) {
          await resolveDieselRecordAlerts(recordId);
          processedRecords.current.delete(recordId);
          previousRecordStates.current.delete(recordId);
        }
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