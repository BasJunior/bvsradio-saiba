"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import LibraryAction from "@/components/LibraryAction";
import SceneTrail from "@/components/flow/SceneTrail";
import YourBvsActivity from "@/components/flow/YourBvsActivity";
import { useLibrarySync } from "@/components/LibrarySyncProvider";
import { useStationPlayer } from "@/components/StationPlayer";
import { trackEvent } from "@/lib/analytics";
import type { DiscoveryItem } from "@/lib/discovery";
import { flowV2Flags } from "@/lib/feature-flags";
import { readLibrary, type LibrarySection } from "@/lib/library";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

type ActiveSection = LibrarySection | "owned";
type OwnedBeat = {
  beatId: string;
  orderReference: string;
  title: string;
  producerName: string;
  licenceCode: string;
  licenceSummary: string;
  purchasedAt?: string | null;
  workspaceId?: string | null;
  songTitle?: string | null;
  updatedAt?: string | null;
};

const sections: Array<{ id: ActiveSection; label: string; empty: string }> = [
  { id: "favourites", label: "Saved", empty: "Save tracks, beats and releases you want to find again." },
  { id: "follows", label: "Following", empty: "Follow artists as their BVS profiles go live." },
  { id: "history", label: "History", empty: "Tracks you actually play on BVS will appear here." },
  { id: "owned", label: "Owned", empty: "Purchased beats and licences will live here." },
];

