"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CreatorBroadcastDesk from "@/components/CreatorBroadcastDesk";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

export default function CreatorBroadcastPage() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError("Creator authentication is not configured.");
      return;
    }
    createClient().auth.getSession().then(({ data }) => {
      const accessToken = data.session?.access_token || "";
      if (!accessToken) {
        setError("Sign in with your creator account to prepare a broadcast.");
        return;
      }
      setToken(accessToken);
    });
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-5 py-12 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[.22em] text-brand">Creator studio · Shows</p>
          <h1 className="mt-2 text-4xl font-semibold">Broadcast</h1>
        </div>
        <Link href="/creator/studio/manage#show-work" className="rounded-full border border-white/15 px-4 py-2 text-sm">
          Back to Creator Studio
        </Link>
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-300/30 p-5 text-amber-100">
          <p>{error}</p>
          <Link href="/auth/login" className="mt-4 inline-flex rounded-full bg-brand px-4 py-2 font-semibold text-black">Sign in</Link>
        </div>
      ) : token ? (
        <CreatorBroadcastDesk token={token} />
      ) : (
        <p className="text-text-secondary">Loading broadcast controls…</p>
      )}
    </main>
  );
}
