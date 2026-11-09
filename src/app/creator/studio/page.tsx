"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useBrowserSession } from "@/lib/use-browser-session";
import { useAccountJson } from "@/lib/use-account-json";
import { trackEvent } from "@/lib/analytics";
import BeatCrateChallenge from '@/components/BeatCrateChallenge';
import StudioRightsPrompt from '@/components/StudioRightsPrompt';
import { CRATE_CHALLENGE_ACTIVE } from '@/lib/beat-crate';
import CreatorGrowthPanel from '@/components/CreatorGrowthPanel';
import CreatorProfileArtwork from "@/components/CreatorProfileArtwork";
import { buildCreatorReleaseProgress, latestDistributionJob, type ReleaseWorkGroup } from "@/lib/creator-release-progress";

type StudioPreferences = {
  theme: "core" | "midnight" | "heat" | "lavender";
  density: "compact" | "comfortable";
  visibleCards: string[];
};

const defaultStudioPreferences: StudioPreferences = {
  theme: "core",
  density: "comfortable",
  visibleCards: ["work", "create", "business", "growth"],
};

const studioThemes: Record<StudioPreferences["theme"], { label: string; accent: string; glow: string }> = {
  core: { label: "BVS Core", accent: "#c1ff52", glow: "193,255,82" },
  midnight: { label: "Midnight Blue", accent: "#8ab4ff", glow: "138,180,255" },
  heat: { label: "Heat", accent: "#ff9b72", glow: "255,155,114" },
  lavender: { label: "Lavender Pulse", accent: "#d3a6ff", glow: "211,166,255" },
};

