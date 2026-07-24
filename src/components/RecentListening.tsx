"use client";

import { useStationPlayer } from "./StationPlayer";

export function RecentListening() {
  const { history, playHistoryTrack, upNext, mode, playingFrom, backToStation } = useStationPlayer();
  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-bg-card/30 p-5">
        <p className="text-xs uppercase tracking-[.18em] text-brand">Session</p>
        <h2 className="mt-1 text-2xl font-semibold">Listening control</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Mode: <span className="text-white">{mode === "ondemand" ? "On demand" : "Station"}</span>
          <br />
          Playing from <span className="text-white">{playingFrom}</span>
          <br />
          Up next: {upNext.length}
        </p>
        {mode === "ondemand" && (
          <button
            type="button"
            onClick={backToStation}
            className="mt-4 rounded-full border border-brand/30 bg-brand/10 px-4 py-2 text-sm text-brand hover:bg-brand/20"
          >
            Back to BVS station
          </button>
        )}
      </div>
      <div className="rounded-2xl border border-white/10 bg-bg-card/30 p-5">
        <p className="text-xs uppercase tracking-[.18em] text-brand">This session</p>
        <h2 className="mt-1 text-2xl font-semibold">Recently played</h2>
        {history.length ? (
          <ol className="mt-5 divide-y divide-white/10">
            {history.map((track, index) => (
              <li key={`${track.src}-${index}`} className="flex gap-3 py-3">
                <span className="w-5 text-sm text-text-secondary">{index + 1}</span>
                <button type="button" onClick={() => playHistoryTrack(track)} className="min-w-0 flex-1 text-left hover:text-brand">
                  <p className="truncate text-sm font-medium">{track.title}</p>
                  <p className="truncate text-xs text-text-secondary">{track.artist}</p>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-5 text-sm text-text-secondary">
            Start the player to build your listening history. We only show tracks played in this browser session.
          </p>
        )}
      </div>
    </aside>
  );
}
