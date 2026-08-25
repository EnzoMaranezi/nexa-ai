import { supabase as generatedClient } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Single Supabase entry point for the app.
 *
 * The underlying client is configured from environment variables only
 * (VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY). No credentials are
 * hardcoded and no service-role key is ever used in frontend code.
 *
 * We re-export the generated client instead of instantiating a second one so
 * the app keeps exactly one auth session / realtime connection.
 */
export const supabase: SupabaseClient<Database> = generatedClient;

export type { Database };
