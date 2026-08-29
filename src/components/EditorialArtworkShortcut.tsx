"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

export default function EditorialArtworkShortcut() {
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    void createClient().auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token;
      if (!token) return;
      const response = await fetch("/api/admin/editorial/artwork-changes", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = await response.json().catch(() => ({}));
      if (!active) return;
      const requests = Array.isArray(payload.requests) ? payload.requests : [];
      setPending(requests.filter((item: { status?: string }) => ["open", "reviewing"].includes(String(item.status || ""))).length);
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return (
    <nav aria-label="Editorial shortcuts" className="flex flex-wrap items-center gap-2 py-3 text-sm">
      <Link href="/editorial" className="rounded-full border border-white/15 px-4 py-2 text-text-secondary hover:border-brand hover:text-white">
        Editorial home
      </Link>
      <Link href="/editorial/artwork" className="inline-flex items-center gap-2 rounded-full border border-brand/35 bg-brand/10 px-4 py-2 font-semibold text-brand hover:border-brand">
        Cover art requests
        {pending !== null && pending > 0 ? (
          <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-black" aria-label={`${pending} pending cover art requests`}>
            {pending}
          </span>
        ) : null}
      </Link>
    </nav>
  );
}
