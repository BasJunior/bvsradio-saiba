import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

/** Browser / client components only. Reuse one auth client per tab to avoid
 * competing Supabase session locks across Navbar, Library sync and auth pages. */
export function createClient() {
  const makeClient = () =>
    createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
        flowType: "pkce",
      },
    });

  if (typeof window === "undefined") return makeClient();
  if (!browserClient) browserClient = makeClient();
  return browserClient;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
