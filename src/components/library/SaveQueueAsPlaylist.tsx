"use client";

import { useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";
import type { QueueItem } from "@/components/StationPlayer";

export default function SaveQueueAsPlaylist({ items }: { items: QueueItem[] }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function saveQueue() {
    if (!items.length || busy || !isSupabaseConfigured()) return;
    setBusy(true);
    setMessage("");
    const { data } = await createClient().auth.getSession();
    const token = data.session?.access_token || "";
    if (!token) {
      setMessage("Sign in to save your queue.");
      setBusy(false);
      return;
    }

    const title = `BVS queue · ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date())}`;
    const playlistResponse = await fetch("/api/playlists", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ title, description: "Saved from BVS Radio", isPublic: false }),
    }).catch(() => null);
    const playlistPayload = await playlistResponse?.json().catch(() => ({})) as { playlist?: { id?: string }; error?: string } | undefined;
    const playlistId = playlistPayload?.playlist?.id;
    if (!playlistResponse?.ok || !playlistId) {
      setMessage(playlistPayload?.error || "Could not save queue.");
      setBusy(false);
      return;
    }

    const playable = items.filter((item) => item.track.id);
    const results = await Promise.all(playable.map((item) => fetch(`/api/playlists/${playlistId}/tracks`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(item.track.kind === "beat"
        ? { beatId: item.track.id?.replace(/^beat-/, "") }
        : { trackId: item.track.id?.replace(/^track-/, "") }),
    }).then((response) => response.ok).catch(() => false)));
    if (results.some((result) => !result)) {
      setMessage("Playlist created, but some queue items could not be added.");
    } else {
      setMessage(`Saved ${playable.length} tracks to ${title}`);
      window.dispatchEvent(new CustomEvent("bvs:playlists-change"));
    }
    setBusy(false);
  }

  if (!items.length) return null;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void saveQueue()}
        disabled={busy}
        className="rounded-[4px] border border-white/15 px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-brand/40 hover:text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save queue as playlist"}
      </button>
      {message ? <span className="text-[11px] text-brand" role="status">{message}</span> : null}
    </div>
  );
}
