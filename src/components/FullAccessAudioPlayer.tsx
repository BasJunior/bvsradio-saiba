'use client'

import { useStationPlayer } from '@/components/StationPlayer'

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

export default function FullAccessAudioPlayer({
  accessId,
  title,
  artist,
  src,
  artwork,
  sourceLabel = 'Full access playback',
  genre,
  compact = false,
}: {
  accessId: string
  title: string
  artist: string
  src?: string | null
  artwork?: string | null
  sourceLabel?: string
  genre?: string
  compact?: boolean
}) {
  const player = useStationPlayer()
  const active = Boolean(src) && player.current?.src === src && player.playingFrom === sourceLabel
  const elapsed = active ? player.elapsed : 0
  const duration = active ? player.duration : 0
  const progress = duration > 0 ? Math.min(1, Math.max(0, elapsed / duration)) : 0

  if (!src) {
    return <div className="rounded-xl border border-dashed border-white/10 px-3 py-2 text-xs text-text-secondary">Full audio is not attached to this submission.</div>
  }

  const toggle = () => {
    if (active) {
      player.toggle()
      return
    }
    player.playNow({
      id: '',
      title,
      artist,
      src,
      artwork: artwork || undefined,
      project: sourceLabel,
      genre,
      isDownloadable: false,
      licenceType: 'not_for_sale',
    }, { from: sourceLabel, related: [] })
  }

  return (
    <div data-full-access-audio={accessId} className={`flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[.055] ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
      <button
        type="button"
        onClick={toggle}
        className={`${compact ? 'h-9 w-9' : 'h-10 w-10'} grid shrink-0 place-items-center rounded-full bg-white text-sm font-black text-black`}
        aria-label={`${active && player.isPlaying ? 'Pause' : 'Play full audio'} ${title}`}
      >
        {active && player.isPlaying ? 'Ⅱ' : '▶'}
      </button>
      <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-text-secondary">{formatTime(elapsed)}</span>
      <input
        type="range"
        min="0"
        max="1000"
        value={Math.round(progress * 1000)}
        disabled={!active || duration <= 0}
        onChange={(event) => player.seek(Number(event.target.value) / 1000)}
        className="min-w-20 flex-1 accent-brand disabled:opacity-45"
        aria-label={`Seek ${title}`}
      />
      <span className="w-10 shrink-0 text-[11px] tabular-nums text-text-secondary">{duration > 0 ? `-${formatTime(Math.max(0, duration - elapsed))}` : '0:00'}</span>
    </div>
  )
}
