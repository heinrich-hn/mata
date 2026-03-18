import { createClient } from "@supabase/supabase-js";

// Uses the same Supabase project as the main MAT dashboard
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY
) as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "MAT Monitor: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
      "Copy .env.example to .env and fill in the same values as the main dashboard."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Share session key with main app if running on the same origin
    storageKey: "sb-mat-auth-token",
  },
});
