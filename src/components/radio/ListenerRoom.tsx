"use client";

import Image from "next/image";
import Link from "next/link";
import CommunityChat from "@/components/CommunityChat";
import { useStationPlayer } from "@/components/StationPlayer";
import { shouldBypassImageOptimizer } from "@/lib/image-optimization";

export default function ListenerRoom({ standalone = false }: { standalone?: boolean }) {
  const player = useStationPlayer();
  const track = player.current;
  const trackLabel = track ? `${track.title} by ${track.artist}` : "the BVS rotation";
  return <section aria-label="Listener room" className="space-y-6">
    {!standalone ? <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-text-secondary">Listen together</p><h2 className="mt-2 text-4xl font-extrabold uppercase tracking-tight sm:text-5xl">Listener room</h2></div>
      <Link href="/radio/room" className="text-sm text-brand hover:underline">Open full room</Link>
    </header> : null}
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <aside className="space-y-5">
        <div className="border border-white/10 bg-white/[.025] p-5">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-text-secondary">Your listening session</p>
          <div className="mt-4 flex items-center gap-4 lg:block">
            <div className="relative aspect-square w-24 shrink-0 overflow-hidden bg-white/5 lg:w-full lg:max-w-64">
              {track?.artwork ? <Image src={track.artwork} alt="" fill sizes="(min-width: 1024px) 256px, 96px" unoptimized={shouldBypassImageOptimizer(track.artwork)} className="object-cover" /> : <span className="absolute inset-0 grid place-items-center text-xl font-bold text-white/40">BVS</span>}
            </div>
            <div className="min-w-0 lg:mt-4"><p className="text-sm text-text-secondary">{player.isPlaying ? "Playing on your device" : "Playback paused"}</p><h3 className="mt-1 break-words text-xl font-bold">{track?.title || "BVS Radio"}</h3><p className="mt-1 break-words text-sm text-text-secondary">{track?.artist || "Start listening to the rotation"}</p></div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={player.toggle} className="min-h-11 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black">{player.isPlaying ? "Pause music" : "Play music"}</button>{track ? <button type="button" onClick={player.openNowPlaying} className="min-h-11 rounded-full border border-white/15 px-4 py-2 text-sm">Track details</button> : null}</div>
          <p className="mt-4 text-sm leading-6 text-text-secondary">One conversation, individual listening sessions. Share the track name so others can find what you’re hearing.</p>
        </div>
        <div className="px-1"><h3 className="text-base font-semibold">Keep it about the music</h3><p className="mt-2 text-sm leading-6 text-text-secondary">Tell us what stands out, ask about a creator, or recommend a track. Give other voices room and keep repeated promotion out of the conversation.</p><Link href="/radio/schedule" className="mt-3 inline-block text-sm text-brand hover:underline">Station schedule</Link></div>
      </aside>
      <CommunityChat roomTitle="The conversation" loginNext="/radio/room" prompts={[
        { label: "React to this track", text: `Listening to ${trackLabel}. What stands out to me is ` },
        { label: "Ask about the music", text: `Does anyone know more about ${trackLabel}? ` },
        { label: "Recommend a track", text: "My next BVS listen would be " },
      ]} />
    </div>
  </section>;
}
