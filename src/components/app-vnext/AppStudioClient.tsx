"use client";

import Link from "next/link";
import CreatorGrowthPanel from '@/components/CreatorGrowthPanel';
import { useMemo } from "react";
import { useAccountJson } from "@/lib/use-account-json";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import { LibIcon, type LibIconName } from "@/components/app-vnext/LibraryVisuals";
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

  if (loading) return (
    <div className="bvs-app-page mx-auto max-w-5xl px-4 pt-6 sm:px-6" data-app-accent="studio" aria-busy="true">
      <div className="bvs-app-skeleton h-3 w-24" /><div className="bvs-app-skeleton mt-2 h-10 w-44" />
      <div className="mt-6 grid grid-cols-2 gap-2.5">{[0, 1, 2, 3].map((key) => <div key={key} className="bvs-app-skeleton h-20" />)}</div>
    </div>
  );

  if (!signedIn || !isCreator) return (
    <div className="bvs-app-page bvs-app-studio mx-auto max-w-4xl px-4 pb-12 pt-5 sm:px-6" data-app-accent="studio">
      <StudioHeader title="Studio" eyebrow="BVS Studio" />
      <p className="mt-2 max-w-xl text-sm text-white/50">{signedIn ? "Your listening account stays exactly as it is. Creator access adds the tools for the work you want to do." : "One BVS identity can grow into the creator workspace you need."}</p>
      <section className="bvs-app-shelf" aria-labelledby="studio-roles-heading">
        <h2 id="studio-roles-heading" className="bvs-app-shelf-title">{signedIn ? "Choose your creator path" : "Make something. Build from there."}</h2>
        <div className="mt-2">
          {roles.map(([title, copy, accent]) => (
            <div key={title} className="bvs-app-row flex items-center gap-3 py-3">
              <StudioTile icon={roleIcon[title] || "sparkle"} accent={accent as StudioAccent} />
              <div className="min-w-0 flex-1"><h3 className="text-[15px] font-semibold">{title}</h3><p className="mt-0.5 text-[13px] leading-5 text-white/50">{copy}</p></div>
            </div>
          ))}
        </div>
      </section>
      <div className="mt-6 flex flex-wrap gap-2">
        {signedIn ? <Link href={`/app/${surface}/account#creator-role`} className="bvs-app-pill bvs-app-pill--primary min-h-11 px-5">Choose creator access</Link> : <>
          <Link href={`/app/${surface}/join`} className="bvs-app-pill bvs-app-pill--primary min-h-11 px-5">Create account</Link>
          <Link href={`/app/${surface}/login?next=${encodeURIComponent(`/app/${surface}/studio`)}`} className="bvs-app-pill min-h-11 px-5">Sign in</Link>
        </>}
      </div>
    </div>
  );

  const work: Array<{ href: string; title: string; copy: string; accent: StudioAccent; icon: LibIconName }> = [
    ...(access?.artist ? [{ href: `/app/${surface}/studio/release`, title: "Releases", copy: "Upload, review, live", accent: "core" as const, icon: "upload" as const }] : []),
    ...(access?.producer ? [{ href: `/app/${surface}/studio/beats`, title: "BeatStore", copy: "Beats and packs", accent: "beats" as const, icon: "waveform" as const }] : []),
    { href: `/app/${surface}/studio/insights`, title: "Insights", copy: "Listening signals", accent: "insights", icon: "chart" },
    { href: `/app/${surface}/studio/money`, title: "Money", copy: "Balances, settlements", accent: "money", icon: "wallet" },
    { href: `/app/${surface}/studio/marketplace`, title: "Marketplace", copy: "Profile, products", accent: "marketplace", icon: "briefcase" },
    { href: `/app/${surface}/studio/orders`, title: "Orders", copy: "Client work, delivery", accent: "marketplace", icon: "check" },
  ];
  const doneSteps = artistPath ? artistPath.steps.filter((step) => step.state === "done").length : 0;
  const createHref = access?.artist ? `/app/${surface}/studio/release` : access?.producer ? `/app/${surface}/studio/beats` : null;

  return (
    <div className="bvs-app-page bvs-app-studio mx-auto max-w-5xl px-4 pb-12 pt-5 sm:px-6" data-app-accent="studio">
      <StudioHeader title="Studio" eyebrow={premiumActive ? `BVS Studio · Premium ${premiumPlanLabel || "Active"}` : "BVS Studio"} createHref={createHref} />
      <p className="mt-2 text-sm text-white/50">Create. Publish. Build your next chapter.</p>

      <section className="mt-5" aria-labelledby="studio-workspace-heading">
        <h2 id="studio-workspace-heading" className="sr-only">Workspace</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {work.map((item) => (
            <Link key={item.href} href={item.href} className="bvs-app-card group flex items-center gap-3 p-2.5">
              <StudioTile icon={item.icon} accent={item.accent} />
              <span className="min-w-0"><span className="block truncate text-sm font-semibold">{item.title}</span><span className="block truncate text-xs text-white/45">{item.copy}</span></span>
            </Link>
          ))}
        </div>
      </section>

      {artistPath ? (
        <section className="bvs-app-shelf" aria-labelledby="studio-release-heading">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="bvs-app-eyebrow">Current release · {doneSteps}/{artistPath.steps.length}</p>
              <h2 id="studio-release-heading" className="bvs-app-shelf-title mt-1">{artistPath.focusTitle}</h2>
            </div>
          </div>
          <div className="mt-3 h-1 w-full bg-white/[.08]" aria-hidden="true"><div className="h-full bg-[#a3dbff] transition-all" style={{ width: `${Math.round((doneSteps / artistPath.steps.length) * 100)}%` }} /></div>
          <ol className="bvs-app-rail -mx-4 mt-3 px-4 sm:-mx-6 sm:px-6" aria-label="Release steps">
            {artistPath.steps.map((step, index) => (
              <li key={step.label} className="w-[8.25rem]">
                <Link href={step.href} aria-current={step.state === "current" ? "step" : undefined} className={`flex h-full flex-col border p-3 transition ${step.state === "done" ? "border-[#a3dbff]/30 bg-[#a3dbff]/[.06]" : step.state === "current" ? "border-white/40 bg-white/[.06]" : "border-white/10"}`}>
                  <span className="flex items-center justify-between text-[11px] text-white/40"><span className="tabular-nums">{index + 1}</span>{step.state === "done" ? <LibIcon name="check" size={14} className="text-[#a3dbff]" /> : step.state === "current" ? <span className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#c1ff52]">Now</span> : null}</span>
                  <span className="mt-2 text-sm font-semibold">{step.label}</span>
                  <span className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-white/50">{step.note}</span>
                </Link>
              </li>
            ))}
          </ol>
          <div className="mt-3 border border-white/12 bg-[#121214] p-4">
            <p className="bvs-app-eyebrow">Next</p>
            <h3 className="mt-1 text-lg font-bold leading-snug">{artistPath.next.title}</h3>
            <p className="mt-1.5 text-sm leading-6 text-white/60">{artistPath.next.copy}</p>
            <Link href={artistPath.next.href} className="bvs-app-pill bvs-app-pill--primary mt-3">{artistPath.next.cta}<LibIcon name="chevron" size={15} /></Link>
          </div>
          {(workspace?.releases || []).length ? <div className="mt-4"><CreatorReleaseWorkCounts counts={releaseCounts} /></div> : null}
        </section>
      ) : null}

      <section className="bvs-app-shelf" aria-labelledby="studio-inbox-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="studio-inbox-heading" className="bvs-app-shelf-title">Action inbox</h2>
          {workspace ? <span className="shrink-0 text-xs text-white/45">{(workspace.releases || []).length} releases · {(workspace.tracks || []).length} tracks</span> : null}
        </div>
        <p className="mt-1 text-sm text-white/50">{workspaceLoading ? "Checking your work…" : tasks.length ? `${tasks.length} item${tasks.length === 1 ? "" : "s"} need attention` : "Nothing needs you right now"}</p>
        {workspaceError ? <p role="alert" className="mt-3 text-sm text-red-300">{workspaceError} <button type="button" onClick={reload} className="min-h-11 px-3 underline">Try again</button></p> : null}
        <div className="mt-2">
          {tasks.map((task) => (
            <Link key={task.id} href={task.href} className="bvs-app-row group flex items-center gap-3 py-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center ${task.tone === "urgent" ? "bg-amber-300/[.12] text-amber-200" : "bg-white/[.06] text-white/60"}`}><LibIcon name={task.tone === "urgent" ? "sparkle" : "clock"} size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[10px] font-semibold uppercase tracking-[.15em] ${task.tone === "urgent" ? "text-amber-200" : "text-white/45"}`}>{task.eyebrow}</span>
                <span className="mt-0.5 block truncate text-[15px] font-semibold capitalize">{task.title}</span>
                <span className="mt-0.5 line-clamp-2 block text-[13px] leading-5 text-white/50">{task.note}</span>
              </span>
              <LibIcon name="chevron" size={18} className="shrink-0 text-white/35 transition group-hover:text-white/70" />
            </Link>
          ))}
        </div>
        {!workspaceLoading && !workspaceError && !tasks.length ? <div className="mt-3 flex items-center gap-3 border border-dashed border-white/15 p-4 text-sm text-white/55"><LibIcon name="check" size={20} className="shrink-0 text-[#a3dbff]" />You’re up to date. Review requests, delivery issues and assigned work will appear here.</div> : null}
      </section>

      <CreatorGrowthPanel key={user?.id} owner={user?.id || ''} token={token} surface={surface} />

      <div className="mt-8 flex flex-wrap gap-2 text-xs" aria-label="Your creator access">
        {([["Artist", access?.artist], ["Producer", access?.producer], ["Writer", access?.writer], ["Shows", access?.showCreator]] as const).map(([label, on]) => (
          <span key={label} className={`inline-flex min-h-8 items-center gap-1.5 border px-3 ${on ? "border-[#a3dbff]/35 text-[#a3dbff]" : "border-white/10 text-white/40"}`}>{on ? <LibIcon name="check" size={13} /> : null}{label}</span>
        ))}
        {!access?.artist || !access?.producer || !access?.writer || !access?.showCreator ? <Link href={`/app/${surface}/account#creator-role`} className="inline-flex min-h-8 items-center px-2 font-semibold text-white/60 underline-offset-4 hover:underline">Add access</Link> : null}
      </div>
    </div>
  );
}

