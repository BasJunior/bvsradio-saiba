"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import CommunityChat from "@/components/CommunityChat";
import FlowRelationships from "@/components/flow/FlowRelationships";
import { useStationPlayer } from "@/components/StationPlayer";

type SessionTab = "queue" | "history" | "room";

function TrackThumb({ src }: { src?: string }) {
  return (
    <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.05]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-[10px] font-semibold text-text-secondary">BVS</span>
      )}
    </span>
  );
}

export default function RadioSessionHome() {
  const player = useStationPlayer();
  const [tab, setTab] = useState<SessionTab>("queue");
  const heardCount = useMemo(() => {
    const ids = new Set(player.history.map((track) => track.id || track.src));
    if (player.current) ids.add(player.current.id || player.current.src);
    return ids.size;
  }, [player.current, player.history]);

  const currentHref = player.current?.title
    ? `/catalogue?q=${encodeURIComponent(player.current.title)}`
    : "/catalogue";

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-bg-card/35" aria-labelledby="radio-session-heading">
        <div className="border-b border-white/10 px-4 pt-4 sm:px-6 sm:pt-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Your BVS session</p>
              <h2 id="radio-session-heading" className="mt-1 text-xl font-semibold sm:text-2xl">Stay with the station.</h2>
            </div>
            <p className="text-xs text-text-secondary">{heardCount} heard · {player.upNext.length} up next</p>
          </div>
          <div className="mt-4 flex gap-1 overflow-x-auto pb-0" role="tablist" aria-label="Radio session views">
            {([
              ["queue", `Up next${player.upNext.length ? ` · ${player.upNext.length}` : ""}`],
              ["history", `Recently played${player.history.length ? ` · ${player.history.length}` : ""}`],
              ["room", "Live room"],
            ] as Array<[SessionTab, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`min-h-11 shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition ${
                  tab === value ? "border-brand text-white" : "border-transparent text-text-secondary hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {tab === "queue" ? (
            <div role="tabpanel" className="space-y-2">
              {player.upNext.length ? player.upNext.slice(0, 8).map((item, index) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => player.jumpToQueueItem(item.key)}
                  className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-xl border border-transparent px-2 py-2 text-left hover:border-white/10 hover:bg-white/[0.04]"
                >
                  <span className="w-5 shrink-0 text-center text-xs tabular-nums text-text-secondary">{index + 1}</span>
                  <TrackThumb src={item.track.artwork} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.track.title}</span>
                    <span className="block truncate text-xs text-text-secondary">{item.track.artist}</span>
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-text-secondary">
                    {item.source === "user" ? "You" : item.source === "mix" ? "Similar" : "Station"}
                  </span>
                </button>
              )) : (
                <div className="rounded-xl border border-dashed border-white/10 p-7 text-center text-sm text-text-secondary">
                  The station will build what comes next when playback starts.
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <button type="button" onClick={() => player.setQueueOpen(true)} className="rounded-full border border-white/15 px-4 py-2 text-sm hover:bg-white/5">
                  Open full queue
                </button>
                {player.mode === "ondemand" ? (
                  <button type="button" onClick={player.backToStation} className="rounded-full border border-brand/30 bg-brand/10 px-4 py-2 text-sm text-brand hover:bg-brand/20">
                    Back to station
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === "history" ? (
            <div role="tabpanel">
              {player.history.length ? (
                <ol className="space-y-2">
                  {player.history.slice(0, 12).map((track, index) => (
                    <li key={`${track.id || track.src}-${index}`}>
                      <button type="button" onClick={() => player.playHistoryTrack(track)} className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/[0.04]">
                        <TrackThumb src={track.artwork} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{track.title}</span>
                          <span className="block truncate text-xs text-text-secondary">{track.artist}</span>
                        </span>
                        <span className="shrink-0 text-xs text-brand">Play again</span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 p-7 text-center text-sm text-text-secondary">
                  Recently played will build here as your session unfolds.
                </div>
              )}
              <div className="pt-4"><Link href="/library" className="text-sm text-brand hover:underline">Open your Library →</Link></div>
            </div>
          ) : null}

          {tab === "room" ? (
            <div role="tabpanel" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-2xl text-sm text-text-secondary">Listen and follow the room without leaving the station. Signed-in listeners can read; eligible members can join the conversation.</p>
                <Link href="/radio/room" className="text-sm text-brand hover:underline">Open full room →</Link>
              </div>
              <CommunityChat roomId="bvs-live" roomTitle="BVS live room" loginNext="/radio/room" />
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-bg-card/25 p-5 sm:p-6" aria-labelledby="around-track-heading">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Around what you’re hearing</p>
            <h2 id="around-track-heading" className="mt-1 truncate text-2xl font-semibold">{player.current?.title || "The BVS rotation"}</h2>
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