export default function LibraryPage() {
  const [active, setActive] = useState<ActiveSection>("favourites");
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [ownedBeats, setOwnedBeats] = useState<OwnedBeat[]>([]);
  const [ownedLoading, setOwnedLoading] = useState(false);
  const [ownedError, setOwnedError] = useState("");
  const [openingBeat, setOpeningBeat] = useState("");
  const [hasListeningHistory, setHasListeningHistory] = useState(false);
  const { state, signedIn, syncNow } = useLibrarySync();
  const player = useStationPlayer();

  useEffect(() => {
    const sync = () => {
      if (active !== "owned") setItems(readLibrary(active));
      else setItems([]);
      setHasListeningHistory(readLibrary("history").length > 0);
    };
    const frame = window.requestAnimationFrame(sync);
    window.addEventListener("bvs:library-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("bvs:library-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, [active]);

  useEffect(() => {
    if (!signedIn || !isSupabaseConfigured()) {
      setOwnedBeats([]);
      return;
    }
    let cancelled = false;
    setOwnedLoading(true);
    setOwnedError("");
    createClient().auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token;
      if (!token) return;
      const response = await fetch("/api/library/owned", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (cancelled) return;
      if (!response.ok) setOwnedError(payload.error || "Could not load purchases.");
      else setOwnedBeats(Array.isArray(payload.beats) ? payload.beats : []);
    }).catch(() => {
      if (!cancelled) setOwnedError("Could not load purchases.");
    }).finally(() => {
      if (!cancelled) setOwnedLoading(false);
    });
    return () => { cancelled = true; };
  }, [signedIn]);

  useEffect(() => {
    if (!flowV2Flags.yourBvs) return;
    trackEvent("your_bvs_open");
  }, []);

  const current = sections.find((section) => section.id === active)!;
  const showContinue = flowV2Flags.yourBvs && hasListeningHistory && Boolean(player.current);

  function continueSession() {
    trackEvent("continue_listening_open", {
      track_id: player.current?.id || null,
      source: player.playingFrom,
    });
    player.toggle();
  }

  async function writeToBeat(beat: OwnedBeat) {
    if (beat.workspaceId) {
      window.location.href = `/creator/studio/songs/${beat.workspaceId}`;
      return;
    }
    if (!isSupabaseConfigured()) return;
    setOpeningBeat(beat.beatId);
    setOwnedError("");
    try {
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in before opening Lyrics Pad.");
      const response = await fetch("/api/creator/song-workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderReference: beat.orderReference, beatId: beat.beatId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not open Lyrics Pad.");
      window.location.href = `/creator/studio/songs/${payload.workspace.id}`;
    } catch (caught) {
      setOwnedError(caught instanceof Error ? caught.message : "Could not open Lyrics Pad.");
      setOpeningBeat("");
    }
  }

  return (
    <main className="mx-auto min-h-[70vh] max-w-5xl px-6 py-12">
      <p className="mb-3 text-xs uppercase tracking-[0.25em] text-brand">Your BVS</p>
      <h1 className="text-4xl md:text-5xl">{flowV2Flags.yourBvs ? "BVS remembers your path" : "Library"}</h1>
      <p className="mt-3 max-w-2xl text-text-secondary">
        {flowV2Flags.yourBvs
          ? "Return to listening, discoveries, saves, follows and the music you own."
          : !signedIn
            ? "Saved on this device. Sign in to sync across devices."
            : "Your saved and purchased BVS music."}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
        <span>
          {!signedIn
            ? "Saved on this device. Sign in to sync and see purchases."
            : state === "synced"
              ? "Synced to your BVS account."
              : state === "syncing"
                ? "Syncing your library…"
                : "Saved locally; account sync needs attention."}
        </span>
        {signedIn && state === "error" ? (
          <button type="button" onClick={syncNow} className="text-brand hover:underline">Try again</button>
        ) : null}
        {!signedIn ? <Link href="/auth/login?next=/library" className="text-brand hover:underline">Sign in</Link> : null}
      </div>

      {showContinue ? (
        <section className="mt-8 rounded-[2rem] border border-brand/20 bg-gradient-to-br from-brand/[.10] to-white/[.02] p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Continue your BVS session</p>
          <div className="mt-4 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-semibold">{player.current?.title}</h2>
              <p className="mt-1 truncate text-text-secondary">{player.current?.artist}</p>
              <p className="mt-2 text-xs text-text-secondary">Playing from {player.playingFrom}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={continueSession} className="min-h-11 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black hover:bg-brand-dark">
                {player.isPlaying ? "Pause" : "Continue"}
              </button>
              <button type="button" onClick={() => { trackEvent("continue_listening_open", { source: "now_playing" }); player.openNowPlaying(); }} className="min-h-11 rounded-full border border-white/15 px-5 py-2.5 text-sm hover:border-brand/50 hover:text-brand">
                Open player
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {flowV2Flags.yourBvs && flowV2Flags.pulse ? <YourBvsActivity /> : null}
      {flowV2Flags.sceneTrailUi ? <div className="mt-6"><SceneTrail source="recent" /></div> : null}

      <div className="mt-8 flex gap-2 overflow-x-auto border-b border-white/10 pb-4">
        {sections.map((section) => (
          <button key={section.id} type="button" onClick={() => setActive(section.id)} className={`min-h-11 shrink-0 rounded-full px-4 py-2 text-sm ${active === section.id ? "bg-brand text-black" : "text-text-secondary hover:bg-white/5 hover:text-white"}`}>
            {section.label}
          </button>
        ))}
      </div>

      {active === "owned" ? (
        <section className="mt-6">
          {ownedError ? <p className="mb-4 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">{ownedError}</p> : null}
          {!signedIn ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center">
              <h2 className="text-xl">Your purchases belong to your BVS account</h2>
              <p className="mt-2 text-text-secondary">Sign in to see purchased beats, licences and Lyrics Pads.</p>
              <Link href="/auth/login?next=/library" className="mt-5 inline-block rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black">Sign in</Link>
            </div>
          ) : ownedLoading ? (
            <p className="py-10 text-center text-text-secondary">Loading your purchases…</p>
          ) : ownedBeats.length ? (
            <div className="space-y-3">
              {ownedBeats.map((beat) => (
                <article key={`${beat.orderReference}:${beat.beatId}`} className="rounded-2xl border border-brand/15 bg-white/[.02] p-5 sm:p-6">
                  <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[.16em] text-brand">Owned · Beat licence</p>
                      <h2 className="mt-2 truncate text-xl font-semibold">{beat.title}</h2>
                      <p className="mt-1 text-sm text-text-secondary">{beat.producerName} · {beat.licenceCode.replaceAll("_", " ")}</p>
                      {beat.songTitle?.trim() ? <p className="mt-2 text-sm text-text-secondary">Song: <span className="text-text-primary">{beat.songTitle}</span></p> : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button type="button" disabled={openingBeat === beat.beatId} onClick={() => void writeToBeat(beat)} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50">
                        {openingBeat === beat.beatId ? "Opening…" : beat.workspaceId ? "Continue writing" : "Write to this beat"}
                      </button>
                      <Link href={`/account/orders/${encodeURIComponent(beat.orderReference)}`} className="rounded-full border border-white/15 px-5 py-2.5 text-sm hover:border-brand/40 hover:text-brand">View licence</Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center">
              <h2 className="text-xl">Your owned music will live here</h2>
              <p className="mt-2 text-text-secondary">Purchased BVS beat licences will appear here and can open directly into Lyrics Pad.</p>
              <Link href="/beats" className="mt-5 inline-block rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black">Browse beats</Link>
            </div>
          )}
        </section>
      ) : (
        <>
          <div className="mt-6 space-y-3">
            {items.map((item) => {
              const detailProps = item.kind === "track" ? {
                "data-flow-detail-trigger": "track",
                "data-flow-detail-id": item.id,
                "data-flow-detail-title": item.title,
                "data-flow-detail-artist": item.subtitle,
                "data-flow-detail-image": item.image || "",
                "data-flow-detail-href": item.href,
              } : {};
              return (
                <div key={item.id} className="flex items-center gap-4 rounded-xl border border-white/10 p-4">
                  <Link {...detailProps} href={item.href} className="min-w-0 flex-1"><h2 className="truncate font-medium">{item.title}</h2><p className="truncate text-sm text-text-secondary">{item.subtitle}</p></Link>
                  {active !== "history" ? <div data-flow-detail-skip="true"><LibraryAction item={item} section={active === "follows" ? "follows" : "favourites"} compact /></div> : null}
                </div>
              );
            })}
          </div>

          {items.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-white/15 p-12 text-center">
              <h2 className="text-xl">Your {current.label.toLowerCase()} will live here</h2>
              <p className="mt-2 text-text-secondary">{current.empty}</p>
              <Link href="/search" className="mt-5 inline-block rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black">Discover BVS</Link>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
