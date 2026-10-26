"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import AppShareButton from "@/components/app-vnext/AppShareButton";
import FullAccessAudioPlayer from "@/components/FullAccessAudioPlayer";
import { CreatorReleaseProgressDetails } from "@/components/CreatorReleaseProgress";
import { buildCreatorReleaseProgress, latestDistributionJob } from "@/lib/creator-release-progress";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAccountJson } from "@/lib/use-account-json";
import { useBrowserSession } from "@/lib/use-browser-session";

type Release = {
  id: string;
  title: string;
  artist_name?: string;
  genre?: string;
  release_type?: string;
  editorial_status?: string;
  editorial_notes?: string | null;
  is_public?: boolean;
  in_rotation?: boolean;
  created_at?: string;
  published_at?: string | null;
};

type Track = {
  id: string;
  title: string;
  artist_name?: string;
  genre?: string;
  file_url?: string;
  artwork_url?: string;
  editorial_status?: string;
  editorial_notes?: string | null;
  is_public?: boolean;
  in_rotation?: boolean;
  play_count?: number;
  like_count?: number;
  release_id?: string | null;
  isrc?: string;
  spotify_url?: string | null;
};

type DistributionJob = {
  id: string;
  release_id?: string | null;
  status?: string;
  notes?: string | null;
  updated_at?: string;
  created_at?: string;
};

type TrackRequest = {
  id: string;
  track_id: string;
  request_type: string;
  status: string;
  message?: string;
  created_at: string;
};

type Workspace = {
  profile: {
    role: string;
    username?: string;
    display_name?: string;
  };
  releases?: Release[];
  tracks?: Track[];
  distributionJobs?: DistributionJob[];
  trackRequests?: TrackRequest[];
};

const field = "w-full rounded-xl border border-white/10 bg-black/20 p-3 outline-none focus:border-brand";

function workspaceKeyForTrack(id: string) {
  return `track-${id}`;
}

