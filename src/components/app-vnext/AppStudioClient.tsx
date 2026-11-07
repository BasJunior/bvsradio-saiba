"use client";

import Link from "next/link";
import Image from "next/image";
import CreatorGrowthPanel from '@/components/CreatorGrowthPanel';
import CreatorProfileArtwork from "@/components/CreatorProfileArtwork";
import { useMemo, useState, type CSSProperties } from "react";
import { useAccountJson } from "@/lib/use-account-json";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import { LibIcon, type LibIconName } from "@/components/app-vnext/LibraryVisuals";
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

type WorkspaceTrack = { id: string; title: string; editorial_status?: string; editorial_notes?: string; in_rotation?: boolean; is_public?: boolean; release_id?: string | null; artwork_url?: string | null; play_count?: number; like_count?: number };
type WorkspaceRelease = { id: string; title: string; editorial_status?: string; editorial_notes?: string; is_public?: boolean; in_rotation?: boolean; artwork_url?: string | null };
type DistributionJob = { id: string; release_id?: string | null; status?: string; updated_at?: string; created_at?: string };
type WorkflowItem = { id: string; title?: string; topic?: string; status?: string; editor_notes?: string; review_notes?: string; request_type?: string; staff_notes?: string; message?: string };
type Workspace = {
  profile?: { role?: string; username?: string; display_name?: string; avatar_url?: string };
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
  const [workFilter, setWorkFilter] = useState<"all" | ReleaseWorkGroup>("all");
  const [workQuery, setWorkQuery] = useState("");
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

  // Same release rows as the web Studio overview: derived from editorial and
  // distribution state, with artwork falling back to the release's tracks.
  const workRows = useMemo(() => {
    const tracks = workspace?.tracks || [];
    const releases = workspace?.releases || [];
    const jobs = workspace?.distributionJobs || [];
    const releaseArtwork = new Map<string, string>();
    tracks.forEach((track) => { if (track.release_id && track.artwork_url) releaseArtwork.set(track.release_id, track.artwork_url); });
    const items = [
      ...releases.map((release) => ({ key: release.id, title: release.title || "Untitled release", artwork: release.artwork_url || releaseArtwork.get(release.id) || "/images/albums/lord-album.jpg", kind: "Release", href: `/app/${surface}/studio/release`, status: release.editorial_status, notes: release.editorial_notes, isPublic: release.is_public, inRotation: release.in_rotation, distribution: latestDistributionJob(jobs.filter((job) => job.release_id === release.id))?.status })),
      ...tracks.filter((track) => !track.release_id).map((track) => ({ key: `track-${track.id}`, title: track.title || "Untitled track", artwork: track.artwork_url || "/images/albums/album-16-bit.jpg", kind: "Track", href: `/app/${surface}/studio/songs/${encodeURIComponent(track.id)}`, status: track.editorial_status, notes: track.editorial_notes, isPublic: track.is_public, inRotation: track.in_rotation, distribution: undefined })),
    ];
    return items.map((item) => ({ item, progress: buildCreatorReleaseProgress({ editorialStatus: item.status, editorialNotes: item.notes, isPublic: item.isPublic, inRotation: item.inRotation, distributionStatus: item.distribution }) }));
  }, [surface, workspace]);
  const totals = useMemo(() => ({ plays: (workspace?.tracks || []).reduce((sum, track) => sum + Number(track.play_count || 0), 0) }), [workspace]);

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

  const displayName = workspace?.profile?.display_name || user?.email?.split("@")[0] || "creator";
  const avatar = workspace?.profile?.avatar_url || undefined;
  const createActions = [
    access?.artist && { href: `/app/${surface}/studio/release`, label: "Release music", copy: "Submit a single, EP or album. Keep review and delivery in one place.", cta: "Start a release", image: "/images/hero-studio.jpg", accent: "core" as const },
    access?.producer && { href: `/app/${surface}/studio/beats`, label: "Sell a beat", copy: "Upload your audio, set licence prices and build your BeatStore catalogue.", cta: "Post a beat", image: "/images/beat-covers/preview-v2.png", accent: "beats" as const },
    { href: `/app/${surface}/studio/marketplace`, label: "Offer a service", copy: "Publish recording, production or engineering services in your storefront.", cta: "Add a service", image: "/images/editorial/audio-engineering-work.webp", accent: "marketplace" as const },
  ].filter(Boolean) as Array<{ href: string; label: string; copy: string; cta: string; image: string; accent: "core" | "beats" | "marketplace" }>;
  const manageLinks: Array<{ href: string; label: string; detail: string; accent: StudioAccent }> = [
    ...(access?.artist ? [{ href: `/app/${surface}/studio/release`, label: "Catalogue & status", detail: `${workRows.length} item${workRows.length === 1 ? "" : "s"}`, accent: "core" as const }] : []),
    ...(access?.producer ? [{ href: `/app/${surface}/studio/beats`, label: "Your BeatStore", detail: "Beats, pricing & review", accent: "beats" as const }] : []),
    { href: `/app/${surface}/studio/insights`, label: "Insights", detail: "Listening signals", accent: "insights" },
    { href: `/app/${surface}/studio/money`, label: "Money", detail: "Wallet & earnings", accent: "money" },
    { href: `/app/${surface}/studio/orders`, label: "Orders", detail: "Client work", accent: "marketplace" },
    { href: `/app/${surface}/studio/marketplace`, label: "Profile & storefront", detail: "Your public presence", accent: "marketplace" },
  ];
  const visibleWork = workRows
    .filter((row) => (workFilter === "all" || row.progress.group === workFilter) && row.item.title.toLowerCase().includes(workQuery.trim().toLowerCase()))
    .sort((a, b) => ["action_required", "in_progress", "history"].indexOf(a.progress.group) - ["action_required", "in_progress", "history"].indexOf(b.progress.group))
    .slice(0, 8);

  return (
    <main
      className="bvs-studio-home bvs-app-studio-web mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6"
      style={{ "--studio-accent": "#c1ff52", "--studio-glow": "193,255,82", ...(avatar ? { "--studio-profile-image": `url("${avatar.replaceAll('"', "")}")` } : {}) } as CSSProperties}
    >
      <header className="bvs-studio-dashboard-header">
        <div className="bvs-studio-header-copy">
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">Your workspace{premiumActive ? ` · Premium ${premiumPlanLabel || "Active"}` : ""}</p>
          <h1 className="bvs-directory-title mt-2">Studio overview</h1>
          <p className="mt-3 text-lg font-semibold">Make your next move, {displayName}.</p>
        </div>
        <div className="bvs-studio-header-actions">
          <div className="bvs-studio-identity">
            <div className="bvs-studio-identity-cover">
              <div className="bvs-studio-avatar"><CreatorProfileArtwork src={avatar} name={displayName} priority /></div>
              <div>
                <span className="bvs-studio-identity-name">{displayName}</span>
                <Link href={`/app/${surface}/account`}>Edit profile ↗</Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      {artistPath ? (
        <section data-studio-accent="core" className="mt-6 border border-[#7ba9d0]/20 bg-[#7ba9d0]/[.045] p-5" aria-label="Artist activation">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="bvs-studio-accent-label text-xs font-semibold uppercase tracking-[.18em]">Release overview · {artistPath.focusTitle}</p>
              <h2 className="mt-2 text-2xl font-semibold">{artistPath.next.title}</h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{artistPath.next.copy}</p>
            </div>
            <Link href={artistPath.next.href} className="bvs-studio-accent-button inline-flex min-h-11 items-center border px-5 py-2.5 text-sm font-semibold">{artistPath.next.cta}</Link>
          </div>
          <ol className="bvs-app-studio-steps mt-4" aria-label="Release steps">
            {artistPath.steps.map((step) => (
              <li key={step.label} data-step-state={step.state}>
                <Link href={step.href}><span>{step.label}</span><small>{step.note}</small></Link>
              </li>
            ))}
          </ol>
          <div className="mt-4 grid grid-cols-3 gap-0 border-t border-white/10 pt-4">
            <ProofMetric label="Catalogue" value={workRows.length} />
            <ProofMetric label="Needs you" value={releaseCounts.action_required} />
            <ProofMetric label="Total plays" value={totals.plays} />
          </div>
        </section>
      ) : null}

      {tasks.length || workspaceError ? (
        <section className="bvs-studio-work" aria-labelledby="studio-inbox-heading">
          <div className="bvs-studio-work-heading"><div><p className="bvs-studio-eyebrow">Action inbox</p><h2 id="studio-inbox-heading">{tasks.length} item{tasks.length === 1 ? "" : "s"} need attention</h2></div></div>
          {workspaceError ? <p role="alert" className="px-5 pb-4 text-sm text-red-300">{workspaceError} <button type="button" onClick={reload} className="min-h-11 px-3 underline">Try again</button></p> : null}
          <div className="bvs-studio-work-list">
            {tasks.map((task) => (
              <Link key={task.id} href={task.href} className="bvs-studio-work-row bvs-app-task-row">
                <div className="bvs-studio-work-art grid place-items-center text-amber-200"><LibIcon name="sparkle" size={20} /></div>
                <div><span className="bvs-studio-work-kind">{task.eyebrow}</span><h3 className="capitalize">{task.title}</h3><p>{task.note}</p></div>
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="bvs-studio-work" aria-labelledby="studio-work-heading">
        <div className="bvs-studio-work-heading"><div><p className="bvs-studio-eyebrow">Keep things moving</p><h2 id="studio-work-heading">Projects & releases</h2></div><Link href={`/app/${surface}/studio/release`}>Manage releases ↗</Link></div>
        <div className="bvs-studio-work-controls">
          <div role="group" aria-label="Filter release work">
            {([["all", "All work", workRows.length], ["action_required", "Needs you", releaseCounts.action_required], ["in_progress", "In progress", releaseCounts.in_progress], ["history", "History", releaseCounts.history]] as const).map(([value, label, count]) => (
              <button type="button" key={value} aria-pressed={workFilter === value} onClick={() => setWorkFilter(value)}>{label} <span>{count}</span></button>
            ))}
          </div>
          <label><span className="sr-only">Search your releases</span><input type="search" value={workQuery} onChange={(event) => setWorkQuery(event.target.value)} placeholder="Find a release or track" /></label>
        </div>
        <div className="bvs-studio-work-list">
          {workspaceLoading && !workspace ? <div className="bvs-studio-work-empty"><p>Checking your work…</p></div> : null}
          {visibleWork.map(({ item, progress }) => (
            <Link className="bvs-studio-work-row" key={item.key} href={item.href}>
              <div className="bvs-studio-work-art"><CreatorProfileArtwork src={item.artwork} name={item.title} /></div>
              <div><span className="bvs-studio-work-kind">{item.kind}</span><h3>{item.title}</h3><p>{progress.nextStep}</p></div>
              <div className="bvs-studio-work-state"><span data-work-state={progress.group}>{progress.statusLabel}</span><small>Next: {progress.nextOwner}</small></div>
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
          {workspace && !visibleWork.length ? (
            <div className="bvs-studio-work-empty">
              <h3>{workRows.length ? "Nothing in this view" : "Your next release starts here"}</h3>
              <p>{workRows.length ? "Try a different status or search." : "Create a release to track its review, requested changes and publication here."}</p>
              {workRows.length ? <button type="button" onClick={() => { setWorkFilter("all"); setWorkQuery(""); }}>Show all work</button> : access?.artist ? <Link href={`/app/${surface}/studio/release`}>Start a release ↗</Link> : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="bvs-studio-create-grid mt-8 grid gap-3 md:grid-cols-3" aria-label="Create in BVS">
        {createActions.map((action, index) => (
          <Link key={action.href} href={action.href} data-studio-accent={action.accent} className="bvs-studio-accent-card group flex min-h-52 flex-col justify-between border border-white/10 bg-white/[.025] p-6">
            <div className="bvs-studio-create-card-content">
              <div className="bvs-studio-create-card-art" aria-hidden="true"><Image src={action.image} alt="" fill sizes="(max-width: 639px) 50vw, 240px" /></div>
              <span className="bvs-studio-accent-button inline-flex h-8 min-w-8 items-center justify-center border px-2 text-xs font-semibold">{index + 1}</span>
              <h2 className="mt-5 text-2xl font-semibold">{action.label}</h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{action.copy}</p>
            </div>
            <span className="bvs-studio-accent-arrow mt-6 inline-flex min-h-11 items-center text-sm font-semibold">{action.cta} →</span>
          </Link>
        ))}
      </section>

      <section className="bvs-studio-business mt-10 border border-white/10 bg-black/20 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-text-secondary">Your work</p><h2 className="mt-2 text-xl font-semibold">Your business, connected</h2></div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {manageLinks.map((link) => <ManageLink key={link.href} {...link} />)}
        </div>
        {(releaseCounts.action_required > 0 || releaseCounts.in_progress > 0) ? (
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-text-secondary">
            {releaseCounts.action_required > 0 ? <span className="border border-amber-300/25 bg-amber-300/[.05] px-3 py-1.5 text-amber-100">{releaseCounts.action_required} need your action</span> : null}
            {releaseCounts.in_progress > 0 ? <span className="border border-sky-300/20 bg-sky-300/[.04] px-3 py-1.5 text-sky-100">{releaseCounts.in_progress} in progress — no action now</span> : null}
          </div>
        ) : null}
      </section>

      <section className="bvs-studio-support mt-6" aria-labelledby="studio-support-heading">
        <div><p className="bvs-studio-eyebrow">Studio support</p><h2 id="studio-support-heading">Need help from BVS?</h2><p>Ask about an existing submission, review note, account issue, or Studio workflow.</p></div>
        <div className="bvs-studio-support-actions"><Link href={`/app/${surface}/support?topic=music`}>Editorial request ↗</Link><Link href={`/app/${surface}/support`}>Start support conversation ↗</Link></div>
      </section>

      <details className="bvs-studio-growth-drawer"><summary><span><strong>Grow with BVS</strong><small>Goals, promotion, rewards &amp; badges</small></span><span aria-hidden="true">＋</span></summary><CreatorGrowthPanel key={user?.id} owner={user?.id || ""} token={token} surface={surface} /></details>

      <div className="mt-6 flex flex-wrap gap-2 text-xs" aria-label="Your creator access">
        {([["Artist", access?.artist], ["Producer", access?.producer], ["Writer", access?.writer], ["Shows", access?.showCreator]] as const).map(([label, on]) => (
          <span key={label} className={`inline-flex min-h-8 items-center gap-1.5 border px-3 ${on ? "border-[#a7cbea]/35 text-[#a7cbea]" : "border-white/10 text-white/40"}`}>{on ? <LibIcon name="check" size={13} /> : null}{label}</span>
        ))}
        {!access?.artist || !access?.producer || !access?.writer || !access?.showCreator ? <Link href={`/app/${surface}/account#creator-role`} className="inline-flex min-h-8 items-center px-2 font-semibold text-white/60 underline-offset-4 hover:underline">Add access</Link> : null}
      </div>
    </main>
  );
}

function ProofMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-r border-white/10 px-3 last:border-r-0 first:pl-0">
      <p className="text-[10px] uppercase tracking-[.1em] text-text-secondary">{label}</p>
      <p data-studio-accent="core" className="bvs-studio-accent-label mt-1 text-xl font-semibold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

function ManageLink({ href, label, detail, accent }: { href: string; label: string; detail: string; accent: StudioAccent }) {
  return (
    <Link href={href} data-studio-accent={accent} className="bvs-studio-accent-card flex min-h-[4.5rem] flex-col justify-center border border-white/10 p-4">
      <p className="font-semibold">{label}</p>
      <p className="mt-1 text-xs text-text-secondary">{detail}</p>
    </Link>
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
