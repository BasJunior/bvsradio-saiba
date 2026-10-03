"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";
import { withAuthTimeout } from "@/lib/auth-client-flow";

/** Auth events carry the session; never reacquire the SDK lock in their callback. */
export function useBrowserSession() {
  const [state, setState] = useState<{ session: Session | null; loading: boolean }>({ session: null, loading: isSupabaseConfigured() });
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const client = createClient();
    let active = true;
    let version = 0;
    const initialVersion = version;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      version++;
      setState({ session, loading: false });
    });
    void withAuthTimeout(client.auth.getSession(), 12000, "Account session timed out.")
      .then(({ data }) => { if (active && version === initialVersion) setState({ session: data.session, loading: false }); })
      .catch(() => { if (active && version === initialVersion) setState({ session: null, loading: false }); });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  return state;
}
