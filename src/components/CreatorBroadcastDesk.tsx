"use client";

import { useCallback, useEffect, useState } from "react";

type Show = { id: string; title?: string; slug?: string; status?: string };
type Broadcast = {
  id: string;
  show_id: string;
  title: string;
  status: string;
  scheduled_for?: string | null;
  rtmp_server: string;
  stream_key_preview?: string | null;
  last_signal_at?: string | null;
  audio_detected?: boolean;
  video_detected?: boolean;
  health_status?: string | null;
  playback_url?: string | null;
  current_publisher?: string | null;
  bitrate_kbps?: number | null;
  hls_available?: boolean | null;
  hls_url?: string | null;
  replay_url?: string | null;
  viewer_count?: number | null;
  last_publish_at?: string | null;
  last_unpublish_at?: string | null;
};
type Payload = {
  setupRequired?: boolean;
  liveServer: string;
  playbackOrigin: string;
  shows: Show[];
  broadcasts: Broadcast[];
};

const pill = "rounded-full border border-white/10 px-3 py-1 text-xs";

function statusLabel(broadcast: Broadcast) {
  if (broadcast.status === "live") return "LIVE";
  if (broadcast.status === "armed") return "Waiting for OBS";
  if (broadcast.status === "rehearsal") return "Rehearsal";
  if (broadcast.status === "signal_detected") return "Signal detected";
  if (broadcast.status === "signal_lost") return "Signal lost";
  return broadcast.status.replaceAll("_", " ");
}

