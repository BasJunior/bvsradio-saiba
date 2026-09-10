"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import { useStationPlayer } from "@/components/StationPlayer";

export const GUEST_BEAT_PREVIEW_SECONDS = 45;

type MemberAccess = {
  member?: boolean;
  owned?: boolean;
  fullAudioUrl?: string | null;
  fullAvailable?: boolean;
  workspaceId?: string | null;
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export default function AppBeatPreviewPlayer({
  title,
  artist,
  preview,
  artwork,
  genre,
  beatId,
  surface,
}: {
  title: string;
  artist: string;
  preview: string;
  artwork?: string;
  genre?: string;
  beatId?: string;
  surface?: "ios" | "android";
}) {
  const player = useStationPlayer();
  const { signedIn, token, loading: sessionLoading } = useAppSession();
  const [access, setAccess] = useState<MemberAccess | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);

  useEffect(() => {
    setAccess(null);
    if (!beatId || !signedIn || !token) return;
    let alive = true;
    setAccessLoading(true);
    fetch(`/api/beats/${encodeURIComponent(beatId)}/access`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({})) as MemberAccess;
        if (alive && response.ok) setAccess(payload);
      })
      .catch(() => {
        if (alive) setAccess({ member: false, owned: false, fullAudioUrl: null, fullAvailable: false });
      })
      .finally(() => {
        if (alive) setAccessLoading(false);
      });
    return () => { alive = false; };
  }, [beatId, signedIn, token]);

  const verifiedMember = Boolean(signedIn && access?.member);
  const isCurrent = player.current?.src === preview;
  const isPlaying = isCurrent && player.isPlaying;
  const duration = isCurrent ? player.duration : 0;
  const elapsed = isCurrent ? player.elapsed : 0;
  const progress = duration > 0 ? Math.min(1, Math.max(0, elapsed / duration)) : 0;
  const memberGateLoading = Boolean(beatId && signedIn && token && accessLoading);

  const playableTrack = useMemo(
    () => ({
      title,
      artist,
      src: preview,
      artwork,
      project: verifiedMember ? "BeatStore member preview" : "BeatStore preview",
      genre,
    }),
    [artist, artwork, genre, preview, title, verifiedMember],
  );

  const togglePlayback = () => {
    if (memberGateLoading) return;
    if (isCurrent) {
      if (!verifiedMember && elapsed >= GUEST_BEAT_PREVIEW_SECONDS - 0.25) {
        player.seek(0);
        if (!player.isPlaying) player.toggle();
        return;
      }
      player.toggle();
      return;
    }

    player.playNow(playableTrack, {
      from: verifiedMember ? "BeatStore · member full preview" : "BeatStore preview",
      related: [],
    });
    player.setQueueOpen(false);
  };

  const detailPath = beatId && surface ? `/app/${surface}/beat/${encodeURIComponent(beatId)}` : "";

  return (
    <div className="mt-3 rounded-2xl border border-white/[.08] bg-black/20 px-4 py-3" data-bvs-beat-preview-player data-bvs-member-full-preview={verifiedMember ? "true" : "false"}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlayback}
          disabled={memberGateLoading}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-base font-semibold text-black transition hover:bg-brand active:scale-95 disabled:cursor-wait disabled:opacity-60"
          aria-label={memberGateLoading ? `Unlocking ${title} member preview` : isPlaying ? `Pause ${title}` : `Play ${title} ${verifiedMember ? "full preview" : "preview"} in BVS player`}
        >
          {memberGateLoading ? "…" : isPlaying ? "Ⅱ" : "▶"}
        </button>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-white/45">
            <span>{isCurrent ? formatTime(elapsed) : verifiedMember ? "Full preview" : `Preview · ${GUEST_BEAT_PREVIEW_SECONDS}s`}</span>
            <span>{duration > 0 ? `-${formatTime(Math.max(0, duration - elapsed))}` : memberGateLoading ? "Unlocking…" : "BVS player"}</span>
          </div>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(progress * 1000)}
            disabled={!isCurrent || duration <= 0}
            onChange={(event) => player.seek(Number(event.currentTarget.value) / 1000)}
            aria-label={`Seek ${title} ${verifiedMember ? "full preview" : "preview"}`}
            className="h-1.5 w-full cursor-pointer accent-brand disabled:cursor-default disabled:opacity-35"
          />
        </div>
      </div>

      {!sessionLoading && beatId && surface && !signedIn ? (
        <div className="mt-3 rounded-xl border border-brand/20 bg-brand/[.055] p-3">
          <p className="text-xs leading-5 text-white/58">Hear a {GUEST_BEAT_PREVIEW_SECONDS}-second tagged preview now. Sign in or join BVS to hear the full tagged beat preview before choosing a licence.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href={`/app/${surface}/login?next=${encodeURIComponent(detailPath)}`} className="inline-flex min-h-9 items-center rounded-full bg-white px-3 text-xs font-semibold text-black">Sign in for full preview</Link>
            <Link href={`/app/${surface}/join?next=${encodeURIComponent(detailPath)}`} className="inline-flex min-h-9 items-center rounded-full border border-brand/30 px-3 text-xs font-semibold text-brand">Join BVS</Link>
          </div>
        </div>
      ) : null}

      {!sessionLoading && signedIn && beatId ? (
        <div className="mt-3 text-xs leading-5 text-white/45">
          {verifiedMember
            ? access?.owned
              ? "Full tagged preview unlocked. Your purchased licence also unlocks the Lyrics Pad and licensed workflow."
              : "Full tagged preview unlocked with your BVS membership. Listening access is not a beat licence — choose a licence before using or releasing it."
            : accessLoading
              ? "Unlocking your member listening access…"
              : "Member listening could not be verified right now, so the public preview remains available."}
          {access?.owned ? (
            <a href={`https://bvsradio.com/beat/${encodeURIComponent(beatId)}#beat-writing`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex font-semibold text-brand">Open your licensed Lyrics Pad on BVS web →</a>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-xs text-white/38">Plays through the persistent BVS player so another recording is paused automatically.</p>
      )}
    </div>
  );
}
