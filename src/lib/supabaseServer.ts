import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "./config";

let supabaseClient: ReturnType<typeof createClient> | undefined;

export function getSupabaseServerClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const env = getServerEnv();
  supabaseClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  return supabaseClient;
}