function liveDuration(broadcast: Broadcast) {
  if (!broadcast.last_publish_at) return "not started";
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(broadcast.last_publish_at)) / 1000),
  );
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default function CreatorBroadcastDesk({ token }: { token: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revealedKey, setRevealedKey] = useState("");
  const [form, setForm] = useState({
    showId: "",
    title: "",
    scheduledFor: "",
  });

  const load = useCallback(async () => {
    if (!token) return;
    const response = await fetch("/api/creator/broadcast", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Broadcast unavailable.");
    setData(payload);
    if (!form.showId && payload.shows?.[0]?.id) {
      setForm((current) => ({ ...current, showId: payload.shows[0].id }));
    }
  }, [form.showId, token]);

  useEffect(() => {
    queueMicrotask(() => {
      void load().catch((err) =>
        setError(err instanceof Error ? err.message : "Broadcast unavailable."),
      );
    });
    const timer = window.setInterval(() => {
      void load().catch(() => null);
    }, 10000);
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
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Broadcast action failed.");
    if (payload.streamKey) setRevealedKey(payload.streamKey);
    await load();
    return payload;
  }

  if (error && !data)
    return (
      <div className="mt-5 rounded-xl border border-amber-300/30 p-5 text-amber-100">
        {error}
      </div>
    );

  return (
    <div className="mt-5 space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        {["Profile", "Shows", "Broadcast", "Prepare Live"].map((step, index) => (
          <div key={step} className="rounded-xl border border-white/10 p-4">
            <p className="text-xs uppercase tracking-[.14em] text-text-secondary">
              Step {index + 1}
            </p>
            <p className="mt-2 font-semibold">{step}</p>
          </div>
        ))}
      </div>

      {data?.setupRequired ? (
        <p className="rounded-xl border border-amber-300/30 p-4 text-amber-100">
          Broadcast tables are not installed yet. Run
          `supabase-bvs-live-beta.sql` on staging before live prep can persist.
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-brand/30 p-4 text-brand">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-300/30 p-4 text-red-100">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void post({ action: "prepare_live", mode: "live", ...form }).catch((err) =>
            setError(err instanceof Error ? err.message : "Could not prepare live."),
          );
        }}
        className="grid gap-3 rounded-xl border border-white/10 p-5 md:grid-cols-2"
      >
        <select
          value={form.showId}
          onChange={(event) => setForm({ ...form, showId: event.target.value })}
          className="rounded-xl border border-white/10 bg-bg-primary p-3"
        >
          {(data?.shows || []).map((show) => (
            <option key={show.id} value={show.id}>
              {show.title || show.slug || show.id}
            </option>
          ))}
        </select>
        <input
          required
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="Broadcast title"
          className="rounded-xl border border-white/10 bg-black/20 p-3"
        />
        <input
          type="datetime-local"
          value={form.scheduledFor}
          onChange={(event) =>
            setForm({ ...form, scheduledFor: event.target.value })
          }
          className="rounded-xl border border-white/10 bg-black/20 p-3"
        />
        <button className="rounded-xl bg-brand px-5 py-3 font-semibold text-black">
          Prepare Live
        </button>
        <button
          type="button"
          onClick={() =>
            void post({ action: "prepare_live", mode: "rehearsal", ...form }).catch(
              (err) =>
                setError(
                  err instanceof Error ? err.message : "Could not start rehearsal.",
                ),
            )
          }
          className="rounded-xl border border-brand/40 px-5 py-3 font-semibold text-brand"
        >
          Start Rehearsal
        </button>
      </form>

      {revealedKey ? (
        <div className="rounded-xl border border-brand/30 p-5">
          <p className="text-xs uppercase tracking-[.14em] text-brand">
            New stream key
          </p>
          <p className="mt-2 break-all font-mono text-sm">{revealedKey}</p>
          <button
            type="button"
            onClick={() => void copy(revealedKey, "Stream key")}
            className="mt-3 rounded-full border border-brand/40 px-4 py-2 text-sm text-brand"
          >
            Copy key
          </button>
        </div>
      ) : null}

      <div className="grid gap-4">
        {(data?.broadcasts || []).map((broadcast) => (
          <article key={broadcast.id} className="rounded-xl border border-white/10 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{broadcast.title}</h3>
                <p className="mt-1 text-sm text-text-secondary">
                  {broadcast.scheduled_for
                    ? new Date(broadcast.scheduled_for).toLocaleString()
                    : "No schedule set"}
                </p>
              </div>
              <span className={`${pill} ${broadcast.status === "live" ? "border-emerald-300/40 text-emerald-200" : "text-text-secondary"}`}>
                {statusLabel(broadcast)}
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="rounded-xl bg-black/20 p-3">
                <p className="text-xs uppercase tracking-[.14em] text-text-secondary">
                  OBS server
                </p>
                <p className="mt-2 break-all font-mono text-sm">
                  {broadcast.rtmp_server}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copy(broadcast.rtmp_server, "OBS server")}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm"
              >
                Copy server
              </button>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="rounded-xl bg-black/20 p-3">
                <p className="text-xs uppercase tracking-[.14em] text-text-secondary">
                  Stream key
                </p>
                <p className="mt-2 font-mono text-sm">
                  {broadcast.stream_key_preview || "Only shown after rotation"}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  void post({
                    action: "rotate_key",
                    broadcastId: broadcast.id,
                  }).catch((err) =>
                    setError(
                      err instanceof Error ? err.message : "Could not rotate key.",
                    ),
                  )
                }
                className="rounded-xl border border-white/15 px-4 py-2 text-sm"
              >
                Rotate key
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className={pill}>
                Health: {broadcast.health_status || "waiting"}
              </span>
              <span className={pill}>
                HLS: {broadcast.hls_available ? "available" : "not ready"}
              </span>
              <span className={pill}>
                Bitrate: {broadcast.bitrate_kbps ? `${broadcast.bitrate_kbps} kbps` : "none"}
              </span>
              <span className={pill}>
                Viewers: {broadcast.viewer_count || 0}
              </span>
              <span className={pill}>
                Duration: {liveDuration(broadcast)}
              </span>
              <span className={pill}>
                Audio: {broadcast.audio_detected ? "detected" : "not detected"}
              </span>
              <span className={pill}>
                Video: {broadcast.video_detected ? "detected" : "not detected"}
              </span>
              <span className={pill}>
                Signal:{" "}
                {broadcast.last_signal_at
                  ? new Date(broadcast.last_signal_at).toLocaleTimeString()
                  : "none"}
              </span>
            </div>

            <div className="mt-3 grid gap-2 text-xs text-text-secondary md:grid-cols-2">
              <p>Publisher: {broadcast.current_publisher || "none"}</p>
              <p>
                Last publish:{" "}
                {broadcast.last_publish_at
                  ? new Date(broadcast.last_publish_at).toLocaleString()
                  : "none"}
              </p>
              <p>
                Last unpublish:{" "}
                {broadcast.last_unpublish_at
                  ? new Date(broadcast.last_unpublish_at).toLocaleString()
                  : "none"}
              </p>
            </div>

            {broadcast.playback_url ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <a
                  href={broadcast.playback_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-brand/40 px-4 py-2 text-sm text-brand"
                >
                  Open watch page
                </a>
                <p className="break-all text-xs text-text-secondary">
                  {broadcast.playback_url}
                </p>
              </div>
            ) : null}

            {broadcast.hls_url ? (
              <p className="mt-3 break-all text-xs text-text-secondary">
                HLS source: {broadcast.hls_url}
              </p>
            ) : null}

            {broadcast.status !== "ended" ? (
              <button
                type="button"
                onClick={() =>
                  void post({ action: "end_live", broadcastId: broadcast.id }).catch(
                    (err) =>
                      setError(
                        err instanceof Error ? err.message : "Could not end live.",
                      ),
                  )
                }
                className="mt-4 rounded-full border border-red-300/40 px-4 py-2 text-sm text-red-100"
              >
                End live
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
