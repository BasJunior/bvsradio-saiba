"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type ShowInfo = {
  slug: string;
  title: string;
  host: string;
  artwork: string;
  schedule: string;
  description: string;
};
type LiveInfo = {
  id: string | null;
  title: string | null;
  status: string;
  phase: "starting_soon" | "live" | "reconnecting" | "ended" | "offline";
  hlsUrl?: string | null;
  replayUrl?: string | null;
  health?: string | null;
  bitrateKbps?: number | null;
  hlsAvailable?: boolean;
  audioDetected?: boolean;
  videoDetected?: boolean;
  viewerCount: number;
};
type Payload = { show: ShowInfo; live: LiveInfo };

function label(phase: LiveInfo["phase"]) {
  if (phase === "live") return "LIVE";
  if (phase === "reconnecting") return "Reconnecting";
  if (phase === "starting_soon") return "Starting soon";
  if (phase === "ended") return "Ended";
  return "Offline";
}

function viewerSessionId() {
  const key = "bvs-live-viewer-session";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const value = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `viewer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(key, value);
  return value;
}

export default function LiveShowViewer({ slug, fallbackShow }: { slug: string; fallbackShow: ShowInfo }) {
  const [payload, setPayload] = useState<Payload>({
    show: fallbackShow,
    live: { id: null, title: null, status: "offline", phase: "offline", viewerCount: 0 },
  });
  const [latency, setLatency] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/live/public/${encodeURIComponent(slug)}`, { cache: "no-store" });
    const next = await response.json();
    if (response.ok) setPayload(next);
  }, [slug]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const live = payload.live;
    if (!live.id || !["live", "reconnecting"].includes(live.phase)) return;
    const heartbeat = async () => {
      await fetch(`/api/live/public/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broadcastId: live.id, sessionId: viewerSessionId() }),
      }).catch(() => null);
    };
    void heartbeat();
    const timer = window.setInterval(() => void heartbeat(), 15000);
    return () => window.clearInterval(timer);
  }, [payload.live, slug]);

  function measureLatency() {
    const video = videoRef.current;
    if (!video || !video.seekable.length) return;
    const edge = video.seekable.end(video.seekable.length - 1);
    setLatency(Math.max(0, Math.round(edge - video.currentTime)));
  }

  const { show, live } = payload;
  const videoVisible = ["live", "reconnecting"].includes(live.phase) && Boolean(live.hlsUrl);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link href={`/shows/${show.slug}`} className="text-sm text-brand hover:underline">← Back to show</Link>
      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black">
        {videoVisible ? (
          <video
            ref={videoRef}
            controls
            playsInline
            autoPlay
            className="aspect-video w-full bg-black"
            src={live.hlsUrl || undefined}
            onCanPlay={measureLatency}
            onTimeUpdate={measureLatency}
          />
        ) : (
          <div className="grid aspect-video place-items-center px-6 text-center">
            <div>
              <span className="rounded-full border border-white/15 px-3 py-1 text-xs">{label(live.phase)}</span>
              <h1 className="mt-5 text-3xl font-semibold">{live.title || show.title}</h1>
              <p className="mt-2 text-text-secondary">{show.schedule}</p>
            </div>
          </div>
        )}
      </div>
      <section className="mt-5 rounded-2xl border border-white/10 bg-white/[.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">{label(live.phase)}</p>
            <h1 className="mt-2 text-3xl font-semibold">{live.title || show.title}</h1>
            <p className="mt-2 text-text-secondary">{show.host}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-text-secondary">
            <span className="rounded-full border border-white/10 px-3 py-1">{live.viewerCount} viewers</span>
            <span className="rounded-full border border-white/10 px-3 py-1">Health: {live.health || "waiting"}</span>
            <span className="rounded-full border border-white/10 px-3 py-1">Audio: {live.audioDetected ? "yes" : "no"}</span>
            <span className="rounded-full border border-white/10 px-3 py-1">Video: {live.videoDetected ? "yes" : "no"}</span>
            <span className="rounded-full border border-white/10 px-3 py-1">HLS: {live.hlsAvailable ? "ready" : "waiting"}</span>
            <span className="rounded-full border border-white/10 px-3 py-1">Latency: {latency === null ? "—" : `${latency}s`}</span>
          </div>
        </div>
        <p className="mt-5 text-sm text-text-secondary">{show.description}</p>
        {live.phase === "ended" && live.replayUrl ? (
          <a href={live.replayUrl} className="mt-5 inline-flex rounded-full bg-brand px-4 py-2 font-semibold text-black">Watch replay</a>
        ) : null}
      </section>
    </main>
  );
}
