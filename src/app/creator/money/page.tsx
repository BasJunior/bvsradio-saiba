"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CreatorMusicValue from "@/components/CreatorMusicValue";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

export default function CreatorMoneyPage() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError("Creator account services are not configured.");
      return;
    }
    createClient().auth.getSession().then(({ data }) => {
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        setError("Sign in with your creator account to view Rights + Money.");
        return;
      }
      setToken(accessToken);
    });
  }, []);

  if (error) {
    return (
      <main className="mx-auto min-h-[65vh] max-w-2xl px-6 py-20 text-center">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">BVS Rights + Money</p>
        <h1 className="mt-3 text-3xl font-semibold">Your music business lives with your creator account.</h1>
        <p className="mt-4 text-text-secondary">{error}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/auth/login" className="rounded-full bg-brand px-6 py-3 font-semibold text-black">Sign in</Link>
          <Link href="/creator/studio" className="rounded-full border border-white/20 px-6 py-3">Creator Studio</Link>
        </div>
      </main>
    );
  }

  if (!token) {
    return <main className="min-h-[65vh] px-6 py-20 text-center text-text-secondary">Loading Rights + Money…</main>;
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <CreatorMusicValue token={token} />
    </main>
  );
}
