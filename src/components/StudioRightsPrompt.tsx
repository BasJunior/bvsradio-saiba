"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Stays hidden unless the artist has music waiting for an answer. */
export default function StudioRightsPrompt({ token }: { token: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!token) return;
    let active = true;
    void fetch("/api/creator/rights", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (active && data?.available) setCount(Number(data.needsAnswer) || 0); })
      .catch(() => null);
    return () => { active = false; };
  }, [token]);
  if (!count) return null;
  return (
    <Link href="/creator/studio/rights" className="mt-6 flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand/30 bg-brand/10 p-4 text-sm">
      <span><strong>{count} {count === 1 ? "item needs" : "items need"} a quick rights answer.</strong> It keeps your music able to play on BVS.</span>
      <span className="font-semibold text-brand">Confirm your music →</span>
    </Link>
  );
}
