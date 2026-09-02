"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";
import { trackEvent } from "@/lib/analytics";

type Track = {
  id: string;
  title: string;
  editorial_status?: string;
  editorial_notes?: string;
  is_public?: boolean;
  in_rotation?: boolean;
  play_count?: number;
  like_count?: number;
  created_at?: string;
  release_id?: string;
};

type Release = {
  id: string;
  title: string;
  editorial_status?: string;
  editorial_notes?: string;
  is_public?: boolean;
  in_rotation?: boolean;
  created_at?: string;
};

type Workspace = {
  profile?: { role?: string; display_name?: string };
  tracks?: Track[];
  releases?: Release[];
};

type ActivationState =
  | "first_upload"
  | "draft"
  | "review"
  | "needs_changes"
  | "approved"
  | "live"
  | "active";

type FocusItem = {
  id: string;
  kind: "track" | "release";
  title: string;
  status: string;
  notes: string;
  isPublic: boolean;
  inRotation: boolean;
  createdAt: string;
  track?: Track;
  release?: Release;
};

function latestFocus(data: Workspace): FocusItem | null {
  const items: FocusItem[] = [
    ...(data.tracks || []).map((track) => ({
      id: track.id,
      kind: "track" as const,
      title: track.title,
      status: String(track.editorial_status || "").toLowerCase(),
      notes: String(track.editorial_notes || ""),
      isPublic: Boolean(track.is_public),
      inRotation: Boolean(track.in_rotation),
      createdAt: track.created_at || "",
      track,
    })),
    ...(data.releases || []).map((release) => ({
      id: release.id,
      kind: "release" as const,
      title: release.title,
      status: String(release.editorial_status || "").toLowerCase(),
      notes: String(release.editorial_notes || ""),
      isPublic: Boolean(release.is_public),
      inRotation: Boolean(release.in_rotation),
      createdAt: release.created_at || "",
      release,
    })),
  ];

  if (!items.length) return null;
  return items.sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  })[0];
}

function activationState(focus: FocusItem | null): ActivationState {
  if (!focus) return "first_upload";
  if (focus.isPublic) return "live";
  if (["rejected", "changes_requested", "needs_changes"].includes(focus.status)) {
    return "needs_changes";
  }
  if (["submitted", "in_review", "pending", "under_review"].includes(focus.status)) {
    return "review";
  }
  if (focus.status === "approved") return "approved";
  if (["draft", "incomplete"].includes(focus.status)) return "draft";
  return "active";
}

function proofFor(data: Workspace, focus: FocusItem | null) {
  if (!focus) return { plays: 0, saves: 0 };
  const tracks = data.tracks || [];
  const related =
    focus.kind === "release"
      ? tracks.filter((track) => track.release_id === focus.id)
      : tracks.filter((track) => track.id === focus.id);
  const source = related.length ? related : tracks.filter((track) => track.is_public);
  return source.reduce(
    (total, track) => ({
      plays: total.plays + Number(track.play_count || 0),
      saves: total.saves + Number(track.like_count || 0),
    }),
    { plays: 0, saves: 0 },
  );
}