type WorkspaceData = {
  profile: {
    role: string;
    username?: string;
    display_name?: string;
    avatar_url?: string;
    is_producer?: boolean;
  };
  tracks?: Array<{
    id: string;
    title?: string;
    artwork_url?: string | null;
    editorial_status?: string;
    editorial_notes?: string | null;
    is_public?: boolean;
    in_rotation?: boolean;
    play_count?: number;
    like_count?: number;
    release_id?: string | null;
  }>;
  releases?: Array<{
    id: string;
    title?: string;
    artwork_url?: string | null;
    editorial_status?: string;
    is_public?: boolean;
    in_rotation?: boolean;
    editorial_notes?: string | null;
  }>;
  distributionJobs?: Array<{ id: string; release_id?: string | null; status?: string; updated_at?: string; created_at?: string }>;
  uploadSessions?: Array<{
    id: string;
    submissionType: "track" | "release";
    state: string;
    title: string;
    resultType?: string | null;
    resultId?: string | null;
    lastError?: string | null;
    expiresAt?: string | null;
    submittedAt?: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

const legacyStudioAnchors = new Set([
  "artist-access",
  "artist-upload",
  "release-path",
  "releases",
  "insights",
  "producer-access",
  "beat-pack-upload",
  "beat-single-upload",
  "beatstore",
  "business",
  "money-desk",
  "marketplace-desk",
  "service-orders",
  "premium-desk",
  "writer-work",
  "show-work",
  "broadcast",
  "studio-wallet",
]);

export default function CreatorStudioHome() {
  const router = useRouter();
  const [workFilter, setWorkFilter] = useState("all");
  const [workQuery, setWorkQuery] = useState("");
  const [studioPreferences, setStudioPreferences] = useState<StudioPreferences>(defaultStudioPreferences);
  const [personalizationOpen, setPersonalizationOpen] = useState(false);
  const [studioMenuOpen, setStudioMenuOpen] = useState(false);
  const { session, loading: sessionLoading } = useBrowserSession();
  const { data, error: requestError, loading: workspaceLoading, reload } = useAccountJson<WorkspaceData>({ owner: session?.user.id || "", token: session?.access_token || "", url: "/api/creator/workspace", errorMessage: "Could not open Studio." });
  const error = !isSupabaseConfigured() ? "Account service is not configured." : requestError || (!sessionLoading && !session ? "Sign in with a creator account." : "");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`bvs-studio-preferences:${session?.user.id || "guest"}`);
      if (saved) setStudioPreferences({ ...defaultStudioPreferences, ...JSON.parse(saved) });
    } catch { /* Local preferences are optional. */ }
  }, [session?.user.id]);

  const updateStudioPreferences = (next: Partial<StudioPreferences>) => {
    const updated = { ...studioPreferences, ...next };
    setStudioPreferences(updated);
    if (session?.user.id) window.localStorage.setItem(`bvs-studio-preferences:${session.user.id}`, JSON.stringify(updated));
  };

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash && legacyStudioAnchors.has(hash)) {
      router.replace(`/creator/studio/manage#${hash}`);
      return;
    }
  }, [router]);

  useEffect(() => {
    if (data) trackEvent("studio_open", { role: data.profile?.role || "unknown" });
  }, [data]);

  const uploadStatus = useMemo(() => {
    const sessions = data?.uploadSessions || [];
    const active = sessions
      .filter((session) => ["preparing", "uploading", "uploaded", "finalizing", "failed"].includes(session.state))
      .slice(0, 4);
    const ready = active.filter((session) => ["uploaded", "finalizing"].includes(session.state)).length;
    const incomplete = active.filter((session) => ["preparing", "uploading", "failed"].includes(session.state)).length;
    return { active, ready, incomplete };
  }, [data]);

  const activity = useMemo(() => {
    const tracks = data?.tracks || [];
    const releases = data?.releases || [];
    const jobs = data?.distributionJobs || [];
    const releaseArtwork = new Map<string, string>();
    tracks.forEach((track) => {
      if (track.release_id && track.artwork_url) releaseArtwork.set(track.release_id, track.artwork_url);
    });
    const counts: Record<ReleaseWorkGroup, number> = { action_required: 0, in_progress: 0, history: 0 };
    const releaseItems = [
      ...releases.map((release) => ({
        id: release.id,
        workspaceKey: release.id,
        title: release.title || "Untitled release",
        artwork: release.artwork_url || releaseArtwork.get(release.id) || "/images/albums/lord-album.jpg",
        kind: "Release",
        editorial_status: release.editorial_status,
        editorial_notes: release.editorial_notes,
        is_public: release.is_public,
        in_rotation: release.in_rotation,
        distributionStatus: latestDistributionJob(jobs.filter((job) => job.release_id === release.id))?.status,
      })),
      ...tracks.filter((track) => !track.release_id).map((track) => ({
        id: track.id,
        workspaceKey: `track-${track.id}`,
        title: track.title || "Untitled track",
        artwork: track.artwork_url || "/images/albums/album-16-bit.jpg",
        kind: "Track",
        editorial_status: track.editorial_status,
        editorial_notes: track.editorial_notes,
        is_public: track.is_public,
        in_rotation: track.in_rotation,
        distributionStatus: undefined,
      })),
    ];
    const progressRows = releaseItems.map((item) => {
      const progress = buildCreatorReleaseProgress({
        editorialStatus: item.editorial_status,
        editorialNotes: item.editorial_notes,
        isPublic: item.is_public,
        inRotation: item.in_rotation,
        distributionStatus: item.distributionStatus,
      });
      counts[progress.group] += 1;
      return { item, progress };
    });
    const actionItem = progressRows.find((row) => row.progress.group === "action_required");
    const progressItem = progressRows.find((row) => row.progress.group === "in_progress");
    const publishedTrack = tracks.find((track) => track.is_public);
    const published = [...tracks, ...releases].filter((item) => item.is_public).length;
    const inRotation = [...tracks, ...releases].filter((item) => item.in_rotation).length;
    const plays = tracks.reduce((sum, track) => sum + Number(track.play_count || 0), 0);
    const likes = tracks.reduce((sum, track) => sum + Number(track.like_count || 0), 0);
    const distributing = jobs.filter((job) =>
      ["queued", "submitted", "processing", "delivering"].includes(job.status || ""),
    ).length;
    return {
      catalogue: releaseItems.length,
      work: progressRows,
      ...counts,
      published,
      inRotation,
      plays,
      likes,
      distributing,
      actionHref: actionItem ? `/creator/studio/releases/${encodeURIComponent(actionItem.item.workspaceKey)}` : undefined,
      progressHref: progressItem ? `/creator/studio/releases/${encodeURIComponent(progressItem.item.workspaceKey)}` : undefined,
      proofHref: publishedTrack && data?.profile.username
        ? `/artist/${encodeURIComponent(data.profile.username)}#track-${publishedTrack.id}`
        : undefined,
    };
  }, [data]);

  if (error && !data) {
    return (
      <main className="mx-auto min-h-[65vh] max-w-2xl px-5 py-20 text-center sm:px-6">
        <p data-studio-accent="core" className="bvs-studio-accent-label text-xs font-semibold uppercase tracking-[.22em]">BVS Studio</p>
        <h1 className="mt-3 text-3xl font-semibold">{session ? "Studio couldn’t load your workspace" : "Your workspace starts with an account"}</h1>
        <p role="alert" className="mt-4 text-text-secondary">{error}</p>{session ? <button type="button" onClick={reload} className="mt-4 min-h-11 border border-white/20 px-5">Try again</button> : null}
        {!session ? <Link href="/auth/login?next=/creator/studio" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-6 py-3 font-semibold text-black">Sign in</Link> : <Link href="/contact?topic=studio" className="mt-6 inline-flex min-h-11 items-center px-5 text-brand">Get help with Studio</Link>}
      </main>
    );
  }

  if (!data) return <main className="mx-auto min-h-[65vh] max-w-6xl px-5 py-12" aria-busy="true"><p role="status" className="text-sm text-text-secondary">Opening your Studio workspace…</p><div aria-hidden="true" className="bvs-studio-loading"><div /><div /><div /></div></main>;

  const artist = ["artist", "admin"].includes(data.profile.role);
  const producer = Boolean(data.profile.is_producer) || data.profile.role === "admin";
  const writer = ["writer", "admin"].includes(data.profile.role);
  const showCreator = ["show_creator", "admin"].includes(data.profile.role);
  const displayName = data.profile.display_name || "creator";

  const createActions = [
    artist && {
      href: "/creator/studio/create/release",
      intent: "release",
      label: "Release music",
      copy: "Submit a single, EP or album. Keep review and delivery in one place.",
      cta: "Start a release",
      image: "/images/hero-studio.jpg",
      accent: "core",
    },
    artist && {
      href: "/creator/studio/create/video",
      intent: "music_video",
      label: "Music video",
      copy: "Add an official video to a track for listeners to watch on BVS.",
      cta: "Upload a video",
      image: "/images/editorial/music-discovery-show.webp",
      accent: "core",
    },
    producer && {
      href: "/creator/studio/create/beat",
      intent: "beat",
      label: "Sell a beat",
      copy: "Upload your audio, set licence prices and build your BeatStore catalogue.",
      cta: "Post a beat",
      image: "/images/beat-covers/preview-v2.png",
      accent: "beats",
    },
    {
      href: "/creator/studio/create/service",
      intent: "service",
      label: "Offer a service",
      copy: "Publish recording, production or engineering services in your storefront.",
      cta: "Add a service",
      image: "/images/editorial/audio-engineering-work.webp",
      accent: "marketplace",
    },
  ].filter(Boolean) as Array<{ href: string; intent: string; label: string; copy: string; cta: string; image: string; accent: "core" | "beats" | "marketplace" }>;

  return (
    <main data-studio-theme={studioPreferences.theme} data-studio-density={studioPreferences.density} className="bvs-studio-home mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-6 sm:pt-12" style={{ "--studio-accent": studioThemes[studioPreferences.theme].accent, "--studio-glow": studioThemes[studioPreferences.theme].glow, ...(data.profile.avatar_url ? { "--studio-profile-image": `url("${data.profile.avatar_url.replaceAll('"', '')}")` } : {}) } as CSSProperties}>
      <header className="bvs-studio-dashboard-header"><div className="bvs-studio-header-copy">
      <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">Your workspace</p>
      <h1 className="bvs-directory-title mt-2">Studio overview</h1>
      <p className="mt-3 text-lg font-semibold">Make your next move, {displayName}.</p>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
        Your music, client work and next steps, together.
      </p>
      </div><div className="bvs-studio-header-actions">
        <div className="bvs-studio-identity"><div className="bvs-studio-identity-cover"><div className="bvs-studio-avatar"><CreatorProfileArtwork src={data.profile.avatar_url} name={displayName} priority /></div><div><span className="bvs-studio-identity-name">{displayName}</span>{data.profile.username && (artist || producer) ? <Link href={`/artist/${encodeURIComponent(data.profile.username)}`}>View public profile ↗</Link> : <Link href="/account">Set up profile</Link>}</div><div className="bvs-studio-menu"><button type="button" className="bvs-studio-menu-trigger" onClick={() => setStudioMenuOpen((open) => !open)} aria-expanded={studioMenuOpen} aria-label="Studio options"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="9" cy="7" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="10" cy="17" r="1.5" /></svg></button>{studioMenuOpen && <div className="bvs-studio-menu-panel"><button type="button" onClick={() => { setPersonalizationOpen((open) => !open); setStudioMenuOpen(false); }} aria-expanded={personalizationOpen}>Personalize Studio</button><button type="button" onClick={() => { reload(); setStudioMenuOpen(false); }} disabled={workspaceLoading}>{workspaceLoading ? "Refreshing…" : "Refresh workspace"}</button></div>}</div></div></div>
      </div></header>

      {personalizationOpen && <StudioPersonalization preferences={studioPreferences} update={updateStudioPreferences} reset={() => updateStudioPreferences(defaultStudioPreferences)} close={() => setPersonalizationOpen(false)} />}

      {CRATE_CHALLENGE_ACTIVE && producer && <BeatCrateChallenge />}

      {artist && uploadStatus.active.length > 0 && <SubmissionStatusPanel sessions={uploadStatus.active} />}
      {artist && <ArtistActivationPanel activity={activity} />}


      {/* Release work is derived from editorial and distribution state, never guessed from dates. */}
      {studioPreferences.visibleCards.includes("work") && <section className="bvs-studio-work" aria-labelledby="studio-work-heading">
        <div className="bvs-studio-work-heading"><div><p className="bvs-studio-eyebrow">Keep things moving</p><h2 id="studio-work-heading">Projects & releases</h2></div><Link href="/creator/studio/manage#releases">Manage catalogue ↗</Link></div>
        <div className="bvs-studio-work-controls">
          <div role="group" aria-label="Filter release work">{[["all", "All work", activity.catalogue], ["action_required", "Needs you", activity.action_required], ["in_progress", "In progress", activity.in_progress], ["history", "History", activity.history]].map(([value, label, count]) => <button type="button" key={value} aria-pressed={workFilter === value} onClick={() => setWorkFilter(String(value))}>{label} <span>{count}</span></button>)}</div>
          <label><span className="sr-only">Search your releases</span><input type="search" value={workQuery} onChange={event => setWorkQuery(event.target.value)} placeholder="Find a release or track" /></label>
        </div>
        <div className="bvs-studio-work-list">
          {activity.work.filter(row => (workFilter === "all" || row.progress.group === workFilter) && row.item.title.toLowerCase().includes(workQuery.trim().toLowerCase())).sort((a, b) => (["action_required", "in_progress", "history"].indexOf(a.progress.group) - ["action_required", "in_progress", "history"].indexOf(b.progress.group))).slice(0, 8).map(({item, progress}) => <Link className="bvs-studio-work-row" key={item.workspaceKey} href={`/creator/studio/releases/${encodeURIComponent(item.workspaceKey)}`}>
            <div className="bvs-studio-work-art"><CreatorProfileArtwork src={item.artwork} name={item.title} /></div>
            <div><span className="bvs-studio-work-kind">{item.kind}</span><h3>{item.title}</h3><p>{progress.nextStep}</p></div>
            <div className="bvs-studio-work-state"><span data-work-state={progress.group}>{progress.statusLabel}</span><small>Next: {progress.nextOwner}</small></div><span aria-hidden="true">↗</span>
          </Link>)}
          {!activity.work.some(row => (workFilter === "all" || row.progress.group === workFilter) && row.item.title.toLowerCase().includes(workQuery.trim().toLowerCase())) ? <div className="bvs-studio-work-empty"><h3>{activity.catalogue ? "Nothing in this view" : "Your next release starts here"}</h3><p>{activity.catalogue ? "Try a different status or search." : "Create a release to track its review, requested changes and publication here."}</p>{activity.catalogue ? <button type="button" onClick={() => { setWorkFilter("all"); setWorkQuery(""); }}>Show all work</button> : artist ? <Link href="/creator/studio/create/release">Start a release ↗</Link> : <Link href="/creator/studio/manage">Open your workspace ↗</Link>}</div> : null}
        </div>
        {activity.catalogue > 8 ? <Link className="bvs-studio-all-work" href="/creator/studio/manage#releases">View the full catalogue ({activity.catalogue}) ↗</Link> : null}
      </section>}

      {/* Creation links use the existing production upload and marketplace flows. */}
      {studioPreferences.visibleCards.includes("create") && <section className="bvs-studio-create-grid mt-8 grid gap-3 md:grid-cols-3" aria-label="Create in BVS">
        {createActions.map((action, index) => (
          <Link key={action.href} href={action.href} data-studio-accent={action.accent} onClick={() => trackEvent("create_intent_selected", { intent: action.intent })} className="bvs-studio-accent-card group flex min-h-52 flex-col justify-between rounded-3xl border border-white/10 bg-white/[.025] p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <div className="bvs-studio-create-card-content">
              <div className="bvs-studio-create-card-art" aria-hidden="true"><Image src={action.image} alt="" fill sizes="(max-width: 639px) 50vw, 240px" /></div>
              <span className="bvs-studio-accent-button inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs font-semibold">{index + 1}</span>
              <h2 className="mt-5 text-2xl font-semibold">{action.label}</h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{action.copy}</p>
            </div>
            <span className="bvs-studio-accent-arrow mt-6 inline-flex min-h-11 items-center text-sm font-semibold">{action.cta} →</span>
          </Link>
        ))}
      </section>}

      {(artist || producer) && <StudioRightsPrompt token={session?.access_token || ""} />}
      {studioPreferences.visibleCards.includes("business") && <section className="bvs-studio-business mt-10 rounded-3xl border border-white/10 bg-black/20 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-text-secondary">Your work</p>
            <h2 className="mt-2 text-xl font-semibold">Your business, connected</h2>
          </div>
          <Link href="/creator/studio/manage" data-studio-accent="core" className="bvs-studio-accent-button inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-semibold">All tools →</Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <ManageLink href="/creator/studio/manage#releases" accent="core" label="Catalogue & status" detail={`${activity.catalogue} item${activity.catalogue === 1 ? "" : "s"}`} />
          {producer && <ManageLink href="/creator/studio/manage#beatstore" accent="beats" label="Your BeatStore" detail="Beats, pricing & review" />}
          {(artist || producer) && <ManageLink href="/creator/studio/rights" label="Music rights" detail="Confirm society status" accent={producer && !artist ? "beats" : "core"} />}
          {(artist || producer) && <ManageLink href="/creator/studio/artwork" label="Cover artwork" detail="Upload a replacement" accent={producer && !artist ? "beats" : "core"} />}
          <ManageLink href="/creator/studio/earnings" label="Money" detail="Wallet & earnings" accent="money" />
          <ManageLink href="/creator/studio/manage#service-orders" label="Orders" detail="Client work" accent="marketplace" />
          <ManageLink href="/creator/studio/services" label="Profile & storefront" detail="Your public presence" accent="marketplace" />
        </div>
        {(activity.action_required > 0 || activity.in_progress > 0) && (
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-text-secondary">
            {activity.action_required > 0 && <span className="rounded-full border border-amber-300/25 bg-amber-300/[.05] px-3 py-1.5 text-amber-100">{activity.action_required} need your action</span>}
            {activity.in_progress > 0 && <span className="rounded-full border border-sky-300/20 bg-sky-300/[.04] px-3 py-1.5 text-sky-100">{activity.in_progress} in progress — no action now</span>}
          </div>
        )}
      </section>}

      <section className="bvs-studio-support mt-6" aria-labelledby="studio-support-heading">
        <div><p className="bvs-studio-eyebrow">Studio support</p><h2 id="studio-support-heading">Need help from BVS?</h2><p>Ask about an existing submission, review note, account issue, or Studio workflow. Music submissions still go through Upload.</p></div>
        <div className="bvs-studio-support-actions"><Link href="/contact?topic=editorial">Editorial request ↗</Link><Link href="/contact?topic=studio">Start support conversation ↗</Link></div>
      </section>

      {studioPreferences.visibleCards.includes("growth") && <details className="bvs-studio-growth-drawer"><summary><span><strong>Grow with BVS</strong><small>Goals, promotion, rewards &amp; badges</small></span><span aria-hidden="true">＋</span></summary><CreatorGrowthPanel key={session?.user.id} owner={session?.user.id || ''} token={session?.access_token || ''} /></details>}

      {(writer || showCreator) && (
        <section className="mt-6 flex flex-wrap gap-2 text-sm">
          {writer && <Link href="/creator/studio/manage#writer-work" data-studio-accent="insights" className="bvs-studio-accent-button inline-flex min-h-11 items-center rounded-full border px-4 py-2">Writing tools</Link>}
          {showCreator && <Link href="/creator/studio/manage#show-work" data-studio-accent="shows" className="bvs-studio-accent-button inline-flex min-h-11 items-center rounded-full border px-4 py-2">Show & broadcast tools</Link>}
        </section>
      )}
    </main>
  );
}

