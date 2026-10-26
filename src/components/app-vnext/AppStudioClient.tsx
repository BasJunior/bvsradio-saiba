"use client";

import Link from "next/link";
import BvsStar from "@/components/branding/BvsStar";
import CreatorGrowthPanel from '@/components/CreatorGrowthPanel';
import { useMemo } from "react";
import { useAccountJson } from "@/lib/use-account-json";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import { CreatorReleaseWorkCounts } from "@/components/CreatorReleaseProgress";
import {
  buildCreatorReleaseProgress,
  isCreatorReleaseActionRequired,
  latestDistributionJob,
  type ReleaseWorkGroup,
} from "@/lib/creator-release-progress";

const roles = [
  ["Artist", "Release music, follow review, see what is live and understand what happens next.", "core"],
  ["Producer", "Publish beats, manage packs and build your BeatStore catalogue.", "beats"],
  ["Writer", "Work on stories, research and editorial assignments.", "insights"],
  ["Show creator", "Build programmes, episodes and live-show workflows.", "shows"],
];

type WorkspaceTrack = { id: string; title: string; editorial_status?: string; editorial_notes?: string; in_rotation?: boolean; is_public?: boolean; release_id?: string | null };
type WorkspaceRelease = { id: string; title: string; editorial_status?: string; editorial_notes?: string; is_public?: boolean; in_rotation?: boolean };
type DistributionJob = { id: string; release_id?: string | null; status?: string; updated_at?: string; created_at?: string };
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

type StudioAccent = "core" | "beats" | "marketplace" | "insights" | "shows" | "money";
type Task = { id: string; eyebrow: string; title: string; note: string; href: string; tone?: "urgent" | "normal" };
type PathStep = { label: string; note: string; href: string; state: "done" | "current" | "next" };

const needsCreatorAction = (status?: string) => ["changes_requested", "information_requested", "rejected", "failed", "action_required", "needs_action"].includes(String(status || "").toLowerCase());
const normalize = (status?: string) => String(status || "").toLowerCase();

