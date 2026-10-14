"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SignalPayload = {
  available: boolean;
  trackId: string;
  status: "selected" | "first_spin_scheduled" | "first_spin" | "in_rotation" | "rising" | "breakout";
  label: string;
  inRotation: boolean;
  rotationAddedAt: string | null;
  firstSpinScheduledAt: string | null;
  firstSpinPlayedAt: string | null;
  editorialReason: string | null;
  breakoutAt: string | null;
  catchCount: number;
  caught: boolean;
  caughtAt: string | null;
  catchPosition: number | null;
};

type SignalSource = "station" | "song" | "share" | "explore";

function displayTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusTone(status: SignalPayload["status"]) {
  if (status === "breakout") return "border-brand/35 bg-brand/10 text-brand";
  if (status === "rising") return "border-emerald-300/25 bg-emerald-300/[.08] text-emerald-200";
  if (status === "first_spin" || status === "first_spin_scheduled") return "border-violet-300/25 bg-violet-300/[.08] text-violet-200";
  return "border-white/15 bg-white/[.05] text-white/75";
}

export default function BvsSignalPanel({
  trackId,
  source,
  compact = false,
}: {
  trackId?: string;
  source: SignalSource;
  compact?: boolean;
}) {
  const [signal, setSignal] = useState<SignalPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!trackId || !UUID.test(trackId)) {
      setSignal(null);
      return;
    }
    let token = "";
    if (isSupabaseConfigured()) {
      const { data } = await createClient().auth.getSession();
      token = data.session?.access_token || "";
    }
    const response = await fetch(`/api/signal/tracks/${encodeURIComponent(trackId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
    }).catch(() => null);
    if (!response?.ok) {
      setSignal(null);
      return;
    }
    setSignal((await response.json()) as SignalPayload);
  }, [trackId]);

  useEffect(() => {
    void load();
  }, [load]);

  const catchTrack = async () => {
    if (!trackId || busy || !isSupabaseConfigured()) return;
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/auth/login?next=${encodeURIComponent(next)}`);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/signal/tracks/${encodeURIComponent(trackId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ source }),
      });
      const payload = await response.json().catch(() => ({})) as SignalPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not Catch this track.");
      setSignal(payload);
      trackEvent("bvs_signal_catch", { track_id: trackId, source, catch_position: payload.catchPosition });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not Catch this track.");
    } finally {
      setBusy(false);
    }
  };

  if (!signal) return null;

  const caughtLabel = signal.catchPosition ? `Caught #${signal.catchPosition}` : "Caught on BVS";
  const scheduledIsFuture = Boolean(signal.firstSpinScheduledAt && new Date(signal.firstSpinScheduledAt).getTime() > Date.now());

  return (
    <section
      data-bvs-signal={signal.status}
      className={compact
        ? "mt-4 border-t border-white/10 pt-4"
        : "mt-6 rounded-2xl border border-white/10 bg-white/[.025] p-4 sm:p-5"}
      aria-label="BVS Signal"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[.15em] ${statusTone(signal.status)}`}>
          {signal.label}
        </span>
        {signal.available && signal.catchCount > 0 ? (
          <span className="text-xs text-white/50">{signal.catchCount} {signal.catchCount === 1 ? "Catch" : "Catches"}</span>
        ) : null}
      </div>

      {signal.firstSpinPlayedAt ? (
        <p className="mt-2 text-xs text-white/55">First played on BVS · {displayTime(signal.firstSpinPlayedAt)}</p>
      ) : scheduledIsFuture && signal.firstSpinScheduledAt ? (
        <p className="mt-2 text-xs text-white/55">First Spin scheduled · {displayTime(signal.firstSpinScheduledAt)}</p>
      ) : null}

      {!compact && signal.editorialReason ? (
        <div className="mt-4 border-l-2 border-brand/50 pl-3">
          <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-brand">Why BVS selected it</p>
          <p className="mt-1.5 text-sm leading-relaxed text-white/78">{signal.editorialReason}</p>
        </div>
      ) : null}

      {signal.available ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={catchTrack}
            disabled={busy || signal.caught}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition ${signal.caught ? "border-brand/30 bg-brand/10 text-brand" : "border-white/18 bg-white/[.04] text-white hover:border-brand/45 hover:text-brand"} disabled:cursor-default`}
          >
            {signal.caught ? `◎ ${caughtLabel}` : busy ? "Catching…" : "◎ Catch"}
          </button>
          <span className="max-w-md text-xs leading-relaxed text-white/45">
            {signal.caught ? "Your discovery time is saved." : "Mark that you discovered this here. Catch never decides editorial rotation."}
          </span>
        </div>
      ) : null}
      {message ? <p className="mt-2 text-xs text-red-200">{message}</p> : null}
    </section>
  );
}
