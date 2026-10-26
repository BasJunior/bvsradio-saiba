"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useAccountJson } from "@/lib/use-account-json";
import ReleaseSubmitForm from "@/components/ReleaseSubmitForm";
import { CreatorReleaseProgressDetails, CreatorReleaseWorkCounts } from "@/components/CreatorReleaseProgress";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import {
  buildCreatorReleaseProgress,
  latestDistributionJob,
  releaseWorkGroupLabel,
  type CreatorReleaseProgress,
  type ReleaseWorkGroup,
} from "@/lib/creator-release-progress";

type Release = {
  id: string;
  title: string;
  release_type?: string;
  editorial_status?: string;
  editorial_notes?: string;
  is_public?: boolean;
  in_rotation?: boolean;
  preflight_status?: string;
  created_at?: string;
  published_at?: string | null;
};
type Track = {
  id: string;
  title: string;
  release_id?: string | null;
  editorial_status?: string;
  is_public?: boolean;
  play_count?: number;
  like_count?: number;
  spotify_url?: string | null;
};
type DistributionJob = {
  id: string;
  release_id?: string | null;
  status?: string;
  public_note?: string;
  updated_at?: string;
  created_at?: string;
};
type Workspace = { releases?: Release[]; tracks?: Track[]; distributionJobs?: DistributionJob[] };

const field = "w-full rounded-xl border border-white/10 bg-black/20 p-3 text-base outline-none focus:border-brand";
const wholeReleaseTarget = "__release__";

