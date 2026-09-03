"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ReleaseSubmitForm from "@/components/ReleaseSubmitForm";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";

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
};
type Workspace = { releases?: Release[]; tracks?: Track[]; distributionJobs?: DistributionJob[] };
type StageState = "done" | "current" | "next" | "failed";

const normalize = (value?: string) => String(value || "").toLowerCase();

function bvsStatus(release: Release) {
  const status = normalize(release.editorial_status);
  if (release.is_public) return release.in_rotation ? "Live on BVS · in rotation" : "Live on BVS";
  if (status === "approved") return "Approved · awaiting BVS publish";
  if (status === "in_review") return "In editorial review";
  if (["rejected", "changes_requested", "information_requested"].includes(status)) return "Changes needed";
  if (status === "submitted") return "Submitted · waiting for review";
  if (status === "draft") return "Draft";
  return status ? status.replaceAll("_", " ") : "Preparing";
}

function stageTone(state: StageState) {
  if (state === "done") return "border-brand/30 bg-brand/10 text-brand";
  if (state === "current") return "border-amber-300/30 bg-amber-300/[.06] text-amber-100";
  if (state === "failed") return "border-red-400/30 bg-red-500/[.06] text-red-200";
  return "border-white/10 bg-black/10 text-text-secondary";
}

function ReleaseCard({ release, tracks, job, surface }: { release: Release; tracks: Track[]; job?: DistributionJob; surface: AppSurface }) {
  const status = normalize(release.editorial_status);
  const distro = normalize(job?.status);
  const submitted = status !== "draft" && Boolean(status);
  const reviewFailed = ["rejected", "changes_requested", "information_requested"].includes(status);
  const approved = ["approved", "published", "live"].includes(status);
  const live = Boolean(release.is_public || release.in_rotation || ["published", "live"].includes(status));
  const storeLive = distro === "live_on_dsp";
  const storeCurrent = ["eligible", "queued", "submitted"].includes(distro);
  const storeFailed = ["failed", "cancelled"].includes(distro);
  const plays = tracks.reduce((sum, track) => sum + Number(track.play_count || 0), 0);
  const likes = tracks.reduce((sum, track) => sum + Number(track.like_count || 0), 0);
  const storeLinks = tracks.filter((track) => Boolean(track.spotify_url)).length;

  const stages: Array<{ label: string; state: StageState }> = [
    { label: "Submitted", state: submitted ? "done" : "current" },
    { label: "Review", state: reviewFailed ? "failed" : approved ? "done" : submitted ? "current" : "next" },
    { label: "BVS live", state: live ? "done" : approved ? "current" : "next" },
    { label: "Stores", state: storeLive ? "done" : storeFailed ? "failed" : storeCurrent && live ? "current" : "next" },
  ];

  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-white/[.025] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[.14em] text-brand">{release.release_type || "release"}</p>
          <h3 className="mt-1 truncate text-xl font-semibold">{release.title}</h3>
          <p className="mt-1 text-sm text-text-secondary">{bvsStatus(release)}</p>
        </div>
        {release.preflight_status ? <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-text-secondary">Rights preflight · {release.preflight_status.replaceAll("_", " ")}</span> : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stages.map((stage) => <div key={stage.label} className={`rounded-xl border px-3 py-2 text-xs ${stageTone(stage.state)}`}><p>{stage.label}</p><p className="mt-1 opacity-80">{stage.state === "done" ? "✓ complete" : stage.state === "current" ? "Now" : stage.state === "failed" ? "Needs attention" : "Next"}</p></div>)}
      </div>

      {release.editorial_notes ? <p className={`mt-4 rounded-xl border p-3 text-sm ${reviewFailed ? "border-amber-300/25 bg-amber-300/[.05] text-amber-100" : "border-white/10 text-text-secondary"}`}>Editorial: {release.editorial_notes}</p> : null}
      {job ? <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-3"><p className="text-xs uppercase tracking-[.14em] text-brand">Wider store delivery</p><p className="mt-1 text-sm text-text-secondary">{job.public_note || "Wider delivery status pending."}</p></div> : live ? <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-3"><p className="text-xs uppercase tracking-[.14em] text-brand">Wider store delivery</p><p className="mt-1 text-sm text-text-secondary">Not started for this release. BVS playback remains independent from store delivery.</p></div> : null}

      {live ? <div className="mt-4 rounded-xl border border-brand/20 bg-brand/[.04] p-4"><p className="text-xs uppercase tracking-[.14em] text-brand">Live proof</p><div className="mt-2 flex flex-wrap gap-2 text-sm"><span className="rounded-full border border-white/10 px-3 py-1.5">{plays.toLocaleString()} playback starts</span><span className="rounded-full border border-white/10 px-3 py-1.5">{likes.toLocaleString()} likes</span>{storeLive ? <span className="rounded-full border border-white/10 px-3 py-1.5">Stores live{storeLinks ? ` · ${storeLinks} verified link${storeLinks === 1 ? "" : "s"}` : ""}</span> : null}</div><div className="mt-3 flex flex-wrap gap-3 text-sm"><Link href={`/app/${surface}/studio/insights`} className="text-brand">Open Insights →</Link><Link href={`/app/${surface}/studio/money`} className="text-brand">Open Money →</Link></div></div> : null}
    </article>
  );
}

