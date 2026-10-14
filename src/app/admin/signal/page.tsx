"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

type SignalTrack = {
  id: string;
  title: string;
  artist_name: string;
  artwork_url?: string | null;
  in_rotation?: boolean | null;
  rotation_added_at?: string | null;
  signal: {
    available: boolean;
    status: string;
    label: string;
    first_spin_scheduled_at: string | null;
    first_spin_played_at: string | null;
    editorial_reason: string | null;
    breakout_at: string | null;
    catch_count: number;
  };
};

function toLocalInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function SignalTrackCard({ track, busy, act }: {
  track: SignalTrack;
  busy: string;
  act: (action: string, trackId: string, values?: Record<string, unknown>) => Promise<void>;
}) {
  const [firstSpinScheduledAt, setFirstSpinScheduledAt] = useState(toLocalInput(track.signal.first_spin_scheduled_at));
  const [reason, setReason] = useState(track.signal.editorial_reason || "");
  const working = busy === track.id;

  useEffect(() => {
    setFirstSpinScheduledAt(toLocalInput(track.signal.first_spin_scheduled_at));
    setReason(track.signal.editorial_reason || "");
  }, [track.signal.first_spin_scheduled_at, track.signal.editorial_reason]);

  const schedulePassedWithoutProof = Boolean(
    track.signal.first_spin_scheduled_at &&
    !track.signal.first_spin_played_at &&
    Date.parse(track.signal.first_spin_scheduled_at) <= Date.now(),
  );

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[.025] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-brand/30 bg-brand/[.08] px-3 py-1 text-[10px] font-semibold uppercase tracking-[.15em] text-brand">
              {track.signal.label}
            </span>
            <span className="text-xs text-text-secondary">{track.signal.catch_count} {track.signal.catch_count === 1 ? "Catch" : "Catches"}</span>
          </div>
          <h2 className="mt-3 truncate text-xl font-semibold">{track.title}</h2>
          <p className="mt-1 truncate text-sm text-text-secondary">{track.artist_name}</p>
          <p className="mt-2 text-xs text-text-secondary">
            {track.in_rotation ? "In station rotation" : "Published · not currently in rotation"}
          </p>
        </div>
        {track.signal.breakout_at ? (
          <span className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-black">BVS Breakout</span>
        ) : null}
      </div>

      <div className="mt-5 rounded-xl border border-white/10 bg-black/15 p-3 text-xs text-text-secondary">
        {track.signal.first_spin_played_at ? (
          <p><span className="font-semibold text-text-primary">First Spin proved:</span> {formatDate(track.signal.first_spin_played_at)} · from the earliest recorded station play.</p>
        ) : schedulePassedWithoutProof ? (
          <p className="text-amber-200"><span className="font-semibold">Scheduled time passed:</span> waiting for an actual station play before BVS displays “First Spin”.</p>
        ) : track.signal.first_spin_scheduled_at ? (
          <p><span className="font-semibold text-text-primary">Scheduled:</span> {formatDate(track.signal.first_spin_scheduled_at)} · public status remains scheduled until station playback is recorded.</p>
        ) : (
          <p>No First Spin scheduled yet.</p>
        )}
      </div>

      <div className="mt-5 grid gap-4">
        <label className="text-sm font-medium">
          First Spin schedule
          <input
            type="datetime-local"
            value={firstSpinScheduledAt}
            onChange={(event) => setFirstSpinScheduledAt(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none focus:border-brand"
          />
          <span className="mt-1.5 block text-xs font-normal text-text-secondary">
            This schedules the moment only. “First Spin” is derived from recorded station playback, never from this clock value.
          </span>
        </label>
        <label className="text-sm font-medium">
          Why BVS selected it
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value.slice(0, 500))}
            maxLength={500}
            placeholder="One public editorial sentence that gives the selection authorship."
            className="mt-1.5 min-h-24 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none focus:border-brand"
          />
          <span className="mt-1.5 block text-right text-xs font-normal text-text-secondary">{reason.length}/500</span>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={working}
          onClick={() => act("set_track_signal", track.id, {
            firstSpinScheduledAt: firstSpinScheduledAt ? new Date(firstSpinScheduledAt).toISOString() : null,
            editorialReason: reason,
          })}
          className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-black disabled:opacity-40"
        >
          {working ? "Saving…" : "Save Signal"}
        </button>
        <button
          type="button"
          disabled={working}
          onClick={() => act("set_track_breakout", track.id, { breakout: !track.signal.breakout_at })}
          className="min-h-11 rounded-full border border-white/15 px-5 text-sm font-semibold disabled:opacity-40"
        >
          {track.signal.breakout_at ? "Remove Breakout" : "Mark BVS Breakout"}
        </button>
        <Link href={`/song/${encodeURIComponent(track.id)}`} className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-brand">
          Open listener page →
        </Link>
      </div>
    </article>
  );
}

export default function SignalEditorialPage() {
  const [token, setToken] = useState("");
  const [tracks, setTracks] = useState<SignalTrack[]>([]);
  const [signalAvailable, setSignalAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (accessToken: string) => {
    const response = await fetch("/api/admin/signal", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({})) as { tracks?: SignalTrack[]; signalAvailable?: boolean; error?: string };
    if (!response.ok) throw new Error(payload.error || "Could not load BVS Signal.");
    setTracks(Array.isArray(payload.tracks) ? payload.tracks : []);
    setSignalAvailable(payload.signalAvailable !== false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }
    let active = true;
    const boot = async () => {
      try {
        const { data } = await createClient().auth.getSession();
        const accessToken = data.session?.access_token || "";
        if (!accessToken) throw new Error("Sign in with a BVS editorial account.");
        if (!active) return;
        setToken(accessToken);
        await load(accessToken);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load BVS Signal.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void boot();
    return () => { active = false; };
  }, [load]);

  const act = async (action: string, trackId: string, values: Record<string, unknown> = {}) => {
    if (!token) return;
    setBusy(trackId);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/signal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, trackId, ...values }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Signal update failed.");
      await load(token);
      setMessage(action === "set_track_breakout" ? "Breakout state updated." : "First Spin schedule and editorial Signal saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Signal update failed.");
    } finally {
      setBusy("");
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">BVS Editorial · Signal</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">First Spin desk</h1>
          <p className="mt-3 max-w-2xl text-text-secondary">
            Turn publication into a visible journey: schedule the first spin, give the selection a human reason, verify the real station play, watch Catches accumulate, and deliberately confer Breakout status.
          </p>
        </div>
        <Link href="/admin/editorial" className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold">Editorial workflow →</Link>
      </div>

      {!signalAvailable ? (
        <p className="mt-6 rounded-xl border border-amber-300/25 bg-amber-300/[.08] p-4 text-sm text-amber-100">
          BVS Signal database objects are not available yet. Apply <code>supabase-bvs-signal.sql</code> after the final-sprint core migration before using this desk.
        </p>
      ) : null}
      {error ? <p className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p> : null}
      {message ? <p className="mt-6 rounded-xl border border-emerald-300/20 bg-emerald-300/[.06] p-4 text-sm text-emerald-100">{message}</p> : null}

      {loading ? (
        <p className="mt-10 text-text-secondary">Loading Signal desk…</p>
      ) : tracks.length ? (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {tracks.map((track) => <SignalTrackCard key={track.id} track={track} busy={busy} act={act} />)}
        </div>
      ) : !error ? (
        <p className="mt-10 rounded-2xl border border-white/10 bg-white/[.02] p-6 text-text-secondary">No published approved tracks are available for Signal yet.</p>
      ) : null}
    </main>
  );
}
