"use client";

import { useStationPlayer } from "./StationPlayer";

export function RecentListening() {
  const { history } = useStationPlayer();
  return <aside className="rounded-2xl border border-white/10 bg-bg-card/30 p-5">
    <p className="text-xs uppercase tracking-[.18em] text-brand">This session</p>
    <h2 className="mt-1 text-2xl font-semibold">Recently played</h2>
    {history.length ? <ol className="mt-5 divide-y divide-white/10">{history.map((track, index) => <li key={track.src} className="flex gap-3 py-3"><span className="w-5 text-sm text-text-secondary">{index + 1}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{track.title}</p><p className="truncate text-xs text-text-secondary">{track.artist}</p></div></li>)}</ol> : <p className="mt-5 text-sm text-text-secondary">Start the player to build your listening history. We only show tracks played in this browser session.</p>}
  </aside>;
}