export default function AppStudioReleaseClient({ surface }: { surface: AppSurface }) {
  const { token, signedIn, loading: sessionLoading, access } = useAppSession();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    if (!token || !access?.artist) { setLoading(false); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/creator/workspace", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Could not load your release workspace.");
      setWorkspace(payload as Workspace);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load your release workspace.");
    } finally {
      setLoading(false);
    }
  }, [access?.artist, token]);

  useEffect(() => { if (!sessionLoading) void load(); }, [load, sessionLoading]);

  const jobsByRelease = useMemo(() => {
    const map = new Map<string, DistributionJob>();
    for (const job of workspace?.distributionJobs || []) {
      if (job.release_id && !map.has(job.release_id)) map.set(job.release_id, job);
    }
    return map;
  }, [workspace?.distributionJobs]);

  if (sessionLoading || loading) return <div className="h-44 animate-pulse rounded-[1.75rem] bg-white/[.04]" />;
  if (!signedIn || !token) return <div className="rounded-[1.75rem] border border-white/10 p-6 text-center"><h2 className="text-xl font-semibold">Sign in to release music.</h2><Link href={`/auth/login?next=${encodeURIComponent(`/app/${surface}/studio/release`)}`} className="mt-4 inline-flex rounded-full bg-brand px-5 py-2.5 font-semibold text-black">Sign in</Link></div>;
  if (!access?.artist) return <div className="rounded-[1.75rem] border border-white/10 p-6"><h2 className="text-xl font-semibold">Artist access required.</h2><p className="mt-2 text-sm text-text-secondary">Release submission opens after BVS approves Artist access for this account.</p><Link href={`/app/${surface}/account#creator-role`} className="mt-4 inline-flex text-sm text-brand">Open Account Centre →</Link></div>;

  const releases = workspace?.releases || [];
  const tracks = workspace?.tracks || [];

  return (
    <div className="space-y-7">
      {success ? <p className="rounded-2xl border border-brand/30 bg-brand/10 p-4 text-sm text-brand">{success}</p> : null}
      {error ? <p className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200">{error}</p> : null}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-brand">Release status</p><h2 className="mt-1 text-2xl font-semibold">Know exactly what is live.</h2><p className="mt-2 max-w-2xl text-sm text-text-secondary">BVS review, BVS playback and wider store delivery are separate states. A release is never shown as live on stores until that state is confirmed.</p></div><button type="button" onClick={() => void load()} className="rounded-full border border-white/15 px-4 py-2 text-sm">Refresh</button></div>
        <div className="mt-4 space-y-3">{releases.slice(0, 8).map((release) => <ReleaseCard key={release.id} release={release} tracks={tracks.filter((track) => track.release_id === release.id)} job={jobsByRelease.get(release.id)} surface={surface} />)}</div>
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
