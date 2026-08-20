"use client";

import { useEffect, useState } from "react";

const KEY = "bvs_seen_build_sha";

export default function StaleBuildBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/build", { cache: "no-store" })
      .then((res) => res.json())
      .then((payload: { sha?: string }) => {
        const sha = String(payload?.sha || "").trim();
        if (!sha || cancelled) return;
        const seen = localStorage.getItem(KEY);
        if (seen && seen !== sha) setShow(true);
        localStorage.setItem(KEY, sha);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 top-16 z-[60] flex justify-center px-3">
      <div className="flex max-w-xl items-center gap-3 rounded-full border border-brand/40 bg-bg-primary/95 px-4 py-2 text-sm shadow-xl">
        <p className="text-text-primary">BVS updated. Refresh to leave a stale page.</p>
        <button
          type="button"
          className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-black"
          onClick={() => window.location.reload()}
        >
          Refresh
        </button>
        <button
          type="button"
          className="text-xs text-text-secondary hover:text-text-primary"
          onClick={() => setShow(false)}
        >
          Later
        </button>
      </div>
    </div>
  );
}