function StudioPersonalization({ preferences, update, reset, close }: { preferences: StudioPreferences; update: (next: Partial<StudioPreferences>) => void; reset: () => void; close: () => void }) {
  const cards = [
    ["work", "Projects & releases"],
    ["create", "Create shortcuts"],
    ["business", "Business tools"],
    ["growth", "Growth panel"],
  ];
  return (
    <section className="bvs-studio-personalization" aria-label="Personalize Studio">
      <div className="bvs-studio-personalization-heading"><div><p className="bvs-studio-eyebrow">Workspace settings</p><h2>Personalize your Studio</h2><p>Make the workspace feel like yours. These settings are private to your Studio.</p></div><button type="button" onClick={close} aria-label="Close personalization">×</button></div>
      <div className="bvs-studio-personalization-grid">
        <fieldset><legend>Theme</legend><div className="bvs-studio-theme-options">{Object.entries(studioThemes).map(([value, theme]) => <button type="button" key={value} aria-pressed={preferences.theme === value} data-theme-option={value} onClick={() => update({ theme: value as StudioPreferences["theme"] })}><span style={{ background: theme.accent }} />{theme.label}</button>)}</div></fieldset>
        <label><span>Layout density</span><select value={preferences.density} onChange={(event) => update({ density: event.target.value as StudioPreferences["density"] })}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
        <fieldset className="bvs-studio-card-preferences"><legend>Show on overview</legend>{cards.map(([value, label]) => <label key={value}><input type="checkbox" checked={preferences.visibleCards.includes(value)} onChange={(event) => update({ visibleCards: event.target.checked ? [...preferences.visibleCards, value] : preferences.visibleCards.filter((card) => card !== value) })} />{label}</label>)}</fieldset>
      </div>
      <div className="bvs-studio-personalization-actions"><button type="button" onClick={reset}>Reset BVS default</button><span>Saved automatically</span></div>
    </section>
  );
}

