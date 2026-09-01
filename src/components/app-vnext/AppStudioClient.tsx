"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";

const roles = [
  ["Artist", "Release music, follow editorial review and track distribution."],
  ["Producer", "Publish beats, manage packs, licences and BeatStore work."],
  ["Writer", "Work on BVS stories and research briefs."],
  ["Show creator", "Develop programmes, episodes and live-show workflows."],
];

type WorkspaceTrack = { id: string; title: string; editorial_status?: string; editorial_notes?: string; in_rotation?: boolean; is_public?: boolean };
type WorkspaceRelease = { id: string; title: string; editorial_status?: string; editorial_notes?: string; is_public?: boolean; in_rotation?: boolean };
type DistributionJob = { id: string; release_id?: string; status?: string; notes?: string; updated_at?: string };
type WorkflowItem = { id: string; title?: string; topic?: string; status?: string; editor_notes?: string; review_notes?: string };
type Workspace = {
  tracks?: WorkspaceTrack[];
  releases?: WorkspaceRelease[];
  distributionJobs?: DistributionJob[];
  trackRequests?: WorkflowItem[];
  articles?: WorkflowItem[];
  briefs?: WorkflowItem[];
  shows?: WorkflowItem[];
  episodes?: WorkflowItem[];
};

type Task = { id: string; eyebrow: string; title: string; note: string; href: string; tone?: "urgent" | "normal" };

const needsCreatorAction = (status?: string) => ["changes_requested", "rejected", "failed", "action_required", "needs_action"].includes(String(status || "").toLowerCase());