const accentRgb: Record<StudioAccent, string> = {
  core: "163 219 255",
  beats: "193 167 255",
  insights: "126 224 195",
  marketplace: "193 255 82",
  money: "255 210 92",
  shows: "255 138 92",
};

const roleIcon: Record<string, LibIconName> = { Artist: "mic", Producer: "waveform", Writer: "pen", "Show creator": "radio" };

function StudioTile({ icon, accent }: { icon: LibIconName; accent: StudioAccent }) {
  const rgb = accentRgb[accent] || accentRgb.core;
  return <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center" style={{ background: `rgb(${rgb} / .14)`, color: `rgb(${rgb})` }}><LibIcon name={icon} size={20} /></span>;
}

function StudioHeader({ title, eyebrow, createHref }: { title: string; eyebrow: string; createHref?: string | null }) {
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="bvs-app-eyebrow truncate">{eyebrow}</p>
        <h1 className="mt-1 text-[2.4rem] font-bold leading-none tracking-tight sm:text-6xl">{title}</h1>
      </div>
      {createHref ? <Link href={createHref} aria-label="Create something new" className="grid h-11 w-11 shrink-0 place-items-center bg-[#c1ff52] text-black transition active:scale-95"><LibIcon name="plus" /></Link> : null}
    </header>
  );
}
