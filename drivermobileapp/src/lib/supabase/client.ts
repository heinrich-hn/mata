// src/lib/supabase/client.ts
import type { Database } from "@/types/database";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { persistSessionToIndexedDB, loadSessionFromIndexedDB, clearSessionFromIndexedDB } from "@/lib/session-persistence";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: ReturnType<typeof createSupabaseClient<Database>> | null = null;

/**
 * Simple in-memory lock to serialise auth token refreshes.
 *
 * navigator.locks is disabled because this is a single-tab mobile PWA and
 * the default lock causes 5 s timeouts on mobile browsers.  However, a
 * no-op lock allows *concurrent* refreshes that race each other: one succeeds
 * while the other may emit TOKEN_REFRESHED with a null session or even
 * SIGNED_OUT, which wipes all cached query data.
 *
 * This in-memory mutex serialises the calls so only one runs at a time.
 */
let lockPromise: Promise<unknown> = Promise.resolve();

function inMemoryLock<T>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<T>,
): Promise<T> {
  const current = lockPromise.then(fn, fn);
  // Keep the chain going; swallow errors so the next caller isn't blocked.
  lockPromise = current.catch(() => { });
  return current;
}

// Custom storage that uses both localStorage and IndexedDB
const customStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      // Try localStorage first (faster)
      const localValue = localStorage.getItem(key);
      if (localValue) return localValue;
      
      // Fallback to IndexedDB
      const indexedDBValue = await loadSessionFromIndexedDB();
      if (indexedDBValue) {
        // Restore to localStorage
        const valueString = JSON.stringify(indexedDBValue);
        localStorage.setItem(key, valueString);
        return valueString;
      }
      
      return null;
    } catch (error) {
      console.error('Storage getItem error:', error);
      return null;
    }
  },
  
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      // Store in localStorage
      localStorage.setItem(key, value);
      
      // Also store in IndexedDB for redundancy
      const session = JSON.parse(value);
      await persistSessionToIndexedDB(session);
    } catch (error) {
      console.error('Storage setItem error:', error);
    }
  },
  
  removeItem: async (key: string): Promise<void> => {
    try {
      localStorage.removeItem(key);
      await clearSessionFromIndexedDB();
    } catch (error) {
      console.error('Storage removeItem error:', error);
    }
  }
};

export function createClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error(
      "Missing Supabase environment variables:",
      !SUPABASE_URL ? "VITE_SUPABASE_URL" : "",
      !SUPABASE_ANON_KEY ? "VITE_SUPABASE_ANON_KEY" : ""
    );
    throw new Error("Supabase configuration missing. Please check environment variables.");
  }

  if (client) {
    return client;
  }

  client = createSupabaseClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      storageKey: 'mata-driver-auth',
      storage: customStorage,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      // Use an in-memory mutex instead of navigator.locks to avoid 5 s
      // timeouts on mobile, while still serialising concurrent refreshes
      // so they don't race and produce spurious SIGNED_OUT events.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lock: inMemoryLock as any,
    },
  });

  return client;
}