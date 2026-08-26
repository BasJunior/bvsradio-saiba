"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";

type ShowInfo = {
  slug: string;
  title: string;
  host: string;
  artwork: string;
  schedule: string;
  description: string;
  tagline?: string;
};

type LiveInfo = {
  id: string | null;
  title: string | null;
  status: string;
  phase: "starting_soon" | "live" | "reconnecting" | "ended" | "offline";
  scheduledFor?: string | null;
  hlsUrl?: string | null;
  replayUrl?: string | null;
  health?: string | null;
  bitrateKbps?: number | null;
  hlsAvailable?: boolean;
  audioDetected?: boolean;
  videoDetected?: boolean;
  currentPublisher?: string | null;
  lastSignalAt?: string | null;
  lastPublishAt?: string | null;
  lastUnpublishAt?: string | null;
  viewerCount: number;
  chatKey?: string;
};

type LivePayload = {
  show: ShowInfo;
  live: LiveInfo;
};

type ChatMessage = {
  id: string;
  body: string;
  created_at: string;
  profiles?: { display_name?: string | null; username?: string | null } | null;
};

const pill = "rounded-full border border-white/10 px-3 py-1 text-xs";

function labelFor(phase: LiveInfo["phase"]) {
  if (phase === "live") return "LIVE";
  if (phase === "reconnecting") return "Reconnecting";
  if (phase === "starting_soon") return "Starting soon";
  if (phase === "ended") return "Ended";
  return "Offline";
}

