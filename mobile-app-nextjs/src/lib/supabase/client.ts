import type { Database } from "@/types/database";
import { createBrowserClient } from "@supabase/ssr";

// Validate environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Singleton pattern - create client once and reuse
let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  // Validate environment variables are present
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error(
      "Missing Supabase environment variables:",
      !SUPABASE_URL ? "NEXT_PUBLIC_SUPABASE_URL" : "",
      !SUPABASE_ANON_KEY ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : ""
    );
    // Return a minimal client that will fail gracefully
    // This prevents the app from hanging indefinitely
    throw new Error("Supabase configuration missing. Please check environment variables.");
  }

  if (client) {
    return client;
  }

  client = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

  return client;
}