export default function AppStudioClient({ surface }: { surface: AppSurface }) {
  const { loading, signedIn, isCreator, access, premiumActive, premiumPlanLabel, token, user } = useAppSession();
  const { data: workspace, loading: workspaceLoading, error: workspaceError, reload } = useAccountJson<Workspace>({
    owner: user?.id || "", token, url: "/api/creator/workspace", enabled: isCreator,
    errorMessage: "Studio workspace is unavailable.",
  });

  const tasks = useMemo<Task[]>(() => {
    if (!workspace) return [];
    const out: Task[] = [];
    for (const release of workspace.releases || []) {
      if (isCreatorReleaseActionRequired(release.editorial_status)) {
        const progress = buildCreatorReleaseProgress({
          editorialStatus: release.editorial_status,
          editorialNotes: release.editorial_notes,
          isPublic: release.is_public,
          inRotation: release.in_rotation,
        });
        out.push({ id: `release-${release.id}`, eyebrow: "Release review", title: release.title, note: release.editorial_notes || progress.nextStep, href: `/app/${surface}/studio/release`, tone: "urgent" });
      }
    }
    for (const track of workspace.tracks || []) {
      if (isCreatorReleaseActionRequired(track.editorial_status)) {
        const progress = buildCreatorReleaseProgress({
          editorialStatus: track.editorial_status,
          editorialNotes: track.editorial_notes,
          isPublic: track.is_public,
          inRotation: track.in_rotation,
        });
        out.push({ id: `track-${track.id}`, eyebrow: "Track review", title: track.title, note: track.editorial_notes || progress.nextStep, href: `/app/${surface}/support?topic=music`, tone: "urgent" });
      }
    }
    for (const request of workspace.trackRequests || []) {
      const status = normalize(request.status);
      if (!["information_requested", "changes_requested", "action_required", "needs_action"].includes(status)) continue;
      out.push({
        id: `request-${request.id}`,
        eyebrow: "Artist request · action needed",
        title: String(request.request_type || "Track request").replaceAll("_", " "),
        note: request.staff_notes || request.message || `Status: ${status.replaceAll("_", " ")}.`,
        href: `/app/${surface}/studio/release`,
        tone: "urgent",
      });
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
    const focalItems = [focalRelease, ...relatedTracks].filter(Boolean);
    const hasWork = Boolean(focalRelease || focalTrack);
    const hasAction = focalItems.some((item) => isCreatorReleaseActionRequired(item?.editorial_status));
    const hasDraft = focalStatuses.some((status) => status === "draft");
    const live = Boolean(focalRelease?.is_public || focalTrack?.is_public);
    const hasUnknownEditorial = focalItems.some((item) => {
      const status = normalize(item?.editorial_status);
      return !status || !["draft", "submitted", "in_review", "pending", "under_review", "approved", "published", "live", "changes_requested", "information_requested", "rejected", "action_required", "needs_action"].includes(status);
    });
    const submitted = live || focalStatuses.some((status) => ["submitted", "in_review", "pending", "under_review", "approved", "published", "live", "changes_requested", "information_requested", "rejected", "action_required", "needs_action"].includes(status));
    const approved = focalStatuses.some((status) => ["approved", "published", "live"].includes(status));
    const reviewInProgress = focalStatuses.some((status) => ["submitted", "in_review", "pending", "under_review"].includes(status));
    const focalJob = focalRelease ? latestDistributionJob(jobs.filter((job) => job.release_id === focalRelease.id)) : undefined;
    const distro = normalize(focalJob?.status);
    const distributionDelivered = distro === "live_on_dsp";
    const distributionInFlight = ["queued", "submitted", "processing", "delivering"].includes(distro);
    const distributionEligible = distro === "eligible";
    const distributionBlocked = ["not_eligible", "cancelled"].includes(distro);
    const distributionUnknown = Boolean(distro) && !distributionDelivered && !distributionInFlight && !distributionEligible && !distributionBlocked && distro !== "failed";
    const distributionNote = distributionDelivered ? "Live on stores" : distro === "failed" ? "Needs attention" : distributionInFlight ? "Store review" : distributionEligible ? "Eligible" : distributionBlocked ? "BVS live only" : distributionUnknown ? `Status: ${distro.replaceAll("_", " ")}` : "Not started";

    const raw = [
      { label: "Create", note: "Music + rights prepared", href: `/app/${surface}/studio/release`, done: hasWork },
      { label: "Submit", note: hasDraft ? "Existing draft · contact BVS" : "Sent to editorial", href: `/app/${surface}/studio/release`, done: submitted },
      { label: "Review", note: hasDraft ? "After BVS confirms next step" : hasAction ? "Changes needed" : hasUnknownEditorial ? "Status needs clarification" : reviewInProgress ? "Editorial checking" : "Editorial checks", href: `/app/${surface}/studio/release`, done: approved },
      { label: "Approved", note: "Cleared to publish", href: `/app/${surface}/studio/release`, done: approved },
      { label: "Live", note: "Visible / playable", href: `/app/${surface}/studio/release`, done: live },
      { label: "Distribution", note: distributionNote, href: `/app/${surface}/studio/release`, done: distributionDelivered },
      { label: "Performance", note: "Audience signals", href: `/app/${surface}/studio/insights`, done: live },
      { label: "Money", note: "Wallet + settlements", href: `/app/${surface}/studio/money`, done: live },
    ];
    let firstOpen = raw.findIndex((step) => !step.done);
    if (firstOpen < 0) firstOpen = raw.length - 1;
    const steps = raw.map<PathStep>((step, index) => ({ label: step.label, note: step.note, href: step.href, state: step.done ? "done" : index === firstOpen ? "current" : "next" }));

    let next = { title: "Start your first release", copy: "Upload your music, add the ownership details BVS needs and send it into review.", href: `/app/${surface}/studio/release`, cta: "Start release" };
    if (hasAction) next = { title: "This release needs attention", copy: "Open the release, read the status note, then use Contact editorial for this existing submission. Editing and resubmission are not available on the status screen.", href: `/app/${surface}/studio/release`, cta: "Review next step" };
    else if (hasUnknownEditorial) next = { title: "BVS is checking the editorial status", copy: live ? "BVS playback is live, but the editorial state is not recognized as complete. BVS must clarify it; nothing is required from you right now." : "The editorial state is not mapped to a creator action. BVS must clarify it; nothing is required from you right now.", href: `/app/${surface}/studio/release`, cta: "View status" };
    else if (hasWork && !submitted) next = { title: "Finish your draft", copy: "Your release is still being prepared and has not entered review yet.", href: `/app/${surface}/studio/release`, cta: "Continue release" };
    else if (submitted && !approved) next = { title: "Your release is in review", copy: "You’re done for now. Any request from editorial will appear here and in your Inbox.", href: `/app/${surface}/studio/release`, cta: "View status" };
    else if (approved && !live) next = { title: "Approved — publishing is next", copy: "Editorial approval is complete. BVS publication and wider store delivery remain separate so you always know what is actually live.", href: `/app/${surface}/studio/release`, cta: "Open release" };
    else if (live && distributionInFlight) next = { title: "Wider delivery is moving", copy: "Your release is already live on BVS. Store delivery is now in the queue or review stage.", href: `/app/${surface}/studio/release`, cta: "Track delivery" };
    else if (live && distributionEligible) next = { title: "Ready for wider delivery", copy: "Your release is live on BVS and eligible to enter the store-delivery path.", href: `/app/${surface}/studio/release`, cta: "View distribution" };
    else if (live && distro === "failed") next = { title: "BVS is checking store delivery", copy: "BVS playback is still live. BVS must confirm the delivery issue and share a specific correction before anything is required from you.", href: `/app/${surface}/studio/release`, cta: "View status" };
    else if (live && distributionUnknown) next = { title: "BVS is checking the store status", copy: `BVS playback is live. The store status “${distro.replaceAll("_", " ")}” is not a confirmed live state, so BVS must clarify it.`, href: `/app/${surface}/studio/release`, cta: "View status" };
    else if (live && distributionBlocked) next = { title: "Your release is live on BVS", copy: "Listening is active here. Wider store delivery is a separate optional path and is not active for this release right now.", href: `/app/${surface}/studio/release`, cta: "View release" };
    else if (live && distributionDelivered) next = { title: "You’re live. Now see what it’s doing.", copy: "Open Insights for listening activity, then Money for balances and settlements.", href: `/app/${surface}/studio/insights`, cta: "Open Insights" };
    else if (live) next = { title: "Your release is live", copy: "People can listen on BVS now. Wider delivery will appear separately if and when it starts.", href: `/app/${surface}/studio/release`, cta: "View release" };

    return { steps, next, focusTitle: focalRelease?.title || focalTrack?.title || "Your next release" };
  }, [access?.artist, surface, workspace]);

  const releaseCounts = useMemo(() => {
    const counts: Record<ReleaseWorkGroup, number> = { action_required: 0, in_progress: 0, history: 0 };
    for (const release of workspace?.releases || []) {
      const job = latestDistributionJob((workspace?.distributionJobs || []).filter((item) => item.release_id === release.id));
      const progress = buildCreatorReleaseProgress({
        editorialStatus: release.editorial_status,
        editorialNotes: release.editorial_notes,
        isPublic: release.is_public,
        inRotation: release.in_rotation,
        distributionStatus: job?.status,
      });
      counts[progress.group] += 1;
    }
    return counts;
  }, [workspace]);

  if (loading) return <div className="mx-auto max-w-5xl px-4 pt-8"><div className="h-48 animate-pulse rounded-[2rem] bg-white/[.035]" /></div>;

  if (!signedIn) return (
    <div className="bvs-native-studio mx-auto max-w-4xl px-4 pb-12 pt-8 sm:px-6">
      <div className="bvs-culture-sticker"><BvsStar /> BVS Studio</div>
      <h1 className="bvs-studio-title mt-5 max-w-3xl text-4xl font-semibold sm:text-6xl">Make something. Build from there.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-white/65 sm:text-base">One BVS identity can grow into the creator workspace you need — artist, producer, writer or show creator.</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">{roles.map(([title, copy, accent]) => <div key={title} data-studio-accent={accent} className="bvs-studio-role rounded-[1.4rem] border p-5"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-white/60">{copy}</p></div>)}</div>
      <div className="mt-7 flex flex-wrap gap-2.5"><Link href={`/app/${surface}/join`} className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 font-semibold text-black transition hover:bg-brand-dark">Create account</Link><Link href={`/app/${surface}/login?next=${encodeURIComponent(`/app/${surface}/studio`)}`} className="inline-flex min-h-11 items-center rounded-full border border-white/12 px-5 text-white/64">Sign in</Link></div>
    </div>
  );

  if (!isCreator) return (
    <div className="bvs-native-studio mx-auto max-w-4xl px-4 pb-12 pt-8 sm:px-6">
      <div className="bvs-culture-sticker"><BvsStar /> BVS Studio</div>
      <h1 className="bvs-studio-title mt-5 max-w-3xl text-4xl font-semibold sm:text-6xl">Ready when you are.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-white/65 sm:text-base">Your listening account stays exactly as it is. Creator access adds the tools for the work you want to do.</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">{roles.map(([title, copy, accent]) => <div key={title} data-studio-accent={accent} className="bvs-studio-role rounded-[1.4rem] border p-5"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-white/60">{copy}</p></div>)}</div>
      <Link href={`/app/${surface}/account#creator-role`} className="mt-7 inline-flex min-h-11 items-center rounded-full bg-brand px-5 font-semibold text-black">Choose creator access</Link>
    </div>
  );

  const work: Array<{ href: string; title: string; copy: string; accent: StudioAccent }> = [
    ...(access?.artist ? [{ href: `/app/${surface}/studio/release`, title: "Releases", copy: "Upload music, follow review and see exactly what is live.", accent: "core" as const }] : []),
    ...(access?.producer ? [{ href: `/app/${surface}/studio/beats`, title: "BeatStore", copy: "Upload beats and packs, then manage your producer catalogue.", accent: "beats" as const }] : []),
    { href: `/app/${surface}/studio/insights`, title: "Insights", copy: "See listening activity and the signals that matter.", accent: "insights" },
    { href: `/app/${surface}/studio/money`, title: "Money", copy: "Understand balances, settlements and what is payable.", accent: "money" },
    { href: `/app/${surface}/studio/marketplace`, title: "Marketplace", copy: "Manage your creator profile, products and services.", accent: "marketplace" },
    { href: `/app/${surface}/studio/orders`, title: "Orders", copy: "Track client work, customer orders and delivery.", accent: "marketplace" },
  ];

  return (
    <div className="bvs-native-studio mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-6">
      <div className="bvs-culture-sticker"><BvsStar /> BVS Studio</div>
      <div className="bvs-studio-intro mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="bvs-studio-title max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">Make your next move.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/65 sm:text-base">Create. Publish. Build your next chapter.</p>
        </div>
        {premiumActive ? <span data-studio-accent="money" className="bvs-studio-accent-button shrink-0 rounded-full border px-4 py-2 text-xs font-semibold">Premium · {premiumPlanLabel || "Active"}</span> : null}
      </div>

      {artistPath ? (
        <section data-studio-accent="core" className="bvs-studio-release-path mt-8 rounded-[1.8rem] border p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="bvs-studio-accent-label text-[10px] font-semibold uppercase tracking-[.2em]">Current release</p>
              <h2 className="mt-2 text-3xl font-semibold">From upload to audience.</h2>
              <p className="mt-2 text-xs text-white/60">Following: {artistPath.focusTitle}</p>
            </div>
            <Link href={artistPath.next.href} className="min-h-11 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black transition hover:bg-brand-dark">{artistPath.next.cta}</Link>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {artistPath.steps.map((step, index) => (
              <Link key={step.label} href={step.href} className={`rounded-[1.2rem] border p-3 transition ${step.state === "done" ? "border-brand/22 bg-brand/[.07]" : step.state === "current" ? "border-white/18 bg-white/[.055]" : "border-white/[.06] bg-black/10"}`}>
                <div className="flex items-center justify-between gap-2"><span className="text-xs text-white/26">{index + 1}</span><span className="text-[10px] font-semibold uppercase tracking-[.12em] text-brand">{step.state === "done" ? "Done" : step.state === "current" ? "Now" : ""}</span></div>
                <h3 className="mt-2 font-semibold">{step.label}</h3>
                <p className="mt-1 text-xs leading-5 text-white/60">{step.note}</p>
              </Link>
            ))}
          </div>

          <div className="mt-4 rounded-[1.25rem] border border-white/[.07] bg-black/15 p-4">
            <p className="bvs-studio-accent-label text-[10px] font-semibold uppercase tracking-[.16em]">Next</p>
            <h3 className="mt-2 text-lg font-semibold">{artistPath.next.title}</h3>
            <p className="mt-2 text-sm leading-6 text-white/65">{artistPath.next.copy}</p>
          </div>
          {(workspace?.releases || []).length ? <div className="mt-4"><CreatorReleaseWorkCounts counts={releaseCounts} /></div> : null}
        </section>
      ) : null}

      <CreatorGrowthPanel key={user?.id} owner={user?.id || ''} token={token} surface={surface} />
      <section data-studio-accent="insights" className="mt-7 rounded-[1.7rem] border border-white/[.07] bg-white/[.022] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="bvs-studio-accent-label text-[10px] font-semibold uppercase tracking-[.2em]">Action inbox</p>
            <h2 className="mt-2 text-2xl font-semibold">{workspaceLoading ? "Checking your work…" : tasks.length ? `${tasks.length} item${tasks.length === 1 ? "" : "s"} need attention` : "Nothing needs you right now"}</h2>
          </div>
          {workspace ? <span className="rounded-full border border-white/[.07] px-3 py-1.5 text-xs text-white/60">{(workspace.releases || []).length} releases · {(workspace.tracks || []).length} tracks</span> : null}
        </div>
        {workspaceError ? <p role="alert" className="mt-3 text-sm text-red-300">{workspaceError} <button type="button" onClick={reload} className="min-h-11 px-3 underline">Try again</button></p> : null}
        <div className="mt-4 space-y-2">
          {tasks.map((task) => (
            <Link key={task.id} href={task.href} className={`block rounded-[1.2rem] border p-4 transition hover:bg-white/[.035] ${task.tone === "urgent" ? "border-amber-300/18 bg-amber-300/[.035]" : "border-white/[.07] bg-black/10"}`}>
              <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-brand">{task.eyebrow}</p>
              <div className="mt-1 flex items-center justify-between gap-3"><h3 className="font-semibold capitalize">{task.title}</h3><span className="text-white/46">→</span></div>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/60">{task.note}</p>
            </Link>
          ))}
        </div>
        {!workspaceLoading && !workspaceError && !tasks.length ? <p className="mt-4 text-sm text-white/60">You’re up to date. New review requests, delivery issues and assigned work will appear here.</p> : null}
      </section>

      <section className="mt-9">
        <p data-studio-accent="core" className="bvs-studio-accent-label text-[10px] font-semibold uppercase tracking-[.2em]">Workspace</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {work.map((item, index) => (
            <Link key={item.href} href={item.href} data-studio-accent={item.accent} className="bvs-studio-work-card bvs-studio-accent-card group rounded-[1.45rem] border border-white/[.07] bg-white/[.022] p-5 hover:-translate-y-0.5">
              <div className="mb-5 flex items-center justify-between"><span className="bvs-studio-accent-label text-xs font-bold tabular-nums">0{index + 1}</span><span className="bvs-studio-accent-label text-xl" aria-hidden="true">↗</span></div>
              <h2 className="text-xl font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/60">{item.copy}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-2 text-xs text-white/60">
        <span className="rounded-full border border-white/[.07] px-3 py-1.5">Artist {access?.artist ? "✓" : ""}</span>
        <span className="rounded-full border border-white/[.07] px-3 py-1.5">Producer {access?.producer ? "✓" : ""}</span>
        <span className="rounded-full border border-white/[.07] px-3 py-1.5">Writer {access?.writer ? "✓" : ""}</span>
        <span className="rounded-full border border-white/[.07] px-3 py-1.5">Shows {access?.showCreator ? "✓" : ""}</span>
      </div>
    </div>
  );
}