export default function ArtistActivationNudge() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loaded, setLoaded] = useState(false);
  const trackedState = useRef<string>("");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    void createClient()
      .auth.getSession()
      .then(async ({ data }) => {
        const token = data.session?.access_token;
        if (!token) return;
        const response = await fetch("/api/creator/workspace", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as Workspace;
        if (!cancelled) setWorkspace(payload);
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const focus = useMemo(() => latestFocus(workspace || {}), [workspace]);
  const state = activationState(focus);
  const proof = useMemo(() => proofFor(workspace || {}, focus), [workspace, focus]);
  const isArtist = workspace?.profile?.role === "artist";

  useEffect(() => {
    if (!loaded || !isArtist || trackedState.current === state) return;
    trackedState.current = state;
    trackEvent("artist_activation_nudge_shown", {
      state,
      has_submission: Boolean(focus),
      is_public: Boolean(focus?.isPublic),
    });
  }, [loaded, isArtist, state, focus]);

  if (!loaded || !isArtist) return null;

  const recordAction = (action: string) => {
    trackEvent("artist_activation_nudge_action", { state, action });
  };

  const shareLive = async () => {
    const url = `${window.location.origin}/catalogue`;
    const text = `${focus?.title || "My music"} is live on BVS Radio.`;
    trackEvent("artist_live_share", { state, action: "share", title_present: Boolean(focus?.title) });
    try {
      if (navigator.share) {
        await navigator.share({ title: "Live on BVS Radio", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
    } catch {
      // The share sheet can be dismissed intentionally; no error UI is needed.
    }
  };

  const title = focus?.title || "your first release";

  return (
    <section
      className="bvs-surface bvs-surface-hover rounded-3xl p-5 sm:p-6"
      aria-labelledby="artist-next-action-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="bvs-section-kicker">Your next step</p>

          {state === "first_upload" && (
            <>
              <h2 id="artist-next-action-heading" className="mt-2 text-2xl font-semibold sm:text-3xl">
                Upload your first track
              </h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary sm:text-base">
                Send one song to BVS Editorial. Our review target is within 48 hours. When approved, it can go live on BVS Radio — no Premium subscription required.
              </p>
            </>
          )}

          {state === "draft" && (
            <>
              <h2 id="artist-next-action-heading" className="mt-2 text-2xl font-semibold sm:text-3xl">
                Finish {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary sm:text-base">
                Your release has started but is not yet in editorial review. Complete the upload and rights confirmation so BVS can review it.
              </p>
            </>
          )}

          {state === "review" && (
            <>
              <h2 id="artist-next-action-heading" className="mt-2 text-2xl font-semibold sm:text-3xl">
                {title} is with BVS Editorial
              </h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary sm:text-base">
                Your submission is in the review path. The editorial target is a first action within 48 hours; this card will change when the release moves forward.
              </p>
            </>
          )}

          {state === "needs_changes" && (
            <>
              <h2 id="artist-next-action-heading" className="mt-2 text-2xl font-semibold sm:text-3xl">
                Editorial needs a fix on {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary sm:text-base">
                {focus?.notes || "Open your release details, review the editorial note, then fix and resubmit."}
              </p>
            </>
          )}

          {state === "approved" && (
            <>
              <h2 id="artist-next-action-heading" className="mt-2 text-2xl font-semibold sm:text-3xl">
                {title} is approved
              </h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary sm:text-base">
                Editorial approval is complete. Publishing to the BVS catalogue is the next step; once public, this card will show listening proof.
              </p>
            </>
          )}

          {state === "live" && (
            <>
              <h2 id="artist-next-action-heading" className="mt-2 text-2xl font-semibold sm:text-3xl">
                You’re live on BVS
              </h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary sm:text-base">
                <strong className="text-text-primary">{title}</strong> is public on BVS{focus?.inRotation ? " and in rotation" : ""}. {proof.plays === 0 ? "Share it to help get the first play." : "You now have proof that the release is being heard."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2" aria-label="Live release proof">
                <span className="bvs-chip bvs-chip-brand normal-case tracking-normal">{proof.plays} plays</span>
                <span className="bvs-chip normal-case tracking-normal">{proof.saves} saves</span>
                <span className="bvs-chip normal-case tracking-normal">{focus?.inRotation ? "In rotation" : "BVS catalogue"}</span>
              </div>
            </>
          )}

          {state === "active" && (
            <>
              <h2 id="artist-next-action-heading" className="mt-2 text-2xl font-semibold sm:text-3xl">
                Keep {title} moving
              </h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary sm:text-base">
                Open the release path to see the current editorial step and the one action that moves this release forward.
              </p>
            </>
          )}
        </div>

        <span className="bvs-chip bvs-chip-brand">Artist activation</span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(state === "first_upload" || state === "draft") && (
          <a
            href="#artist-upload"
            onClick={() => recordAction(state === "first_upload" ? "start_upload" : "resume_upload")}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black shadow-[0_12px_32px_rgba(212,175,55,.22)] hover:bg-brand-dark"
          >
            {state === "first_upload" ? "Upload your first track" : "Finish upload"}
          </a>
        )}

        {state === "needs_changes" && (
          <a
            href="#releases"
            onClick={() => recordAction("open_editorial_note")}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black hover:bg-brand-dark"
          >
            Fix & resubmit
          </a>
        )}

        {(state === "review" || state === "approved" || state === "active") && (
          <a
            href="#release-path"
            onClick={() => recordAction("open_release_path")}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black hover:bg-brand-dark"
          >
            View release path
          </a>
        )}

        {state === "live" && (
          <>
            <Link
              href="/catalogue"
              onClick={() => recordAction("open_catalogue")}
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black hover:bg-brand-dark"
            >
              Listen on BVS
            </Link>
            <button
              type="button"
              onClick={() => void shareLive()}
              className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold hover:border-brand"
            >
              Share that you’re live
            </button>
          </>
        )}

        {state !== "live" && (
          <a
            href="#release-path"
            onClick={() => recordAction("view_journey")}
            className="rounded-full border border-white/15 bg-white/[.03] px-5 py-2.5 text-sm text-text-secondary hover:border-brand/50 hover:text-text-primary"
          >
            See the full journey
          </a>
        )}
      </div>
    </section>
  );
}
