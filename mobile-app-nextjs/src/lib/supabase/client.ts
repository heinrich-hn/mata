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

  client = createSupabaseClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

  return client;
}