export default function CreatorReleaseWorkspace({ releaseKey }: { releaseKey: string }) {
  const { session, loading: sessionLoading } = useBrowserSession();
  const { data, loading, error: requestError, reload } = useAccountJson<Workspace>({
    owner: session?.user.id || "",
    token: session?.access_token || "",
    url: "/api/creator/workspace",
    errorMessage: "Could not open this release workspace.",
  });
  const [requestType, setRequestType] = useState("metadata_correction");
  const [targetTrackId, setTargetTrackId] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  const [formError, setFormError] = useState("");

  const resolved = useMemo(() => {
    const tracks = data?.tracks || [];
    const releases = data?.releases || [];
    const jobs = data?.distributionJobs || [];
    const standaloneTrackId = releaseKey.startsWith("track-") ? releaseKey.slice("track-".length) : "";
    const standaloneTrack = standaloneTrackId ? tracks.find((track) => track.id === standaloneTrackId) : undefined;
    const release = standaloneTrack ? undefined : releases.find((item) => item.id === releaseKey);
    const relatedTracks = release
      ? tracks.filter((track) => track.release_id === release.id)
      : standaloneTrack
        ? [standaloneTrack]
        : [];
    const latestJob = release
      ? latestDistributionJob(jobs.filter((job) => job.release_id === release.id))
      : undefined;
    const source = release || standaloneTrack;
    const progress = source
      ? buildCreatorReleaseProgress({
          editorialStatus: source.editorial_status,
          editorialNotes: source.editorial_notes,
          isPublic: source.is_public,
          inRotation: source.in_rotation,
          distributionStatus: latestJob?.status,
        })
      : null;
    const publicTrack = relatedTracks.find((track) => track.is_public) || (standaloneTrack?.is_public ? standaloneTrack : undefined);
    const publicPath = data?.profile.username && publicTrack
      ? `/artist/${encodeURIComponent(data.profile.username)}#track-${publicTrack.id}`
      : null;
    const trackIds = new Set(relatedTracks.map((track) => track.id));
    const requests = (data?.trackRequests || []).filter((request) => trackIds.has(request.track_id));
    return { release, standaloneTrack, relatedTracks, latestJob, progress, publicTrack, publicPath, requests };
  }, [data, releaseKey]);

  const error = !isSupabaseConfigured()
    ? "Account service is not configured."
    : requestError || (!sessionLoading && !session ? "Sign in with a creator account." : "");

  if (sessionLoading || loading || (!data && !error)) {
    return <main className="mx-auto min-h-[65vh] max-w-5xl px-5 py-16 text-center text-text-secondary sm:px-6">Opening release workspace…</main>;
  }

  if (error && !data) {
    return (
      <main className="mx-auto min-h-[65vh] max-w-2xl px-5 py-20 text-center sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">BVS Studio</p>
        <h1 className="mt-3 text-3xl font-semibold">Release workspace unavailable</h1>
        <p className="mt-4 text-text-secondary">{error}</p>
        <Link href="/auth/login?next=/creator/studio" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-brand px-6 py-3 font-semibold text-black">Sign in</Link>
      </main>
    );
  }

  const item = resolved.release || resolved.standaloneTrack;
  if (!item || !resolved.progress) {
    return (
      <main className="mx-auto min-h-[65vh] max-w-3xl px-5 py-16 sm:px-6">
        <Link href="/creator/studio" className="text-sm text-brand">← Creator Studio</Link>
        <div className="mt-8 rounded-3xl border border-white/10 p-6 text-center">
          <h1 className="text-2xl font-semibold">This release is not in your Studio.</h1>
          <p className="mt-2 text-sm text-text-secondary">It may have been removed, moved to another account, or the link may be outdated.</p>
          <Link href="/creator/studio/manage#releases" className="mt-5 inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold">Open catalogue</Link>
        </div>
      </main>
    );
  }

  const title = item.title || "Untitled release";
  const tracks = resolved.relatedTracks;
  const plays = tracks.reduce((sum, track) => sum + Number(track.play_count || 0), 0);
  const likes = tracks.reduce((sum, track) => sum + Number(track.like_count || 0), 0);
  const selectedTrackId = targetTrackId || tracks[0]?.id || "";
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId);
  const isRelease = Boolean(resolved.release);
  const artworkHref = isRelease
    ? `/creator/studio/artwork?release=${encodeURIComponent(item.id)}#studio-release-cover-change`
    : `/creator/studio/artwork?track=${encodeURIComponent(item.id)}#studio-release-cover-change`;

  const submitCorrection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session?.access_token || !selectedTrackId) return;
    setSaving(true);
    setSaved("");
    setFormError("");
    try {
      const context = isRelease ? `Release: ${title} (${item.id})` : `Track: ${title} (${item.id})`;
      const response = await fetch("/api/creator/workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "track_request",
          trackId: selectedTrackId,
          requestType,
          message: `${context}\n${message.trim()}`,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not send this correction request.");
      setSaved("Request sent. Editorial will review it against this release before anything changes publicly.");
      setMessage("");
      await reload();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not send this correction request.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-5 pb-20 pt-10 sm:px-6 sm:pt-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/creator/studio" className="text-sm text-brand">← Creator Studio</Link>
        <Link href="/creator/studio/manage#releases" className="text-sm text-text-secondary hover:text-white">Full catalogue →</Link>
      </div>

      <section className="mt-7 rounded-3xl border border-white/10 bg-white/[.025] p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Release workspace</p>
            <h1 className="mt-2 break-words text-3xl font-semibold sm:text-4xl">{title}</h1>
            <p className="mt-2 text-sm capitalize text-text-secondary">
              {resolved.release?.release_type || (resolved.standaloneTrack ? "single" : "release")} · {resolved.progress.statusLabel}
            </p>
          </div>
          <button type="button" onClick={() => void reload()} className="min-h-11 shrink-0 rounded-full border border-white/15 px-4 py-2 text-sm">Refresh</button>
        </div>

        <CreatorReleaseProgressDetails
          progress={resolved.progress}
          actionHref="#corrections"
          actionLabel="Open correction flow"
        />

        {item.editorial_notes ? (
          <div className={`mt-5 rounded-2xl border p-4 ${resolved.progress.group === "action_required" ? "border-amber-300/25 bg-amber-300/[.05]" : "border-white/10 bg-black/20"}`}>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-text-secondary">Editorial note</p>
            <p className="mt-2 text-sm leading-6">{item.editorial_notes}</p>
          </div>
        ) : null}
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Release results">
        <Metric label="Tracks" value={tracks.length || 1} />
        <Metric label="Playback starts" value={plays} />
        <Metric label="Saves / likes" value={likes} />
        <Metric label="Requests" value={resolved.requests.length} />
      </section>

      <section className="mt-8 rounded-3xl border border-white/10 p-5 sm:p-6" aria-labelledby="release-files-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-text-secondary">Files + review</p>
            <h2 id="release-files-heading" className="mt-1 text-2xl font-semibold">Keep the submission attached to the decision.</h2>
          </div>
          <Link href={artworkHref} className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold">Change cover</Link>
        </div>
        <div className="mt-5 space-y-3">
          {tracks.map((track, index) => (
            <article key={track.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-text-secondary">{tracks.length > 1 ? `Track ${index + 1}` : "Recording"}</p>
                  <h3 className="mt-1 font-semibold">{track.title}</h3>
                  <p className="mt-1 text-xs text-text-secondary">{track.editorial_status?.replaceAll("_", " ") || "status pending"}{track.isrc ? ` · ISRC ${track.isrc}` : ""}</p>
                </div>
                {track.spotify_url ? <a href={track.spotify_url} target="_blank" rel="noreferrer" className="text-sm text-brand">DSP ↗</a> : null}
              </div>
              {track.file_url ? <div className="mt-3"><FullAccessAudioPlayer accessId={`studio-release-workspace:${track.id}`} title={track.title} artist={track.artist_name || item.artist_name || "Your submission"} src={track.file_url} artwork={track.artwork_url} sourceLabel={`Studio · ${title} · full submission`} genre={track.genre} compact /></div> : null}
            </article>
          ))}
          {!tracks.length ? <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-text-secondary">BVS has the release record, but no track-level file is available in this workspace yet.</p> : null}
        </div>
      </section>

      <section id="corrections" className="mt-8 scroll-mt-24 rounded-3xl border border-white/10 p-5 sm:p-6" aria-labelledby="release-corrections-heading">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-text-secondary">Corrections</p>
        <h2 id="release-corrections-heading" className="mt-1 text-2xl font-semibold">Fix the existing release without starting over.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">Send the correction against this release. BVS editorial still approves metadata, rights and takedown changes before public catalogue data changes.</p>

        {tracks.length ? (
          <form onSubmit={submitCorrection} className="mt-5 grid gap-3 lg:max-w-2xl">
            {tracks.length > 1 ? (
              <select value={selectedTrackId} onChange={(event) => setTargetTrackId(event.target.value)} className={field}>
                {tracks.map((track) => <option key={track.id} value={track.id}>{track.title}</option>)}
              </select>
            ) : null}
            <select value={requestType} onChange={(event) => setRequestType(event.target.value)} className={field}>
              <option value="metadata_correction">Metadata correction</option>
              <option value="rights_update">Rights / credits update</option>
              <option value="takedown">Takedown / unpublish</option>
              <option value="other">Other editorial change</option>
            </select>
            <textarea required minLength={10} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={selectedTrack ? `What should BVS change for ${selectedTrack.title}?` : "What should BVS change?"} className={`${field} min-h-32`} />
            {formError ? <p role="alert" className="text-sm text-red-200">{formError}</p> : null}
            {saved ? <p role="status" className="text-sm text-brand">{saved}</p> : null}
            <button disabled={saving} className="min-h-11 justify-self-start rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50">{saving ? "Sending…" : "Send correction request"}</button>
          </form>
        ) : (
          <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[.04] p-4 text-sm text-amber-100">No track target is available for the correction form yet. Open the full Studio request desk so editorial can attach the request safely.</p>
        )}

        {resolved.requests.length ? (
          <div className="mt-6 space-y-2">
            <h3 className="font-semibold">Request history</h3>
            {resolved.requests.slice(0, 8).map((request) => (
              <div key={request.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-text-secondary">
                <span className="text-text-primary">{request.request_type.replaceAll("_", " ")}</span> · {request.status} · {new Date(request.created_at).toLocaleDateString()}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mt-8 rounded-3xl border border-white/10 p-5 sm:p-6" aria-labelledby="release-growth-heading">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-text-secondary">Promotion + results</p>
        <h2 id="release-growth-heading" className="mt-1 text-2xl font-semibold">Move the release after it is live.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">Promotion stays tied to the published item instead of sending you back through a general creator directory.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {resolved.publicPath ? <Link href={resolved.publicPath} className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black">View live proof</Link> : <span className="inline-flex min-h-11 items-center rounded-full border border-white/10 px-5 py-2.5 text-sm text-text-secondary">Public proof appears after publication</span>}
          {resolved.publicPath ? <AppShareButton title={title} text={`Listen to ${title} on BVS`} path={resolved.publicPath} kicker="Listen and save" triggerLabel="Share release" compact /> : null}
          <Link href="/creator/studio/manage#insights" className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold">Open Insights</Link>
          <Link href="/creator/studio/earnings" className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold">Open earnings</Link>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-[11px] uppercase tracking-[.14em] text-text-secondary">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-brand">{value.toLocaleString()}</p>
    </div>
  );
}

export { workspaceKeyForTrack };