function sessionId() {
  const key = "bvs-live-viewer-session";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `viewer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(key, created);
  return created;
}

function LiveChat({ chatKey }: { chatKey?: string }) {
  const [token, setToken] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [canPost, setCanPost] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (accessToken: string) => {
      if (!chatKey || !accessToken) return;
      const response = await fetch(
        `/api/community/messages?broadcastKey=${encodeURIComponent(chatKey)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Live chat unavailable.");
      setMessages(Array.isArray(payload.messages) ? payload.messages : []);
      setCanPost(Boolean(payload.access?.canPost));
      setError("");
    },
    [chatKey],
  );

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => {
      const accessToken = data.session?.access_token || "";
      setToken(accessToken);
      if (accessToken) void load(accessToken).catch((err) => setError(err.message));
    });
  }, [load]);

  useEffect(() => {
    if (!token) return;
    const timer = window.setInterval(() => {
      void load(token).catch(() => null);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [load, token]);

  async function send() {
    if (!token || !chatKey || !body.trim()) return;
    const response = await fetch("/api/community/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ broadcastKey: chatKey, body }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error || "Message was not sent.");
      return;
    }
    setBody("");
    await load(token);
  }

  return (
    <aside className="rounded-xl border border-white/10 bg-white/[.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Live Chat</h2>
        <span className={pill}>Moderated</span>
      </div>
      {!token ? (
        <p className="mt-4 text-sm text-text-secondary">
          Sign in to read and join live chat.
        </p>
      ) : (
        <>
          <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
            {messages.length ? (
              messages.map((message) => (
                <div key={message.id} className="rounded-lg bg-black/20 p-3">
                  <p className="text-xs text-text-secondary">
                    {message.profiles?.display_name ||
                      message.profiles?.username ||
                      "BVS member"}
                  </p>
                  <p className="mt-1 text-sm">{message.body}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-text-secondary">No chat messages yet.</p>
            )}
          </div>
          {error ? <p className="mt-3 text-sm text-red-200">{error}</p> : null}
          <div className="mt-4 grid gap-2">
            <input
              value={body}
              onChange={(event) => setBody(event.target.value)}
              disabled={!canPost}
              placeholder={canPost ? "Message the room" : "Premium or staff access required"}
              className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm disabled:opacity-60"
            />
            <button
              type="button"
              disabled={!canPost || !body.trim()}
              onClick={() => void send()}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
            >
              Send
            </button>
          </div>
        </>
      )}
    </aside>
  );
}

export default function LiveShowViewer({
  slug,
  fallbackShow,
}: {
  slug: string;
  fallbackShow: ShowInfo;
}) {
  const [payload, setPayload] = useState<LivePayload>({
    show: fallbackShow,
    live: { id: null, title: null, status: "offline", phase: "offline", viewerCount: 0 },
  });
  const [playerState, setPlayerState] = useState<"ready" | "buffering" | "error">(
    "ready",
  );
  const [latency, setLatency] = useState<number | null>(null);
  const [reminder, setReminder] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const live = payload.live;
  const show = payload.show;
  const isLiveSurface = live.phase === "live" || live.phase === "reconnecting";
  const statusClass =
    live.phase === "live"
      ? "border-emerald-300/50 bg-emerald-400/10 text-emerald-100"
      : live.phase === "reconnecting"
        ? "border-amber-300/50 bg-amber-400/10 text-amber-100"
        : "border-white/10 text-text-secondary";

  const load = useCallback(async () => {
    const response = await fetch(`/api/live/public/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    const next = await response.json();
    if (response.ok) setPayload(next);
  }, [slug]);

  useEffect(() => {
    queueMicrotask(() => void load());
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!live.id || !isLiveSurface) return;
    const heartbeat = async () => {
      const response = await fetch(`/api/live/public/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broadcastId: live.id, sessionId: sessionId() }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && typeof data?.viewerCount === "number") {
        setPayload((current) => ({
          ...current,
          live: { ...current.live, viewerCount: data.viewerCount },
        }));
      }
    };
    void heartbeat();
    const timer = window.setInterval(() => void heartbeat(), 15_000);
    return () => window.clearInterval(timer);
  }, [isLiveSurface, live.id, slug]);

  useEffect(() => {
    queueMicrotask(() => {
      const saved = window.localStorage.getItem(`bvs-live-reminder-${slug}`);
      setReminder(saved === "1");
    });
  }, [slug]);

  function measureLatency() {
    const video = videoRef.current;
    if (!video || !video.seekable.length) return;
    const liveEdge = video.seekable.end(video.seekable.length - 1);
    const next = Math.max(0, Math.round(liveEdge - video.currentTime));
    setLatency(next);
    setPlayerState("ready");
  }

  function toggleReminder() {
    const next = !reminder;
    window.localStorage.setItem(`bvs-live-reminder-${slug}`, next ? "1" : "0");
    setReminder(next);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link href={`/shows/${show.slug}`} className="text-sm text-brand hover:underline">
        Back to show
      </Link>
      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
            {isLiveSurface && live.hlsUrl ? (
              <video
                ref={videoRef}
                controls
                playsInline
                autoPlay
                className="aspect-video w-full bg-black"
                src={live.hlsUrl}
                onCanPlay={measureLatency}
                onTimeUpdate={measureLatency}
                onWaiting={() => setPlayerState("buffering")}
                onStalled={() => setPlayerState("buffering")}
                onError={() => setPlayerState("error")}
              />
            ) : (
              <div className="grid aspect-video place-items-center px-6 text-center">
                <div>
                  <p className={`inline-flex ${pill} ${statusClass}`}>
                    {labelFor(live.phase)}
                  </p>
                  <h1 className="mt-5 text-3xl font-semibold">{show.title}</h1>
                  <p className="mt-2 text-text-secondary">{show.schedule}</p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[.03] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className={`inline-flex ${pill} ${statusClass}`}>
                  {labelFor(live.phase)}
                </span>
                <h1 className="mt-4 text-3xl font-semibold">
                  {live.title || show.title}
                </h1>
                <p className="mt-2 text-text-secondary">{show.host}</p>
              </div>
              <button
                type="button"
                onClick={toggleReminder}
                className="rounded-lg border border-brand/40 px-4 py-2 text-sm text-brand"
              >
                {reminder ? "Reminder set" : "Remind me"}
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className={pill}>{live.viewerCount} viewers</span>
              <span className={pill}>Health: {live.health || "waiting"}</span>
              <span className={pill}>
                Bitrate: {live.bitrateKbps ? `${live.bitrateKbps} kbps` : "none"}
              </span>
              <span className={pill}>
                Latency: {latency === null ? "measuring" : `${latency}s`}
              </span>
              <span className={pill}>
                Player: {playerState === "ready" ? "ready" : playerState}
              </span>
            </div>

            <p className="mt-5 text-sm text-text-secondary">{show.description}</p>
            {live.phase === "ended" ? (
              live.replayUrl ? (
                <a
                  href={live.replayUrl}
                  className="mt-5 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black"
                >
                  Watch replay
                </a>
              ) : (
                <p className="mt-5 text-sm text-text-secondary">
                  Replay will appear after processing.
                </p>
              )
            ) : null}
          </div>
        </div>

        <div className="space-y-5">
          <div className="overflow-hidden rounded-xl border border-white/10">
            <Image
              src={show.artwork}
              alt={`${show.title} artwork`}
              width={720}
              height={720}
              className="aspect-square w-full object-cover"
            />
          </div>
          <LiveChat chatKey={live.chatKey} />
        </div>
      </section>
    </div>
  );
}
