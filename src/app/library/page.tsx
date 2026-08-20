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

const sections: Array<{ id: LibrarySection; label: string; empty: string }> = [
  { id: "favourites", label: "Saved", empty: "Save tracks you want to find again." },
  { id: "follows", label: "Following", empty: "Follow artists as their BVS profiles go live." },
  { id: "history", label: "History", empty: "Tracks you actually play on BVS will appear here." },
];

export default function LibraryPage() {
  const [active, setActive] = useState<LibrarySection>("favourites");
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [hasListeningHistory, setHasListeningHistory] = useState(false);
  const { state, signedIn, syncNow } = useLibrarySync();
  const player = useStationPlayer();

  useEffect(() => {
    const sync = () => {
      setItems(readLibrary(active));
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

  return (
    <main className="mx-auto min-h-[70vh] max-w-5xl px-6 py-12">
      <p className="mb-3 text-xs uppercase tracking-[0.25em] text-brand">Your BVS</p>
      <h1 className="text-4xl md:text-5xl">{flowV2Flags.yourBvs ? "BVS remembers your path" : "Library"}</h1>
      <p className="mt-3 max-w-2xl text-text-secondary">
        {flowV2Flags.yourBvs
          ? "Return to your listening session, recent discoveries, saves, follows and what changed while you were away."
          : !signedIn
            ? "Saved on this device. Sign in to sync across devices."
            : "Your saved BVS music and creators."}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
        <span>
          {!signedIn
            ? "Saved on this device. Sign in to sync across devices."
            : state === "synced"
              ? "Synced to your BVS account."
              : state === "syncing"
                ? "Syncing your library…"
                : "Saved locally; account sync needs attention."}
        </span>
        {signedIn && state === "error" ? (
          <button type="button" onClick={syncNow} className="text-brand hover:underline">Try again</button>
        ) : null}
        {!signedIn ? <Link href="/auth/login" className="text-brand hover:underline">Sign in</Link> : null}
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
              <button
                type="button"
                onClick={continueSession}
                className="min-h-11 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black hover:bg-brand-dark"
              >
                {player.isPlaying ? "Pause" : "Continue"}
              </button>
              <button
                type="button"
                onClick={() => {
                  trackEvent("continue_listening_open", { source: "now_playing" });
                  player.openNowPlaying();
                }}
                className="min-h-11 rounded-full border border-white/15 px-5 py-2.5 text-sm hover:border-brand/50 hover:text-brand"
              >
                Open player
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {flowV2Flags.yourBvs && flowV2Flags.pulse ? <YourBvsActivity /> : null}

      {flowV2Flags.sceneTrailUi ? (
        <div className="mt-6">
          <SceneTrail source="recent" />
        </div>
      ) : null}

      <div className="mt-8 flex gap-2 overflow-x-auto border-b border-white/10 pb-4">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setActive(section.id)}
            className={`min-h-11 shrink-0 rounded-full px-4 py-2 text-sm ${
              active === section.id ? "bg-brand text-black" : "text-text-secondary hover:bg-white/5 hover:text-white"
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-4 rounded-xl border border-white/10 p-4">
            <Link href={item.href} className="min-w-0 flex-1">
              <h2 className="truncate font-medium">{item.title}</h2>
              <p className="truncate text-sm text-text-secondary">{item.subtitle}</p>
            </Link>
            {active !== "history" ? (
              <LibraryAction item={item} section={active === "follows" ? "follows" : "favourites"} compact />
            ) : null}
          </div>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-white/15 p-12 text-center">
          <h2 className="text-xl">Your {current.label.toLowerCase()} will live here</h2>
          <p className="mt-2 text-text-secondary">{current.empty}</p>
          <Link href="/search" className="mt-5 inline-block rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black">
            Discover BVS
          </Link>
        </div>
      ) : null}
    </main>
  );
}
