import type { Database } from "@/types/database";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: ReturnType<typeof createSupabaseClient<Database>> | null = null;

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
      storage: globalThis.localStorage,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      // Disable navigator.locks — this is a single-tab mobile PWA so cross-tab
      // lock coordination is unnecessary. The default navigatorLock causes 5s
      // timeouts ("lock not released within 5000ms") on mobile browsers when
      // auth operations race during fast navigation or PWA resume, which blocks
      // session recovery and causes data to disappear.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lock: (async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
        return await fn();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
    },
  });

  return client;
}