"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

function ReleaseCard({ release, tracks, progress, surface }: { release: Release; tracks: Track[]; progress: CreatorReleaseProgress; surface: AppSurface }) {
  const live = release.is_public === true;
  const storeLive = progress.stages.find((stage) => stage.id === "stores")?.state === "complete";
  const plays = tracks.reduce((sum, track) => sum + Number(track.play_count || 0), 0);
  const likes = tracks.reduce((sum, track) => sum + Number(track.like_count || 0), 0);
  const storeLinks = tracks.filter((track) => Boolean(track.spotify_url)).length;

  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-white/[.025] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[.14em] text-brand">{release.release_type || "release"}</p>
          <h3 className="mt-1 truncate text-xl font-semibold">{release.title}</h3>
        </div>
        {release.preflight_status ? <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-text-secondary">Rights preflight · {release.preflight_status.replaceAll("_", " ")}</span> : null}
      </div>

      <CreatorReleaseProgressDetails
        progress={progress}
        actionHref={`/app/${surface}/support?topic=music`}
        actionLabel="Contact editorial"
      />

      {release.editorial_notes ? <p className={`mt-4 rounded-xl border p-3 text-sm ${progress.group === "action_required" ? "border-amber-300/25 bg-amber-300/[.05] text-amber-100" : "border-white/10 text-text-secondary"}`}>Editorial: {release.editorial_notes}</p> : null}

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
    { id: "action_required", note: "These releases need your attention. Read the note, then contact editorial from the release card; existing releases cannot be edited or resubmitted on this screen." },
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
                  {rows.map(({ release, progress }) => <ReleaseCard key={release.id} release={release} tracks={tracks.filter((track) => track.release_id === release.id)} progress={progress} surface={surface} />)}
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