function SubmissionStatusPanel({
  sessions,
}: {
  sessions: NonNullable<WorkspaceData["uploadSessions"]>;
}) {
  const presentation = (state: string) => {
    if (state === "uploaded") return {
      label: "Files verified",
      detail: "BVS has every required file. Finish registration without uploading again.",
      tone: "text-emerald-200",
    };
    if (state === "finalizing") return {
      label: "Finishing submission",
      detail: "The files are safe. You can retry registration without creating a duplicate.",
      tone: "text-amber-200",
    };
    if (state === "failed") return {
      label: "Needs attention",
      detail: "BVS kept the draft. Open the submission to see what needs another try.",
      tone: "text-amber-200",
    };
    if (state === "preparing") return {
      label: "Preparing upload",
      detail: "BVS created the submission record before media transfer began.",
      tone: "text-sky-200",
    };
    return {
      label: "Upload incomplete",
      detail: "BVS kept the submission record even though every file is not verified yet.",
      tone: "text-sky-200",
    };
  };

  return (
    <section
      data-studio-accent="core"
      className="mt-8 rounded-3xl border border-amber-300/20 bg-amber-300/[.035] p-5 sm:p-6"
      aria-label="Submission status"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-200">Needs your attention</p>
          <h2 className="mt-2 text-2xl font-semibold">Unfinished submissions</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
            Your upload progress is saved. Pick up after a reload or lost connection.
          </p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-text-secondary">
          {sessions.length} active
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {sessions.map((session) => {
          const status = presentation(session.state);
          const href = session.submissionType === "release"
            ? "/creator/studio/create/release"
            : "/upload";
          return (
            <div key={session.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold">{session.title}</p>
                  <span className={`text-xs font-semibold ${status.tone}`}>{status.label}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-text-secondary">
                  {status.detail}
                  {session.lastError ? ` ${session.lastError}` : ""}
                </p>
              </div>
              <Link
                href={href}
                onClick={() => trackEvent("create_intent_selected", {
                  intent: "resume_submission",
                  submission_type: session.submissionType,
                  state: session.state,
                })}
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-amber-200/30 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-200/10"
              >
                {["uploaded", "finalizing"].includes(session.state) ? "Finish submission" : "Open submission"} →
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ArtistActivationPanel({ activity }: { activity: { catalogue: number; action_required: number; in_progress: number; history: number; published: number; inRotation: number; plays: number; likes: number; actionHref?: string; progressHref?: string; proofHref?: string } }) {
  const needsFirstSubmit = activity.catalogue === 0;
  const needsFix = activity.action_required > 0 && Boolean(activity.actionHref);
  const isMoving = activity.in_progress > 0 && Boolean(activity.progressHref);
  const hasProof = Boolean(activity.proofHref);
  const primary = needsFirstSubmit
    ? { href: "/creator/studio/create/release", label: "Submit first track", detail: "Submit your first release and follow its review from this workspace." }
    : needsFix
      ? { href: activity.actionHref!, label: "Review editorial note", detail: "Open the exact release that needs your attention, then send the correction against that existing submission." }
      : isMoving
        ? { href: activity.progressHref!, label: "View progress", detail: "Open the exact release moving with BVS or the stores. Nothing is required from you right now." }
      : hasProof
        ? { href: activity.proofHref!, label: "View published music", detail: "Your music is live. Open your public page to listen and share." }
        : { href: "/creator/studio/manage#releases", label: "Open catalogue", detail: "Review status and prepare the next release." };

  return (
    <section data-studio-accent="core" className="mt-8 rounded-3xl border border-[#7ba9d0]/20 bg-[#7ba9d0]/[.045] p-5 sm:p-6" aria-label="Artist activation">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="bvs-studio-accent-label text-xs font-semibold uppercase tracking-[.18em]">Release overview</p>
          <h2 className="mt-2 text-2xl font-semibold">Your next step</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{primary.detail}</p>
        </div>
        <Link href={primary.href} className="bvs-studio-accent-button inline-flex min-h-11 items-center rounded-full border px-5 py-2.5 text-sm font-semibold">
          {primary.label}
        </Link>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <ProofMetric label="Catalogue" value={activity.catalogue} />
        <ProofMetric label="Action required" value={activity.action_required} />
        <ProofMetric label="In progress" value={activity.in_progress} />
        <ProofMetric label="History" value={activity.history} />
        <ProofMetric label="Total plays" value={activity.plays} />
        <ProofMetric label="Saves/likes" value={activity.likes} />
      </div>
    </section>
  );
}

function ProofMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-[11px] uppercase tracking-[.14em] text-text-secondary">{label}</p>
      <p data-studio-accent="core" className="bvs-studio-accent-label mt-2 text-2xl font-semibold">{value.toLocaleString()}</p>
    </div>
  );
}

function ManageLink({ href, label, detail, accent }: { href: string; label: string; detail: string; accent: "core" | "beats" | "marketplace" | "money" }) {
  return (
    <Link href={href} data-studio-accent={accent} className="bvs-studio-accent-card flex min-h-[4.5rem] flex-col justify-center rounded-2xl border border-white/10 p-4">
      <p className="font-semibold">{label}</p>
      <p className="mt-1 text-xs text-text-secondary">{detail}</p>
    </Link>
  );
}