function ReleaseCard({
  release,
  tracks,
  progress,
  surface,
  token,
  onSaved,
}: {
  release: Release;
  tracks: Track[];
  progress: CreatorReleaseProgress;
  surface: AppSurface;
  token: string;
  onSaved: () => void;
}) {
  const live = release.is_public === true;
  const storeLive = progress.stages.find((stage) => stage.id === "stores")?.state === "complete";
  const plays = tracks.reduce((sum, track) => sum + Number(track.play_count || 0), 0);
  const likes = tracks.reduce((sum, track) => sum + Number(track.like_count || 0), 0);
  const storeLinks = tracks.filter((track) => Boolean(track.spotify_url)).length;
  const [target, setTarget] = useState(wholeReleaseTarget);
  const [requestType, setRequestType] = useState("metadata_correction");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState("");
  const [formError, setFormError] = useState("");

  const submitCorrection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    setResult("");
    setFormError("");
    try {
      const wholeRelease = target === wholeReleaseTarget;
      const selectedTrack = tracks.find((track) => track.id === target);
      const context = wholeRelease
        ? `Release: ${release.title} (${release.id})`
        : `Track: ${selectedTrack?.title || release.title} (${target})`;
      const response = await fetch(wholeRelease ? "/api/creator/release-requests" : "/api/creator/workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(wholeRelease
          ? {
              releaseId: release.id,
              requestType,
              message: `${context}\n${message.trim()}`,
            }
          : {
              action: "track_request",
              trackId: target,
              requestType,
              message: `${context}\n${message.trim()}`,
            }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not send this correction request.");
      setMessage("");
      setResult("Request sent. Editorial will review it before public catalogue data changes.");
      onSaved();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not send this correction request.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <article id={`release-${release.id}`} className="scroll-mt-28 rounded-[1.5rem] border border-white/10 bg-white/[.025] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[.14em] text-brand">{release.release_type || "release"}</p>
          <h3 className="mt-1 truncate text-xl font-semibold">{release.title}</h3>
        </div>
        {release.preflight_status ? <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-text-secondary">Rights preflight · {release.preflight_status.replaceAll("_", " ")}</span> : null}
      </div>

      <CreatorReleaseProgressDetails
        progress={progress}
        actionHref={`#release-correction-${release.id}`}
        actionLabel="Open correction flow"
      />

      {release.editorial_notes ? <p className={`mt-4 rounded-xl border p-3 text-sm ${progress.group === "action_required" ? "border-amber-300/25 bg-amber-300/[.05] text-amber-100" : "border-white/10 text-text-secondary"}`}>Editorial: {release.editorial_notes}</p> : null}

      <details id={`release-correction-${release.id}`} className="mt-4 scroll-mt-28 rounded-2xl border border-white/10 bg-black/20 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-brand">Request a correction</summary>
        <p className="mt-3 text-sm leading-6 text-text-secondary">Keep the request attached to this release. Editorial approval remains required before metadata, rights or takedown changes affect the public catalogue.</p>
        <form onSubmit={submitCorrection} className="mt-4 grid gap-3">
          <select value={target} onChange={(event) => setTarget(event.target.value)} className={field} aria-label="Correction target">
            <option value={wholeReleaseTarget}>Whole release · {release.title}</option>
            {tracks.map((track) => <option key={track.id} value={track.id}>Track · {track.title}</option>)}
          </select>
          <select value={requestType} onChange={(event) => setRequestType(event.target.value)} className={field} aria-label="Correction type">
            <option value="metadata_correction">Metadata correction</option>
            <option value="rights_update">Rights / credits update</option>
            <option value="takedown">Takedown / unpublish</option>
            <option value="other">Other editorial change</option>
          </select>
          <textarea
            required
            minLength={10}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={`What should BVS change for ${target === wholeReleaseTarget ? release.title : tracks.find((track) => track.id === target)?.title || release.title}?`}
            className={`${field} min-h-32 resize-y`}
          />
          {formError ? <p role="alert" className="text-sm text-red-200">{formError}</p> : null}
          {result ? <p role="status" className="text-sm text-brand">{result}</p> : null}
          <button type="submit" disabled={saving} className="min-h-11 justify-self-start rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50">{saving ? "Sending…" : "Send correction request"}</button>
        </form>
      </details>

      {live ? <div className="mt-4 rounded-xl border border-brand/20 bg-brand/[.04] p-4"><p className="text-xs uppercase tracking-[.14em] text-brand">Live proof</p><div className="mt-2 flex flex-wrap gap-2 text-sm"><span className="rounded-full border border-white/10 px-3 py-1.5">{plays.toLocaleString()} playback starts</span><span className="rounded-full border border-white/10 px-3 py-1.5">{likes.toLocaleString()} likes</span>{storeLive ? <span className="rounded-full border border-white/10 px-3 py-1.5">Stores live{storeLinks ? ` · ${storeLinks} verified link${storeLinks === 1 ? "" : "s"}` : ""}</span> : null}</div><div className="mt-3 flex flex-wrap gap-3 text-sm"><Link href={`/app/${surface}/studio/insights`} className="text-brand">Open Insights →</Link><Link href={`/app/${surface}/studio/money`} className="text-brand">Open Money →</Link></div></div> : null}
    </article>
  );
}

export default function AppStudioReleaseClient({ surface }: { surface: AppSurface }) {
  const { user } = useAppSession();
  return <AccountReleaseStudio key={user?.id || "guest"} surface={surface} />;
}

function AccountReleaseStudio({ surface }: { surface: AppSurface }) {
  const { token, signedIn, loading: sessionLoading, access, user } = useAppSession();
  const { data: workspace, loading, error, reload: load } = useAccountJson<Workspace>({ owner: user?.id || "", token, url: "/api/creator/workspace", enabled: Boolean(access?.artist) && !sessionLoading, errorMessage: "Could not load your release workspace." });
  const [success, setSuccess] = useState("");

  const jobsByRelease = useMemo(() => {
    const map = new Map<string, DistributionJob>();
    const byRelease = new Map<string, DistributionJob[]>();
    for (const job of workspace?.distributionJobs || []) {
      if (!job.release_id) continue;
      byRelease.set(job.release_id, [...(byRelease.get(job.release_id) || []), job]);
    }
    for (const [releaseId, jobs] of byRelease) map.set(releaseId, latestDistributionJob(jobs)!);
    return map;
  }, [workspace?.distributionJobs]);

  if (sessionLoading || loading) return <div className="h-44 animate-pulse rounded-[1.75rem] bg-white/[.04]" />;
  if (!signedIn || !token) return <div className="rounded-[1.75rem] border border-white/10 p-6 text-center"><h2 className="text-xl font-semibold">Sign in to release music.</h2><Link href={`/app/${surface}/login?next=${encodeURIComponent(`/app/${surface}/studio/release`)}`} className="mt-4 inline-flex rounded-full bg-brand px-5 py-2.5 font-semibold text-black">Sign in</Link></div>;
  if (!access?.artist) return <div className="rounded-[1.75rem] border border-white/10 p-6"><h2 className="text-xl font-semibold">Artist access required.</h2><p className="mt-2 text-sm text-text-secondary">Release submission opens after BVS approves Artist access for this account.</p><Link href={`/app/${surface}/account#creator-role`} className="mt-4 inline-flex text-sm text-brand">Open Account Centre →</Link></div>;

  const releases = workspace?.releases || [];
  const tracks = workspace?.tracks || [];
  const releaseRows = releases.map((release) => {
    const job = jobsByRelease.get(release.id);
    const progress = buildCreatorReleaseProgress({
      editorialStatus: release.editorial_status,
      editorialNotes: release.editorial_notes,
      isPublic: release.is_public,
      inRotation: release.in_rotation,
      distributionStatus: job?.status,
    });
    return { release, job, progress };
  });
  const groups: Array<{ id: ReleaseWorkGroup; note: string }> = [
    { id: "action_required", note: "These releases need your attention. Open the correction flow on the exact release; you do not need to create a duplicate submission." },
    { id: "in_progress", note: "BVS, the distribution partner or stores own the next step. You do not need to resubmit." },
    { id: "history", note: "Completed or stopped paths stay here as a record of what is actually live." },
  ];
  const counts = releaseRows.reduce<Record<ReleaseWorkGroup, number>>(
    (result, row) => ({ ...result, [row.progress.group]: result[row.progress.group] + 1 }),
    { action_required: 0, in_progress: 0, history: 0 },
  );

  return (
    <div className="space-y-7">
      {success ? <p className="rounded-2xl border border-brand/30 bg-brand/10 p-4 text-sm text-brand">{success}</p> : null}
      {error ? <p className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200">{error}</p> : null}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-brand">Release status</p><h2 className="mt-1 text-2xl font-semibold">Know exactly what is live.</h2><p className="mt-2 max-w-2xl text-sm text-text-secondary">BVS review, BVS playback and wider store delivery are separate states. A release is never shown as live on stores until that state is confirmed.</p></div><button type="button" onClick={() => void load()} className="rounded-full border border-white/15 px-4 py-2 text-sm">Refresh</button></div>
        {releaseRows.length ? <div className="mt-4"><CreatorReleaseWorkCounts counts={counts} /></div> : null}
        <div className="mt-6 space-y-7">
          {groups.map((group) => {
            const rows = releaseRows.filter((row) => row.progress.group === group.id).slice(0, 8);
            if (!rows.length) return null;
            return (
              <section key={group.id} aria-labelledby={`release-group-${group.id}`}>
                <h3 id={`release-group-${group.id}`} className="text-lg font-semibold">{releaseWorkGroupLabel(group.id)} · {rows.length}</h3>
                <p className="mt-1 text-sm text-text-secondary">{group.note}</p>
                <div className="mt-3 space-y-3">
                  {rows.map(({ release, progress }) => <ReleaseCard key={release.id} release={release} tracks={tracks.filter((track) => track.release_id === release.id)} progress={progress} surface={surface} token={token} onSaved={() => void load()} />)}
                </div>
              </section>
            );
          })}
        </div>
        {!releases.length && !error ? <div className="mt-4 rounded-2xl border border-dashed border-white/15 p-6 text-center"><h3 className="font-semibold">No releases submitted yet.</h3><p className="mt-2 text-sm text-text-secondary">Complete the form below to send your first release into BVS editorial review.</p></div> : null}
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-white/[.02] p-4 sm:p-6">
        <p className="text-xs uppercase tracking-[.18em] text-brand">Create + submit</p>
        <h2 className="mt-1 text-2xl font-semibold">Send a release to editorial.</h2>
        <p className="mb-5 mt-2 text-sm text-text-secondary">The upload stays private until BVS editorial approves and publishes it. Wider store delivery is handled separately after BVS publication.</p>
        <ReleaseSubmitForm onSuccess={() => { setSuccess("Release submitted. Its editorial state is now visible above."); void load(); }} />
      </section>
    </div>
  );
}
