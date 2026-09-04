"use client";

import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";
import { fetchJson, putToSignedSlot } from "@/lib/signed-upload";
import { isAllowedVideoFile, isAllowedVideoPoster, VIDEO_ACCEPT_ATTR } from "@/lib/video-formats";

const genres = [
  "Hip-Hop",
  "Trap",
  "Afrobeats",
  "Amapiano",
  "R&B",
  "Dancehall",
  "Electronic",
  "Gospel",
  "Pop",
  "Sungura",
  "Zimdancehall",
  "Chimurenga",
  "Other",
];

type OwnTrack = { id: string; title: string; artist_name?: string };

export default function MusicVideoSubmitForm({ onSuccess }: { onSuccess?: () => void }) {
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");
  const [video, setVideo] = useState<File | null>(null);
  const [poster, setPoster] = useState<File | null>(null);
  const [rights, setRights] = useState(false);
  const [explicit, setExplicit] = useState(false);
  const [relatedTrackId, setRelatedTrackId] = useState("");
  const [ownTracks, setOwnTracks] = useState<OwnTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    void (async () => {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) return;
      const { data } = await supabase
        .from("tracks")
        .select("id,title,artist_name")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (Array.isArray(data)) setOwnTracks(data.filter((t) => t?.id && t?.title) as OwnTrack[]);
    })();
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setDone(false);
    if (!isSupabaseConfigured()) {
      setError("Sign in is required to upload.");
      return;
    }
    if (!title.trim() || !genre || !video || !rights) {
      setError("Title, genre, video file and rights confirmation are required.");
      return;
    }
    const check = isAllowedVideoFile({ name: video.name, type: video.type, size: video.size });
    if (!check.ok) {
      setError(check.error || "Unsupported video.");
      return;
    }
    if (poster) {
      const p = isAllowedVideoPoster({ name: poster.name, type: poster.type, size: poster.size });
      if (!p.ok) {
        setError(p.error || "Invalid poster.");
        return;
      }
    }

    setLoading(true);
    try {
      const { data: sessionData } = await createClient().auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError("Sign in required. Open Studio after signing in.");
        setLoading(false);
        return;
      }
      const auth = { Authorization: `Bearer ${token}` };

      setProgress("Preparing secure upload…");
      const prep = await fetchJson<{
        video?: { path: string; signedUrl: string; contentType: string };
        poster?: { path: string; signedUrl: string; contentType: string } | null;
        error?: string;
      }>(
        "/api/music-videos/upload/prepare",
        {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({
            video: { name: video.name, type: video.type, size: video.size },
            poster: poster
              ? { name: poster.name, type: poster.type, size: poster.size }
              : null,
          }),
        },
        "prepare",
      );
      if (!prep.ok || !prep.data.video) {
        throw new Error((prep.data as { error?: string }).error || "Could not prepare upload.");
      }

      setProgress("Uploading video (keep this tab open)…");
      await putToSignedSlot(
        {
          path: prep.data.video.path,
          signedUrl: prep.data.video.signedUrl,
          contentType: prep.data.video.contentType,
        },
        video,
        { label: "video" },
      );

      let posterPath: string | null = null;
      if (poster && prep.data.poster) {
        setProgress("Uploading poster…");
        await putToSignedSlot(
          {
            path: prep.data.poster.path,
            signedUrl: prep.data.poster.signedUrl,
            contentType: prep.data.poster.contentType,
          },
          poster,
          { label: "poster" },
        );
        posterPath = prep.data.poster.path;
      }

      setProgress("Submitting for editorial review…");
      const fin = await fetchJson<{ error?: string; message?: string }>(
        "/api/music-videos/upload",
        {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            genre,
            description: description.trim(),
            rightsConfirmed: true,
            explicit,
            videoPath: prep.data.video.path,
            posterPath,
            fileSizeBytes: video.size,
            relatedTrackId: relatedTrackId || null,
          }),
        },
        "finalize",
      );
      if (!fin.ok) {
        throw new Error((fin.data as { error?: string }).error || "Submit failed.");
      }

      trackEvent("upload_complete", { kind: "music_video", genre });
      setDone(true);
      setProgress("");
      setVideo(null);
      setPoster(null);
      setTitle("");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setProgress("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <p className="text-sm leading-6 text-text-secondary">
        Upload an MP4 music video. BVS reviews it before it can appear as an optional{" "}
        <strong className="text-white">Watch</strong> on the player. Radio audio rotation always
        continues — video never blocks the next song.
      </p>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/70">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm"
          maxLength={160}
          required
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/70">Genre</span>
        <select
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm"
          required
        >
          <option value="">Select genre</option>
          {genres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/70">
          Link to your BVS track (recommended)
        </span>
        <select
          value={relatedTrackId}
          onChange={(e) => setRelatedTrackId(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm"
        >
          <option value="">No linked track yet</option>
          {ownTracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <span className="block text-xs text-text-secondary">
          Linking a track lets listeners open Watch while that song is in rotation.
        </span>
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/70">
          Video file (MP4 recommended)
        </span>
        <input
          type="file"
          accept={VIDEO_ACCEPT_ATTR}
          onChange={(e) => setVideo(e.target.files?.[0] || null)}
          className="block w-full text-sm"
        />
        {video ? (
          <span className="block text-xs text-text-secondary">
            {video.name} · {(video.size / (1024 * 1024)).toFixed(1)} MB
          </span>
        ) : null}
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/70">
          Poster image (optional)
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          onChange={(e) => setPoster(e.target.files?.[0] || null)}
          className="block w-full text-sm"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/70">Notes</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm"
          maxLength={3000}
        />
      </label>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={explicit} onChange={(e) => setExplicit(e.target.checked)} className="mt-1" />
        <span>This video may contain explicit content.</span>
      </label>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-1" required />
        <span>
          I confirm I control the rights to this music video (or have clearance) and grant BVS
          permission to host, stream and promote it after editorial approval.
        </span>
      </label>

      {error ? <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p> : null}
      {progress ? <p className="text-sm text-brand">{progress}</p> : null}
      {done ? (
        <p className="rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-sm text-brand">
          Submitted. Editorial will review before Watch appears on the player.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="min-h-12 w-full rounded-full bg-brand px-5 text-sm font-semibold text-black disabled:opacity-50"
      >
        {loading ? "Uploading…" : "Submit music video"}
      </button>
    </form>
  );
}
