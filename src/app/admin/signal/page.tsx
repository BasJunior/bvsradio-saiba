
"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";
import type { BvsSignalPayload } from "@/lib/bvs-signal";

type Track = { id: string; title: string; artist_name: string; in_rotation: boolean; signal: BvsSignalPayload };
function localInput(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function when(value: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not scheduled";
}
function TrackCard({ track, busy, act }: {
  track: Track; busy: boolean;
  act: (track: Track, values: Record<string, unknown>) => Promise<void>;
}) {
  const s = track.signal;
  const [scheduled, setScheduled] = useState(localInput(s.firstSpinScheduledAt));
  const [reason, setReason] = useState(s.editorialReason || "");
  return (
    <article className="flex flex-col border border-white/15 bg-white/[.025] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-brand">{s.label}</p>
      <h2 className="mt-2 text-xl font-semibold">{track.title}</h2>
      <p className="mt-1 text-sm text-white/55">{track.artist_name} · {track.in_rotation ? "In rotation" : "Not in rotation"}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 border-y border-white/10 py-3 text-xs">
        <p><strong className="block text-lg text-white">{s.catchCount}</strong><span className="text-white/50">Catches total</span></p>
        <p><strong className="block text-lg text-white">{s.recentCatchCount}</strong><span className="text-white/50">Last 7 days · {s.previousCatchCount} previous</span></p>
      </div>
      <div className="mt-4 border-l-2 border-violet-300/50 pl-3 text-xs leading-relaxed text-white/65">
        {s.firstSpinPlayedAt
          ? <p><strong className="text-white">First Spin proved:</strong> {when(s.firstSpinPlayedAt)} · verified playout acknowledgement.</p>
          : <p><strong className="text-amber-200">No broadcast proof yet.</strong> {s.status === "awaiting_first_spin" ? "Scheduled time passed; still waiting for the playout service." : "Browser listening never proves a broadcast."}</p>}
      </div>
      <label className="mt-5 text-sm">First Spin announcement time
        <input type="datetime-local" value={scheduled} onChange={e => setScheduled(e.target.value)}
          className="mt-2 w-full border border-white/15 bg-black/20 p-3 text-sm" />
        <span className="mt-2 block text-xs text-white/45">Your local time zone. An announcement does not schedule the broadcaster or prove playback.</span>
      </label>
      <label className="mt-5 text-sm">Why BVS selected it
        <textarea value={reason} maxLength={500} onChange={e => setReason(e.target.value)}
          placeholder="What made you stop and listen? Give this selection a human reason."
          className="mt-2 min-h-24 w-full border border-white/15 bg-black/20 p-3 text-sm" />
        <span className="mt-1 block text-right text-xs text-white/45">{reason.length}/500 · public on the song page</span>
      </label>
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <button type="button" disabled={busy || Boolean(scheduled && !reason.trim())}
          onClick={() => void act(track, { action: "set_track_signal", firstSpinScheduledAt: scheduled ? new Date(scheduled).toISOString() : null, editorialReason: reason })}
          className="min-h-11 bg-brand px-4 text-sm font-semibold text-black disabled:opacity-40">Save selection</button>
        <button type="button" disabled={busy || (!s.breakoutAt && (!s.firstSpinPlayedAt || !s.editorialReason))}
          onClick={() => void act(track, { action: "set_track_breakout", breakout: !s.breakoutAt })}
          className="min-h-11 border border-white/20 px-4 text-sm disabled:opacity-40">{s.breakoutAt ? "Remove Breakout" : "Award Breakout"}</button>
        <Link href={`/song/${track.id}`} className="inline-flex min-h-11 items-center px-2 text-sm text-brand">Listener view ↗</Link>
      </div>
      {!s.breakoutAt && (!s.firstSpinPlayedAt || !s.editorialReason) && <p className="mt-2 text-xs text-white/45">Breakout needs a saved editorial reason and verified First Spin. Catch totals never award it.</p>}
    </article>
  );
}
export default function SignalEditorialPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState("");
  const token = useCallback(async () => {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");
    const value = (await createClient().auth.getSession()).data.session?.access_token;
    if (!value) throw new Error("Sign in with a BVS editorial account.");
    return value;
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const accessToken = await token();
        if (controller.signal.aborted) return;
        const response = await fetch(`/api/admin/signal?page=${page}`, {
          headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: controller.signal,
        });
        const body = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) throw new Error(body.error || "Could not load Signal.");
        setTracks(body.tracks); setHasMore(body.hasMore); setConfigured(body.playoutConfigured);
      } catch (caught) {
        if (!controller.signal.aborted) { setTracks([]); setError(caught instanceof Error ? caught.message : "Could not load Signal."); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [page, refresh, token]);
  const act = async (track: Track, values: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/signal", {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ ...values, trackId: track.id, revision: track.signal.revision }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not save Signal.");
      setMessage("Saved with editorial audit history."); setLoading(true); setRefresh(v => v + 1);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Save failed."); }
    finally { setBusy(false); }
  };
  const shown = tracks.filter(t => `${t.title} ${t.artist_name}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[.2em] text-brand">BVS Editorial · Signal</p>
      <h1 className="mt-2 text-4xl font-semibold">Give a song its next chapter.</h1>
      <p className="mt-3 max-w-2xl text-white/60">Explain the selection. Announce its First Spin. Verify the broadcast. Recognise a Breakout. The audience keeps its own discovery receipts.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/admin/editorial" className="inline-flex min-h-11 items-center border border-white/15 px-4 text-sm">Editorial workflow →</Link>
        <button type="button" disabled={busy || loading} onClick={() => { setLoading(true); setError(""); setRefresh(v => v + 1); }} className="min-h-11 border border-white/15 px-4 text-sm disabled:opacity-40">Refresh desk</button>
      </div>
      {!loading && <p className={`mt-5 border p-4 text-xs ${configured ? "border-white/15 text-white/55" : "border-amber-300/25 text-amber-100"}`}>
        {configured ? "Signed playout ingress is configured. Only actual acknowledgements prove a First Spin; configuration alone does not prove the broadcaster is connected."
          : "Playout proof is not configured. Catch and editorial selection work, but no First Spin can be verified until the broadcaster is connected."}
      </p>}
      {error && <p role="alert" className="mt-5 border border-red-300/30 p-4 text-sm text-red-200">{error}</p>}
      {message && <p role="status" className="mt-5 text-sm text-brand">{message}</p>}
      <label className="mt-6 block text-xs text-white/55">Filter this page by song or artist
        <input value={query} onChange={e => setQuery(e.target.value)} className="mt-2 block w-full max-w-md border border-white/15 bg-black/20 p-3 text-sm" />
      </label>
      {loading ? <p className="mt-8 text-white/50">Loading Signal desk…</p> : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">{shown.map(track => <TrackCard key={`${track.id}:${track.signal.revision}`} track={track} busy={busy} act={act} />)}</div>
      )}
      {!loading && !shown.length && !error && <p className="mt-8 text-white/50">No matching public, approved tracks on this page.</p>}
      <nav aria-label="Signal pages" className="mt-8 flex items-center gap-4">
        <button disabled={!page || loading || busy} onClick={() => { setLoading(true); setError(""); setPage(v => v - 1); }} className="min-h-11 border border-white/15 px-4 disabled:opacity-30">Previous</button>
        <span className="text-xs text-white/50">Page {page + 1}</span>
        <button disabled={!hasMore || loading || busy} onClick={() => { setLoading(true); setError(""); setPage(v => v + 1); }} className="min-h-11 border border-white/15 px-4 disabled:opacity-30">Next</button>
      </nav>
    </main>
  );
}
