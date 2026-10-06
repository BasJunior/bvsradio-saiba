"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useBrowserSession } from "@/lib/use-browser-session";
import { useAccountJson } from "@/lib/use-account-json";
import { trackEvent } from "@/lib/analytics";
import CreatorGrowthPanel from '@/components/CreatorGrowthPanel';

type WorkspaceData = {
  profile: {
    role: string;
    display_name?: string;
    is_producer?: boolean;
  };
  tracks?: Array<{
    id: string;
    title?: string;
    editorial_status?: string;
    is_public?: boolean;
    in_rotation?: boolean;
    play_count?: number;
    like_count?: number;
  }>;
  releases?: Array<{
    id: string;
    title?: string;
    editorial_status?: string;
    is_public?: boolean;
    in_rotation?: boolean;
  }>;
  distributionJobs?: Array<{ id: string; status?: string }>;
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
  const { session, loading: sessionLoading } = useBrowserSession();
  const { data, error: requestError, reload } = useAccountJson<WorkspaceData>({ owner: session?.user.id || "", token: session?.access_token || "", url: "/api/creator/workspace", errorMessage: "Could not open Studio." });
  const error = !isSupabaseConfigured() ? "Account service is not configured." : requestError || (!sessionLoading && !session ? "Sign in with a creator account." : "");

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
    const pending = [...tracks, ...releases].filter((item) =>
      ["submitted", "in_review", "changes_requested"].includes(item.editorial_status || ""),
    ).length;
    const published = [...tracks, ...releases].filter((item) => item.is_public).length;
    const inRotation = [...tracks, ...releases].filter((item) => item.in_rotation).length;
    const plays = tracks.reduce((sum, track) => sum + Number(track.play_count || 0), 0);
    const likes = tracks.reduce((sum, track) => sum + Number(track.like_count || 0), 0);
    const distributing = jobs.filter((job) =>
      ["queued", "submitted", "processing", "delivering"].includes(job.status || ""),
    ).length;
    return { catalogue: tracks.length + releases.length, pending, published, inRotation, plays, likes, distributing };
  }, [data]);

  if (error && !data) {
    return (
      <main className="mx-auto min-h-[65vh] max-w-2xl px-5 py-20 text-center sm:px-6">
        <p data-studio-accent="core" className="bvs-studio-accent-label text-xs font-semibold uppercase tracking-[.22em]">BVS Studio</p>
        <h1 className="mt-3 text-3xl font-semibold">Studio needs your creator account</h1>
        <p role="alert" className="mt-4 text-text-secondary">{error}</p>{session ? <button type="button" onClick={reload} className="mt-4 min-h-11 border border-white/20 px-5">Try again</button> : null}
        <Link href="/auth/login?next=/creator/studio" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-6 py-3 font-semibold text-black">Sign in</Link>
      </main>
    );
  }

  if (!data) return <main className="min-h-[65vh] p-20 text-center text-text-secondary">Opening Studio…</main>;

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
      copy: "Send a single, EP or album to BVS for rights checks, review and distribution.",
      cta: "Start a release",
      accent: "core",
    },
    artist && {
      href: "/creator/studio/create/video",
      intent: "music_video",
      label: "Music video",
      copy: "Upload an MP4. After approval, listeners can tap Watch on your track — radio rotation still advances to the next song when the audio ends.",
      cta: "Upload a video",
      accent: "core",
    },
    producer && {
      href: "/creator/studio/create/beat",
      intent: "beat",
      label: "Sell a beat",
      copy: "Upload the beat, choose a price and send it to BVS. We handle the BeatStore listing behind the scenes.",
      cta: "Post a beat",
      accent: "beats",
    },
    {
      href: "/creator/studio/create/service",
      intent: "service",
      label: "Offer a service",
      copy: "List mixing, mastering, recording, a studio session or another music service without navigating the full marketplace desk.",
      cta: "Add a service",
      accent: "marketplace",
    },
  ].filter(Boolean) as Array<{ href: string; intent: string; label: string; copy: string; cta: string; accent: "core" | "beats" | "marketplace" }>;

  return (
    <main className="mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-6 sm:pt-12">
      <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">BVS Studio</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Make your next move, {displayName}.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
        Start with the job. BVS will bring in rights, marketplace, distribution and money tools only when they are needed.
      </p>

      {artist && uploadStatus.active.length > 0 && <SubmissionStatusPanel sessions={uploadStatus.active} />}
      {artist && <ArtistActivationPanel activity={activity} />}
      <CreatorGrowthPanel key={session?.user.id} owner={session?.user.id || ''} token={session?.access_token || ''} />

      <section className="mt-8 grid gap-3 md:grid-cols-3" aria-label="Create in BVS">
        {createActions.map((action, index) => (
          <Link key={action.href} href={action.href} data-studio-accent={action.accent} onClick={() => trackEvent("create_intent_selected", { intent: action.intent })} className="bvs-studio-accent-card group flex min-h-52 flex-col justify-between rounded-3xl border border-white/10 bg-white/[.025] p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <div>
              <span className="bvs-studio-accent-button inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs font-semibold">{index + 1}</span>
              <h2 className="mt-5 text-2xl font-semibold">{action.label}</h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{action.copy}</p>
            </div>
            <span className="bvs-studio-accent-arrow mt-6 inline-flex min-h-11 items-center text-sm font-semibold">{action.cta} →</span>
          </Link>
        ))}
      </section>

      <section className="mt-10 rounded-3xl border border-white/10 bg-black/20 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-text-secondary">Your work</p>
            <h2 className="mt-2 text-xl font-semibold">Manage when you need to</h2>
          </div>
          <Link href="/creator/studio/manage" data-studio-accent="core" className="bvs-studio-accent-button inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-semibold">Open full Studio →</Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <ManageLink href="/creator/studio/manage#releases" accent="core" label="Catalogue & status" detail={`${activity.catalogue} item${activity.catalogue === 1 ? "" : "s"}`} />
          {artist && <ManageLink href="/creator/studio/artwork" label="Cover artwork" detail="Upload a replacement" accent="core" />}
          <ManageLink href="/creator/studio/earnings" label="Money" detail="Wallet & earnings" accent="money" />
          <ManageLink href="/creator/studio/manage#service-orders" label="Orders" detail="Client work" accent="marketplace" />
          <ManageLink href="/creator/studio/services" label="Profile & storefront" detail="Advanced setup" accent="marketplace" />
        </div>
        {(activity.pending > 0 || activity.distributing > 0) && (
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-text-secondary">
            {activity.pending > 0 && <span className="rounded-full border border-white/10 px-3 py-1.5">{activity.pending} awaiting editorial action</span>}
            {activity.distributing > 0 && <span className="rounded-full border border-white/10 px-3 py-1.5">{activity.distributing} moving through distribution</span>}
          </div>
        )}
      </section>

      {(writer || showCreator) && (
        <section className="mt-6 flex flex-wrap gap-2 text-sm">
          {writer && <Link href="/creator/studio/manage#writer-work" data-studio-accent="insights" className="bvs-studio-accent-button inline-flex min-h-11 items-center rounded-full border px-4 py-2">Writing tools</Link>}
          {showCreator && <Link href="/creator/studio/manage#show-work" data-studio-accent="shows" className="bvs-studio-accent-button inline-flex min-h-11 items-center rounded-full border px-4 py-2">Show & broadcast tools</Link>}
        </section>
      )}
    </main>
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

function ArtistActivationPanel({ activity }: { activity: { catalogue: number; pending: number; published: number; inRotation: number; plays: number; likes: number } }) {
  const needsFirstSubmit = activity.catalogue === 0;
  const needsFix = activity.pending > 0;
  const hasProof = activity.published > 0 || activity.inRotation > 0;
  const primary = needsFirstSubmit
    ? { href: "/creator/studio/create/release", label: "Submit first track", detail: "Start the one-release path and give editorial something real to publish." }
    : needsFix
      ? { href: "/creator/studio/manage#releases", label: "Track review", detail: "Keep the release moving through editorial within the 48h control window." }
      : hasProof
        ? { href: "/artists", label: "View live proof", detail: "Check what listeners can see, play and share." }
        : { href: "/creator/studio/manage#releases", label: "Open catalogue", detail: "Review status and prepare the next release." };

  return (
    <section data-studio-accent="core" className="mt-8 rounded-3xl border border-[#7ba9d0]/20 bg-[#7ba9d0]/[.045] p-5 sm:p-6" aria-label="Artist activation">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="bvs-studio-accent-label text-xs font-semibold uppercase tracking-[.18em]">Artist path</p>
          <h2 className="mt-2 text-2xl font-semibold">Next proof step</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{primary.detail}</p>
        </div>
        <Link href={primary.href} className="bvs-studio-accent-button inline-flex min-h-11 items-center rounded-full border px-5 py-2.5 text-sm font-semibold">
          {primary.label}
        </Link>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <ProofMetric label="Catalogue" value={activity.catalogue} />
        <ProofMetric label="Awaiting review" value={activity.pending} />
        <ProofMetric label="Live on BVS" value={activity.published} />
        <ProofMetric label="In rotation" value={activity.inRotation} />
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

function ManageLink({ href, label, detail, accent }: { href: string; label: string; detail: string; accent: "core" | "marketplace" | "money" }) {
  return (
    <Link href={href} data-studio-accent={accent} className="bvs-studio-accent-card flex min-h-[4.5rem] flex-col justify-center rounded-2xl border border-white/10 p-4">
      <p className="font-semibold">{label}</p>
      <p className="mt-1 text-xs text-text-secondary">{detail}</p>
    </Link>
  );
}
