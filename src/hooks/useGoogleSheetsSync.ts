/**
 * Auto-sync hook for Google Sheets integration.
 * Fires debounced, fire-and-forget edge function calls whenever
 * data changes in diesel, reefer, tyres, trips, or workshop modules.
 */

import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

type SyncType = 'diesel' | 'tyres' | 'workshop' | 'trips';

const DEBOUNCE_MS = 3000; // 3s debounce to batch rapid changes
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Fires a sync request to the Google Sheets edge function.
 * Fire-and-forget — does not throw or block the caller.
 */
async function triggerSync(syncType: SyncType): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.warn(`[sheets-sync] No auth session, skipping ${syncType} sync`);
      return;
    }

    const url = `${SUPABASE_URL}/functions/v1/sync-google-sheets?type=${syncType}&period=ytd`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[sheets-sync] ${syncType} sync failed (${response.status}):`, body);
    } else {
      console.log(`[sheets-sync] ${syncType} sync triggered successfully`);
    }
  } catch (err) {
    console.error(`[sheets-sync] ${syncType} sync error:`, err);
  }
}

/**
 * Hook that returns a debounced sync trigger for a specific module.
 * Multiple rapid calls within DEBOUNCE_MS are collapsed into one.
 */
export function useGoogleSheetsSync(syncType: SyncType) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestSync = useCallback(() => {
    // Clear any pending timer so we only fire once per burst
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      triggerSync(syncType);
      timerRef.current = null;
    }, DEBOUNCE_MS);
  }, [syncType]);

  return { requestSync };
}

/**
 * Standalone (non-hook) function for use in contexts or outside components.
 * Uses a module-level debounce map.
 */
const debouncers: Map<SyncType, ReturnType<typeof setTimeout>> = new Map();

export function requestGoogleSheetsSync(syncType: SyncType): void {
  const existing = debouncers.get(syncType);
  if (existing) clearTimeout(existing);

  debouncers.set(syncType, setTimeout(() => {
    triggerSync(syncType);
    debouncers.delete(syncType);
  }, DEBOUNCE_MS));
}