export default function AppStudioClient({ surface }: { surface: AppSurface }) {
  const { loading, signedIn, isCreator, access, premiumActive, premiumPlanLabel, token } = useAppSession();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");

  useEffect(() => {
    if (!isCreator || !token) { setWorkspace(null); return; }
    let alive = true;
    setWorkspaceLoading(true);
    fetch("/api/creator/workspace", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!alive) return;
        if (!response.ok) throw new Error(payload?.error || "Studio workspace is unavailable.");
        setWorkspace(payload as Workspace);
        setWorkspaceError("");
      })
      .catch((error) => alive && setWorkspaceError(error instanceof Error ? error.message : "Studio workspace is unavailable."))
      .finally(() => alive && setWorkspaceLoading(false));
    return () => { alive = false; };
  }, [isCreator, token]);

  const tasks = useMemo<Task[]>(() => {
    if (!workspace) return [];
    const out: Task[] = [];
    for (const release of workspace.releases || []) {
      if (needsCreatorAction(release.editorial_status)) out.push({ id: `release-${release.id}`, eyebrow: "Release review", title: release.title, note: release.editorial_notes || "Editorial needs an update before this release can move forward.", href: `/app/${surface}/studio/release`, tone: "urgent" });
    }
    for (const track of workspace.tracks || []) {
      if (needsCreatorAction(track.editorial_status)) out.push({ id: `track-${track.id}`, eyebrow: "Track review", title: track.title, note: track.editorial_notes || "This track needs your attention.", href: `/app/${surface}/studio/release`, tone: "urgent" });
    }
    for (const job of workspace.distributionJobs || []) {
      if (needsCreatorAction(job.status)) out.push({ id: `distribution-${job.id}`, eyebrow: "Distribution", title: "Distribution action required", note: job.notes || `Status: ${job.status || "needs action"}.`, href: "/distribution", tone: "urgent" });
    }
    for (const brief of workspace.briefs || []) {
      if (["assigned", "changes_requested"].includes(String(brief.status || ""))) out.push({ id: `brief-${brief.id}`, eyebrow: "Editorial brief", title: brief.title || brief.topic || "Research brief", note: brief.editor_notes || brief.review_notes || "Open the brief and continue the assigned work.", href: "/creator/studio/manage#writer-work" });
    }
    for (const show of workspace.shows || []) {
      if (needsCreatorAction(show.status)) out.push({ id: `show-${show.id}`, eyebrow: "Show review", title: show.title || "Show submission", note: show.review_notes || "Your show submission needs an update.", href: "/creator/studio/manage#show-work", tone: "urgent" });
    }
    return out.slice(0, 8);
  }, [surface, workspace]);

  if (loading) return <div className="mx-auto max-w-5xl px-4 pt-8"><div className="h-48 animate-pulse rounded-[2rem] bg-white/[.04]" /></div>;

  if (!signedIn) return (
    <div className="mx-auto max-w-4xl px-4 pb-10 pt-8 sm:px-6"><p className="text-xs uppercase tracking-[.2em] text-brand">Create on BVS</p><h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Start as a listener. Grow into a creator.</h1><p className="mt-4 max-w-2xl text-text-secondary">Your BVS identity can become an artist, producer, writer or show-creator workspace without creating another account.</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{roles.map(([title, copy]) => <div key={title} className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm text-text-secondary">{copy}</p></div>)}</div><div className="mt-7 flex flex-wrap gap-2"><Link href={`/app/${surface}/join`} className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 font-semibold text-black">Join BVS</Link><Link href={`/auth/login?next=${encodeURIComponent(`/app/${surface}/studio`)}`} className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5">Sign in</Link></div></div>
  );

  if (!isCreator) return (
    <div className="mx-auto max-w-4xl px-4 pb-10 pt-8 sm:px-6"><p className="text-xs uppercase tracking-[.2em] text-brand">Create on BVS</p><h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Your account is ready for the next role.</h1><p className="mt-4 max-w-2xl text-text-secondary">Listening remains available to every BVS account. Creator roles add publishing and business tools after the appropriate BVS workflow.</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{roles.map(([title, copy]) => <div key={title} className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm text-text-secondary">{copy}</p></div>)}</div><Link href="/account" className="mt-7 inline-flex min-h-11 items-center rounded-full bg-brand px-5 font-semibold text-black">Open role application</Link></div>
  );

  const work = [
    ...(access?.artist ? [{ href: `/app/${surface}/studio/release`, title: "Release music", copy: "Securely upload a single, EP or album with rights evidence." }] : []),
    ...(access?.producer ? [{ href: `/app/${surface}/studio/beats`, title: "BeatStore", copy: "Upload beats and packs, then manage your producer catalogue." }] : []),
    { href: `/app/${surface}/studio/insights`, title: "Insights", copy: "See qualified attention, listening and creator performance signals." },
    { href: `/app/${surface}/studio/money`, title: "Money", copy: "Understand wallet, settlements and payable balances separately." },
    { href: `/app/${surface}/studio/marketplace`, title: "Marketplace", copy: "Manage your creator profile, products and professional services." },
    { href: `/app/${surface}/studio/orders`, title: "Orders", copy: "Track service work, customer orders and delivery." },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-6 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">BVS Studio</p>
      <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">What needs you today?</h1><p className="mt-3 max-w-2xl text-sm text-text-secondary">Release, respond, sell, deliver and understand your money from the same BVS identity.</p></div>{premiumActive ? <span className="shrink-0 rounded-full border border-brand/35 bg-brand/10 px-4 py-2 text-xs font-semibold text-brand">Premium · {premiumPlanLabel || "Active"}</span> : null}</div>

      <section className="mt-7 rounded-[1.75rem] border border-white/10 bg-white/[.025] p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-brand">Action inbox</p><h2 className="mt-1 text-2xl font-semibold">{workspaceLoading ? "Checking your work…" : tasks.length ? `${tasks.length} item${tasks.length === 1 ? "" : "s"} need attention` : "You’re clear right now"}</h2></div>{workspace ? <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-text-secondary">{(workspace.releases || []).length} releases · {(workspace.tracks || []).length} tracks</span> : null}</div>{workspaceError ? <p className="mt-3 text-sm text-red-300">{workspaceError}</p> : null}<div className="mt-4 space-y-2">{tasks.map((task) => <Link key={task.id} href={task.href} className={`block rounded-2xl border p-4 ${task.tone === "urgent" ? "border-amber-300/25 bg-amber-300/[.05]" : "border-white/10 bg-black/10"}`}><p className="text-xs uppercase tracking-[.14em] text-brand">{task.eyebrow}</p><div className="mt-1 flex items-center justify-between gap-3"><h3 className="font-semibold">{task.title}</h3><span className="text-brand">→</span></div><p className="mt-1 line-clamp-2 text-sm text-text-secondary">{task.note}</p></Link>)}</div>{!workspaceLoading && !workspaceError && !tasks.length ? <p className="mt-4 text-sm text-text-secondary">No editorial changes, failed distribution jobs or assigned work currently need a response. You can keep publishing or review insights below.</p> : null}</section>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">{work.map((item) => <Link key={item.href} href={item.href} className="rounded-[1.5rem] border border-white/10 bg-white/[.025] p-5 transition hover:-translate-y-0.5 hover:border-brand/35"><p className="text-xs uppercase tracking-[.14em] text-brand">Studio workflow</p><h2 className="mt-2 text-xl font-semibold">{item.title}</h2><p className="mt-2 text-sm text-text-secondary">{item.copy}</p></Link>)}</div>
      <div className="mt-7 flex flex-wrap gap-2 text-xs text-text-secondary"><span className="rounded-full border border-white/10 px-3 py-1.5">Artist {access?.artist ? "✓" : ""}</span><span className="rounded-full border border-white/10 px-3 py-1.5">Producer {access?.producer ? "✓" : ""}</span><span className="rounded-full border border-white/10 px-3 py-1.5">Writer {access?.writer ? "✓" : ""}</span><span className="rounded-full border border-white/10 px-3 py-1.5">Shows {access?.showCreator ? "✓" : ""}</span></div>
      {(access?.writer || access?.showCreator) ? <Link href="/creator/studio/manage" className="mt-6 inline-flex text-sm text-text-secondary hover:text-brand">Open advanced writer/show workspace →</Link> : null}
    </div>
  );
}
