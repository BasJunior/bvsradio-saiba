"use client";

import { useCallback, useEffect, useState } from "react";

type Show = { id: string; title?: string; slug?: string };
type Broadcast = {
  id: string;
  title: string;
  status: string;
  scheduled_for?: string | null;
  rtmp_server: string;
  stream_key_preview?: string | null;
  last_signal_at?: string | null;
  last_publish_at?: string | null;
  audio_detected?: boolean;
  video_detected?: boolean;
  hls_available?: boolean;
  health_status?: string | null;
  playback_url?: string | null;
  bitrate_kbps?: number | null;
  viewer_count?: number | null;
};
type Payload = {
  setupRequired?: boolean;
  mediaOriginReady?: boolean;
  shows: Show[];
  broadcasts: Broadcast[];
};

const pill = "rounded-full border border-white/10 px-3 py-1 text-xs";

function statusLabel(status: string) {
  if (status === "live") return "LIVE";
  if (status === "armed") return "Waiting for OBS";
  if (status === "signal_detected") return "Signal detected";
  if (status === "signal_lost") return "Signal lost";
  if (status === "rehearsal") return "Rehearsal";
  return status.replaceAll("_", " ");
}

export default function CreatorBroadcastDesk({ token }: { token: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revealedKey, setRevealedKey] = useState("");
  const [form, setForm] = useState({ showId: "", title: "", scheduledFor: "" });

  const load = useCallback(async () => {
    if (!token) return;
    const response = await fetch("/api/creator/broadcast", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Broadcast unavailable.");
    setData(payload);
    setForm((current) =>
      current.showId || !payload.shows?.[0]?.id
        ? current
        : { ...current, showId: payload.shows[0].id },
    );
  }, [token]);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Broadcast unavailable."));
    const timer = window.setInterval(() => void load().catch(() => null), 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setMessage(`${label} copied.`);
  }

  async function post(body: Record<string, unknown>) {
    setError("");
    setMessage("");
    const response = await fetch("/api/creator/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Broadcast action failed.");
    if (payload.streamKey) setRevealedKey(payload.streamKey);
    await load();
  }

  if (error && !data) {
    return <p className="rounded-xl border border-red-300/30 p-4 text-red-100">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Broadcast control</p>
        <h2 className="mt-2 text-3xl font-semibold">Prepare OBS broadcast</h2>
        <p className="mt-2 max-w-3xl text-sm text-text-secondary">
          Prepare the broadcast here, then start streaming in OBS. BVS becomes LIVE only after the media server confirms a valid publisher, media and HLS output.
        </p>
      </div>

      {data?.setupRequired ? (
        <p className="rounded-xl border border-amber-300/30 p-4 text-amber-100">The live database is not ready.</p>
      ) : null}
      {data && !data.mediaOriginReady ? (
        <p className="rounded-xl border border-amber-300/30 bg-amber-400/5 p-4 text-amber-100">
          The BVS media origin is not connected yet. Your show is ready, but Prepare Live stays disabled until the RTMP/SRS origin is configured.
        </p>
      ) : null}
      {message ? <p className="rounded-xl border border-brand/30 p-4 text-brand">{message}</p> : null}
      {error ? <p className="rounded-xl border border-red-300/30 p-4 text-red-100">{error}</p> : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void post({ action: "prepare_live", mode: "live", ...form }).catch((err) =>
            setError(err instanceof Error ? err.message : "Could not prepare live."),
          );
        }}
        className="grid gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-5 md:grid-cols-2"
      >
        <label className="grid gap-2 text-sm">
          <span className="text-text-secondary">Show</span>
          <select
            value={form.showId}
            onChange={(event) => setForm({ ...form, showId: event.target.value })}
            className="rounded-xl border border-white/10 bg-bg-primary p-3"
          >
            {(data?.shows || []).map((show) => (
              <option key={show.id} value={show.id}>{show.title || show.slug || show.id}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          <span className="text-text-secondary">Broadcast title</span>
          <input
            required
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="Bas Junior Live"
            className="rounded-xl border border-white/10 bg-black/20 p-3"
          />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="text-text-secondary">Scheduled time (optional)</span>
          <input
            type="datetime-local"
            value={form.scheduledFor}
            onChange={(event) => setForm({ ...form, scheduledFor: event.target.value })}
            className="rounded-xl border border-white/10 bg-black/20 p-3"
          />
        </label>
        <button
          disabled={!data?.mediaOriginReady || !form.showId || !form.title.trim()}
          className="self-end rounded-xl bg-brand px-5 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          Prepare Live
        </button>
      </form>

      {revealedKey ? (
        <div className="rounded-2xl border border-brand/30 p-5">
          <p className="text-xs uppercase tracking-[.14em] text-brand">Stream key — shown for this session</p>
          <p className="mt-2 break-all font-mono text-sm">{revealedKey}</p>
          <button onClick={() => void copy(revealedKey, "Stream key")} className="mt-3 rounded-full border border-brand/40 px-4 py-2 text-sm text-brand">Copy key</button>
        </div>
      ) : null}

      <div className="grid gap-4">
        {(data?.broadcasts || []).map((broadcast) => (
          <article key={broadcast.id} className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{broadcast.title}</h3>
                <p className="mt-1 text-sm text-text-secondary">{broadcast.scheduled_for ? new Date(broadcast.scheduled_for).toLocaleString() : "No schedule set"}</p>
              </div>
              <span className={`${pill} ${broadcast.status === "live" ? "border-emerald-300/40 text-emerald-200" : "text-text-secondary"}`}>{statusLabel(broadcast.status)}</span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="rounded-xl bg-black/20 p-3">
                <p className="text-xs uppercase tracking-[.14em] text-text-secondary">OBS server</p>
                <p className="mt-2 break-all font-mono text-sm">{broadcast.rtmp_server}</p>
              </div>
              <button onClick={() => void copy(broadcast.rtmp_server, "OBS server")} className="rounded-xl border border-white/15 px-4 py-2 text-sm">Copy server</button>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="rounded-xl bg-black/20 p-3">
                <p className="text-xs uppercase tracking-[.14em] text-text-secondary">Stream key</p>
                <p className="mt-2 font-mono text-sm">{broadcast.stream_key_preview || "Hidden"}</p>
              </div>
              <button
                disabled={!['ready','rehearsal','armed'].includes(broadcast.status)}
                onClick={() => void post({ action: "rotate_key", broadcastId: broadcast.id }).catch((err) => setError(err instanceof Error ? err.message : "Could not rotate key."))}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm disabled:opacity-40"
              >Rotate key</button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className={pill}>Health: {broadcast.health_status || "waiting"}</span>
              <span className={pill}>Audio: {broadcast.audio_detected ? "detected" : "not detected"}</span>
              <span className={pill}>Video: {broadcast.video_detected ? "detected" : "not detected"}</span>
              <span className={pill}>HLS: {broadcast.hls_available ? "available" : "not ready"}</span>
              <span className={pill}>Bitrate: {broadcast.bitrate_kbps ? `${broadcast.bitrate_kbps} kbps` : "none"}</span>
              <span className={pill}>Viewers: {broadcast.viewer_count || 0}</span>
              <span className={pill}>Signal: {broadcast.last_signal_at ? new Date(broadcast.last_signal_at).toLocaleTimeString() : "none"}</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              {broadcast.playback_url ? <a href={broadcast.playback_url} target="_blank" rel="noreferrer" className="rounded-full border border-brand/40 px-4 py-2 text-sm text-brand">Open watch page</a> : null}
              {broadcast.status !== "ended" ? (
                <button onClick={() => void post({ action: "end_live", broadcastId: broadcast.id }).catch((err) => setError(err instanceof Error ? err.message : "Could not end live."))} className="rounded-full border border-red-300/40 px-4 py-2 text-sm text-red-100">End live</button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
