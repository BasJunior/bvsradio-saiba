"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

type VideoRow = {
  id: string;
  title: string;
  artist_name: string;
  genre?: string;
  editorial_status: string;
  is_public: boolean;
  video_url?: string;
  poster_url?: string;
  created_at?: string;
  editorial_notes?: string;
};

export default function MusicVideoEditorialPanel() {
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    const { data } = await createClient().auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setError("Sign in required.");
      return;
    }
    const res = await fetch("/api/music-videos?scope=all", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error || "Could not load music videos.");
      return;
    }
    setError(null);
    setVideos(Array.isArray(payload.videos) ? payload.videos : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, action: "approve" | "reject" | "in_review") => {
    setBusyId(id);
    try {
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch("/api/music-videos", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload.error || "Update failed.");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[.02] p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Music videos</p>
          <h2 className="mt-1 text-xl font-semibold">Optional Watch queue</h2>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">
            Approve only when rights look clear. Approved videos can show as Watch on the player for the
            linked track. Audio rotation is never blocked.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-white/15 px-3 py-1.5 text-xs hover:bg-white/5"
        >
          Refresh
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      <ul className="mt-5 space-y-3">
        {videos.length === 0 ? (
          <li className="text-sm text-text-secondary">No music video submissions yet.</li>
        ) : (
          videos.map((v) => (
            <li
              key={v.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{v.title}</p>
                <p className="text-sm text-text-secondary">
                  {v.artist_name}
                  {v.genre ? ` · ${v.genre}` : ""} · {v.editorial_status}
                  {v.is_public ? " · public" : ""}
                </p>
                {v.video_url ? (
                  <a
                    href={v.video_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs text-brand hover:underline"
                  >
                    Open media
                  </a>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === v.id}
                  onClick={() => void act(v.id, "in_review")}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  In review
                </button>
                <button
                  type="button"
                  disabled={busyId === v.id}
                  onClick={() => void act(v.id, "approve")}
                  className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
                >
                  Approve + publish
                </button>
                <button
                  type="button"
                  disabled={busyId === v.id}
                  onClick={() => void act(v.id, "reject")}
                  className="rounded-full border border-red-400/40 px-3 py-1.5 text-xs text-red-200 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
