"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import CreatorPortraitRail from "@/components/home/CreatorPortraitRail";
import { shouldBypassImageOptimizer } from "@/lib/image-optimization";
import dynamic from "next/dynamic";
import FlowRelationships from "@/components/flow/FlowRelationships";
import { useStationPlayer } from "@/components/StationPlayer";

type SessionTab = "queue" | "history" | "room";
const sessionTabs: SessionTab[] = ["queue", "history", "room"];
const CommunityChat = dynamic(() => import("@/components/CommunityChat"), {
  loading: () => <p className="py-6 text-sm text-text-secondary" role="status">Loading listener room…</p>,
});

function TrackThumb({ src }: { src?: string }) {
  return <span className="bvs-creator-photo block">
    {src ? <Image src={src} alt="" fill sizes="(max-width: 640px) 160px, (max-width: 1024px) 200px, 240px" unoptimized={shouldBypassImageOptimizer(src)} className="object-cover" /> : <span className="absolute inset-0 grid place-items-center text-lg font-semibold text-white/60">BVS Radio</span>}
  </span>;
}

export default function RadioSessionHome() {
  const player = useStationPlayer();
  const [tab, setTab] = useState<SessionTab>("queue");
  const panelRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const heardIds = new Set(player.history.map((track) => track.id || track.src));
  if (player.current) heardIds.add(player.current.id || player.current.src);
  const heardCount = heardIds.size;

  const currentHref = player.current?.title
    ? `/catalogue?q=${encodeURIComponent(player.current.title)}`
    : "/catalogue";

  const selectTab = (value: SessionTab) => {
    setTab(value);
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 767px)").matches) return;
    window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      panelRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  };

  return (
    <div className="space-y-8">
      <section aria-label="Your BVS session">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-xs text-text-secondary">{heardCount} heard · {player.upNext.length} up next</p>
          <div className="mt-4 flex gap-1 overflow-x-auto pb-0" role="tablist" aria-label="Radio session views">
            {([
              ["queue", `Up next${player.upNext.length ? ` · ${player.upNext.length}` : ""}`],
              ["history", `Recently played${player.history.length ? ` · ${player.history.length}` : ""}`],
              ["room", "Listener room"],
            ] as Array<[SessionTab, string]>).map(([value, label], index) => (
              <button
                key={value}
                type="button"
                role="tab"
                id={`radio-tab-${value}`}
                ref={element => { tabRefs.current[index] = element; }}
                tabIndex={tab === value ? 0 : -1}
                aria-selected={tab === value}
                aria-controls="radio-session-panel"
                onClick={() => selectTab(value)}
                onKeyDown={event => {
                  const next = event.key === "ArrowRight" ? (index + 1) % sessionTabs.length
                    : event.key === "ArrowLeft" ? (index + sessionTabs.length - 1) % sessionTabs.length
                      : event.key === "Home" ? 0 : event.key === "End" ? sessionTabs.length - 1 : null;
                  if (next === null) return;
                  event.preventDefault();
                  setTab(sessionTabs[next]);
                  tabRefs.current[next]?.focus();
                }}
                className={`min-h-11 shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition ${
                  tab === value ? "border-brand text-white" : "border-transparent text-text-secondary hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div ref={panelRef} id="radio-session-panel" role="tabpanel" aria-labelledby={`radio-tab-${tab}`} tabIndex={0} className="mt-3 scroll-mt-32">
          {tab === "queue" ? (
            <CreatorPortraitRail title="Up next" kicker="Your BVS session" tone="charcoal" allHref="#radio-session" allAction={() => player.setQueueOpen(true)} allLabel="Full queue" emptyMessage="The station will build what comes next when playback starts." items={player.upNext.slice(0, 18).map(item => ({ id: item.key, name: item.track.title, image: item.track.artwork || "", href: "#radio-session", detail: item.track.artist }))}>
              {player.upNext.slice(0, 18).map((item, index) => <button key={item.key} type="button" onClick={() => player.jumpToQueueItem(item.key)} className="bvs-creator-portrait text-left" aria-label={`Play ${item.track.title} by ${item.track.artist}`}>
                <TrackThumb src={item.track.artwork} />
                <span className="bvs-creator-caption block"><span className="block truncate text-base font-extrabold">{item.track.title}</span><span className="mt-1 block truncate text-xs opacity-75">{item.track.artist}</span><span className="mt-2 block text-[10px] uppercase tracking-wider opacity-70">{index + 1} · {item.source === "user" ? "Your queue" : item.source === "mix" ? "Similar" : "Station"}</span></span>
              </button>)}
            </CreatorPortraitRail>
          ) : null}

          {tab === "history" ? (
            <CreatorPortraitRail title="Recently played" kicker="Your BVS session" tone="charcoal" allHref="/library" allLabel="Your Library" emptyMessage="Recently played will build here as your session unfolds." items={player.history.slice(0, 18).map((track, index) => ({ id: `${track.id || track.src}-${index}`, name: track.title, image: track.artwork || "", href: "/library", detail: track.artist }))}>
              {player.history.slice(0, 18).map((track, index) => <button key={`${track.id || track.src}-${index}`} type="button" onClick={() => player.playHistoryTrack(track)} className="bvs-creator-portrait text-left" aria-label={`Play ${track.title} again`}>
                <TrackThumb src={track.artwork} />
                <span className="bvs-creator-caption block"><span className="block truncate text-base font-extrabold">{track.title}</span><span className="mt-1 block truncate text-xs opacity-75">{track.artist}</span><span className="mt-2 block text-[10px] uppercase tracking-wider opacity-70">Play again</span></span>
              </button>)}
            </CreatorPortraitRail>
          ) : null}

          {tab === "room" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-2xl text-sm text-text-secondary">Listen and follow the room without leaving the station. Signed-in listeners can read; eligible members can join the conversation.</p>
                <Link href="/radio/room" className="text-sm text-brand hover:underline">Open full room →</Link>
              </div>
              <CommunityChat roomTitle="BVS live room" loginNext="/radio/room" />
            </div>
          ) : null}
        </div>
      </section>

      <section id="radio-context" className="scroll-mt-28 pt-4 sm:pt-6" aria-labelledby="around-track-heading">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-text-secondary">Meet the creators</p>
            <h2 id="around-track-heading" className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Behind the music</h2>
            <p className="mt-4 truncate text-lg font-medium">{player.current?.title || "The BVS rotation"}</p>
            <p className="mt-1 truncate text-sm text-text-secondary">
              {player.current ? `${player.current.artist}${player.current.project ? ` · ${player.current.project}` : ""}` : "Verified BVS context appears as the station plays."}
            </p>
          </div>
          {player.current ? (
            <Link
              href={currentHref}
              data-flow-detail-trigger="track"
              data-flow-detail-id={player.current.id || ""}
              data-flow-detail-title={player.current.title}
              data-flow-detail-artist={player.current.artist}
              data-flow-detail-image={player.current.artwork || ""}
              data-flow-detail-href={currentHref}
              className="shrink-0 rounded-full border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
            >
              Track details
            </Link>
          ) : null}
        </div>
        {player.current?.id ? (
          <FlowRelationships kind="track" id={player.current.id} compact />
        ) : (
          <p className="mt-4 text-sm text-text-secondary">Start the station to reveal verified creator and producer relationships when BVS has them.</p>
        )}
      </section>
    </div>
  );
}
