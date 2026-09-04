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

type WorkspaceTrack = { id: string; title: string; editorial_status?: string; editorial_notes?: string; in_rotation?: boolean; is_public?: boolean; release_id?: string | null };
type WorkspaceRelease = { id: string; title: string; editorial_status?: string; editorial_notes?: string; is_public?: boolean; in_rotation?: boolean };
type DistributionJob = { id: string; release_id?: string | null; status?: string; public_note?: string; updated_at?: string };
type WorkflowItem = { id: string; title?: string; topic?: string; status?: string; editor_notes?: string; review_notes?: string; request_type?: string; staff_notes?: string; message?: string };
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
type PathStep = { label: string; note: string; href: string; state: "done" | "current" | "next" };

const needsCreatorAction = (status?: string) => ["changes_requested", "information_requested", "rejected", "failed", "action_required", "needs_action"].includes(String(status || "").toLowerCase());
const normalize = (status?: string) => String(status || "").toLowerCase();

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
    for (const request of workspace.trackRequests || []) {
      const status = normalize(request.status);
      if (!["open", "reviewing", "information_requested", "changes_requested", "action_required"].includes(status)) continue;
      const urgent = needsCreatorAction(status);
      out.push({
        id: `request-${request.id}`,
        eyebrow: urgent ? "Artist request · action needed" : "Artist request",
        title: String(request.request_type || "Track request").replaceAll("_", " "),
        note: request.staff_notes || (status === "reviewing" ? "BVS is reviewing your request." : request.message || `Status: ${status.replaceAll("_", " ")}.`),
        href: `/app/${surface}/studio/release`,
        tone: urgent ? "urgent" : "normal",
      });
    }
    for (const job of workspace.distributionJobs || []) {
      if (needsCreatorAction(job.status)) out.push({ id: `distribution-${job.id}`, eyebrow: "Store delivery", title: "Distribution action required", note: job.public_note || "Store delivery needs attention.", href: `/app/${surface}/studio/release`, tone: "urgent" });
    }
    for (const brief of workspace.briefs || []) {
      if (["assigned", "changes_requested"].includes(String(brief.status || ""))) out.push({ id: `brief-${brief.id}`, eyebrow: "Editorial brief", title: brief.title || brief.topic || "Research brief", note: brief.editor_notes || brief.review_notes || "Open the brief and continue the assigned work.", href: `/app/${surface}/studio` });
    }
    for (const show of workspace.shows || []) {
      if (needsCreatorAction(show.status)) out.push({ id: `show-${show.id}`, eyebrow: "Show review", title: show.title || "Show submission", note: show.review_notes || "Your show submission needs an update.", href: `/app/${surface}/studio`, tone: "urgent" });
    }
    return out.slice(0, 8);
  }, [surface, workspace]);

  const artistPath = useMemo(() => {
    if (!access?.artist) return null;
    const releases = workspace?.releases || [];
    const tracks = workspace?.tracks || [];
    const jobs = workspace?.distributionJobs || [];
    const focalRelease = releases[0] || null;
    const focalTrack = !focalRelease ? tracks[0] || null : null;
    const relatedTracks = focalRelease ? tracks.filter((track) => track.release_id === focalRelease.id) : (focalTrack ? [focalTrack] : []);
    const focalStatuses = [
      ...(focalRelease ? [normalize(focalRelease.editorial_status)] : []),
      ...relatedTracks.map((item) => normalize(item.editorial_status)),
    ].filter(Boolean);
    const hasWork = Boolean(focalRelease || focalTrack);
    const hasAction = [focalRelease, ...relatedTracks].filter(Boolean).some((item) => needsCreatorAction(item?.editorial_status));
    const submitted = focalStatuses.some((status) => status !== "draft");
    const approved = focalStatuses.some((status) => ["approved", "published", "live"].includes(status));
    const reviewInProgress = focalStatuses.some((status) => ["submitted", "in_review"].includes(status));
    const live = Boolean(focalRelease?.is_public || focalRelease?.in_rotation || focalTrack?.is_public || focalTrack?.in_rotation || focalStatuses.some((status) => ["published", "live"].includes(status)));
    const focalJob = focalRelease ? jobs.find((job) => job.release_id === focalRelease.id) : undefined;
    const distro = normalize(focalJob?.status);
    const distributionDelivered = ["live_on_dsp", "live", "delivered", "complete", "completed", "distributed"].includes(distro);
    const distributionInFlight = ["queued", "submitted"].includes(distro);
    const distributionEligible = distro === "eligible";
    const distributionBlocked = ["not_eligible", "failed", "cancelled"].includes(distro);
    const distributionNote = distributionDelivered ? "Live on stores" : distributionInFlight ? "Store review" : distributionEligible ? "Eligible" : distributionBlocked ? "BVS live only" : "Store path";

    const raw = [
      { label: "Create", note: "Music + rights prepared", href: `/app/${surface}/studio/release`, done: hasWork },
      { label: "Submit", note: "Sent to editorial", href: `/app/${surface}/studio/release`, done: submitted },
      { label: "Review", note: hasAction ? "Changes needed" : reviewInProgress ? "Editorial checking" : "Editorial checks", href: `/app/${surface}/studio/release`, done: approved },
      { label: "Approved", note: "Cleared to publish", href: `/app/${surface}/studio/release`, done: approved },
      { label: "Live", note: "Visible / playable", href: `/app/${surface}/studio/release`, done: live },
      { label: "Distribution", note: distributionNote, href: `/app/${surface}/studio/release`, done: distributionDelivered },
      { label: "Performance", note: "Qualified attention", href: `/app/${surface}/studio/insights`, done: live },
      { label: "Money", note: "Wallet + settlements", href: `/app/${surface}/studio/money`, done: live },
    ];
    let firstOpen = raw.findIndex((step) => !step.done);
    if (firstOpen < 0) firstOpen = raw.length - 1;
    const steps = raw.map<PathStep>((step, index) => ({ label: step.label, note: step.note, href: step.href, state: step.done ? "done" : index === firstOpen ? "current" : "next" }));

    let next = { title: "Upload your first release", copy: "Start with one track or release and add the rights evidence BVS needs for review.", href: `/app/${surface}/studio/release`, cta: "Start release" };
    if (hasAction) next = { title: "Editorial needs a change", copy: "Open the release workflow, read the review note and submit the requested correction.", href: `/app/${surface}/studio/release`, cta: "Resolve review" };
    else if (hasWork && !submitted) next = { title: "Finish and submit your draft", copy: "Your release is still being prepared and has not entered editorial review yet.", href: `/app/${surface}/studio/release`, cta: "Continue release" };
    else if (submitted && !approved) next = { title: "Editorial review is in progress", copy: "The release page shows the current state. Any requested change will also appear in your Studio inbox.", href: `/app/${surface}/studio/release`, cta: "View status" };
    else if (approved && !live) next = { title: "Approved — waiting to publish", copy: "The release is cleared. BVS publication and store delivery remain separate states so you always know what is actually live.", href: `/app/${surface}/studio/release`, cta: "Open release" };
    else if (live && distributionInFlight) next = { title: "Store delivery is in progress", copy: "Your release is already live on BVS. Wider store delivery is now in the queue or store-review stage.", href: `/app/${surface}/studio/release`, cta: "Track delivery" };
    else if (live && distributionEligible) next = { title: "Eligible for wider delivery", copy: "Your release is live on BVS and its packaging is eligible for the BVS store-delivery queue.", href: `/app/${surface}/studio/release`, cta: "View distribution" };
    else if (live && distributionBlocked) next = { title: "Your release is live on BVS", copy: "BVS listening is active. Wider store delivery is a separate optional path and is not active for this release right now.", href: `/app/${surface}/studio/release`, cta: "View release" };
    else if (live && distributionDelivered) next = { title: "Your release is live — measure the proof", copy: "Open Insights for qualified listening attention, then Money for balances and settlements.", href: `/app/${surface}/studio/insights`, cta: "Open Insights" };
    else if (live) next = { title: "Your release is live on BVS", copy: "Listener playback is active. The release page will show wider delivery separately if and when it starts.", href: `/app/${surface}/studio/release`, cta: "View release" };

    return { steps, next, focusTitle: focalRelease?.title || focalTrack?.title || "Your next release" };
  }, [access?.artist, surface, workspace]);

  if (loading) return <div className="mx-auto max-w-5xl px-4 pt-8"><div className="h-48 animate-pulse rounded-[2rem] bg-white/[.04]" /></div>;

  if (!signedIn) return (
    <div className="mx-auto max-w-4xl px-4 pb-10 pt-8 sm:px-6"><p className="text-xs uppercase tracking-[.2em] text-brand">Create on BVS</p><h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Start as a listener. Grow into a creator.</h1><p className="mt-4 max-w-2xl text-text-secondary">Your BVS identity can become an artist, producer, writer or show-creator workspace without creating another account.</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{roles.map(([title, copy]) => <div key={title} className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm text-text-secondary">{copy}</p></div>)}</div><div className="mt-7 flex flex-wrap gap-2"><Link href={`/app/${surface}/join`} className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 font-semibold text-black">Join BVS</Link><Link href={`/auth/login?next=${encodeURIComponent(`/app/${surface}/studio`)}`} className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5">Sign in</Link></div></div>
  );

  if (!isCreator) return (
    <div className="mx-auto max-w-4xl px-4 pb-10 pt-8 sm:px-6"><p className="text-xs uppercase tracking-[.2em] text-brand">Create on BVS</p><h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Your account is ready for the next role.</h1><p className="mt-4 max-w-2xl text-text-secondary">Listening remains available to every BVS account. Creator roles add publishing and business tools after the appropriate BVS workflow.</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{roles.map(([title, copy]) => <div key={title} className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm text-text-secondary">{copy}</p></div>)}</div><Link href={`/app/${surface}/account#creator-role`} className="mt-7 inline-flex min-h-11 items-center rounded-full bg-brand px-5 font-semibold text-black">Open role application</Link></div>
  );

  const work = [
    ...(access?.artist ? [{ href: `/app/${surface}/studio/release`, title: "Release music", copy: "Securely submit a single, EP or album with rights evidence and follow every review state." }] : []),
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

      {artistPath ? <section className="mt-7 rounded-[1.75rem] border border-brand/20 bg-brand/[.04] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-brand">Artist path</p><h2 className="mt-1 text-2xl font-semibold">One release, from upload to money.</h2><p className="mt-1 text-xs text-text-secondary">Following: {artistPath.focusTitle}</p></div><Link href={artistPath.next.href} className="min-h-10 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black">{artistPath.next.cta}</Link></div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{artistPath.steps.map((step, index) => <Link key={step.label} href={step.href} className={`rounded-2xl border p-3 ${step.state === "done" ? "border-brand/30 bg-brand/10" : step.state === "current" ? "border-amber-300/35 bg-amber-300/[.06]" : "border-white/10 bg-black/10"}`}><div className="flex items-center justify-between gap-2"><span className="text-xs text-text-secondary">{index + 1}</span><span className="text-xs">{step.state === "done" ? "✓" : step.state === "current" ? "Now" : ""}</span></div><h3 className="mt-2 font-semibold">{step.label}</h3><p className="mt-1 text-xs text-text-secondary">{step.note}</p></Link>)}</div><div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-4"><p className="text-xs uppercase tracking-[.14em] text-brand">Next step</p><h3 className="mt-1 font-semibold">{artistPath.next.title}</h3><p className="mt-1 text-sm text-text-secondary">{artistPath.next.copy}</p></div></section> : null}

      <section className="mt-7 rounded-[1.75rem] border border-white/10 bg-white/[.025] p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-brand">Studio inbox</p><h2 className="mt-1 text-2xl font-semibold">{workspaceLoading ? "Checking your work…" : tasks.length ? `${tasks.length} active item${tasks.length === 1 ? "" : "s"}` : "You’re clear right now"}</h2></div>{workspace ? <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-text-secondary">{(workspace.releases || []).length} releases · {(workspace.tracks || []).length} tracks</span> : null}</div>{workspaceError ? <p className="mt-3 text-sm text-red-300">{workspaceError}</p> : null}<div className="mt-4 space-y-2">{tasks.map((task) => <Link key={task.id} href={task.href} className={`block rounded-2xl border p-4 ${task.tone === "urgent" ? "border-amber-300/25 bg-amber-300/[.05]" : "border-white/10 bg-black/10"}`}><p className="text-xs uppercase tracking-[.14em] text-brand">{task.eyebrow}</p><div className="mt-1 flex items-center justify-between gap-3"><h3 className="font-semibold capitalize">{task.title}</h3><span className="text-brand">→</span></div><p className="mt-1 line-clamp-2 text-sm text-text-secondary">{task.note}</p></Link>)}</div>{!workspaceLoading && !workspaceError && !tasks.length ? <p className="mt-4 text-sm text-text-secondary">No editorial changes, open artist requests, failed store-delivery jobs or assigned work currently need your attention.</p> : null}</section>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">{work.map((item) => <Link key={item.href} href={item.href} className="rounded-[1.5rem] border border-white/10 bg-white/[.025] p-5 transition hover:-translate-y-0.5 hover:border-brand/35"><p className="text-xs uppercase tracking-[.14em] text-brand">Studio workflow</p><h2 className="mt-2 text-xl font-semibold">{item.title}</h2><p className="mt-2 text-sm text-text-secondary">{item.copy}</p></Link>)}</div>
      <div className="mt-7 flex flex-wrap gap-2 text-xs text-text-secondary"><span className="rounded-full border border-white/10 px-3 py-1.5">Artist {access?.artist ? "✓" : ""}</span><span className="rounded-full border border-white/10 px-3 py-1.5">Producer {access?.producer ? "✓" : ""}</span><span className="rounded-full border border-white/10 px-3 py-1.5">Writer {access?.writer ? "✓" : ""}</span><span className="rounded-full border border-white/10 px-3 py-1.5">Shows {access?.showCreator ? "✓" : ""}</span></div>
    </div>
  );
}
