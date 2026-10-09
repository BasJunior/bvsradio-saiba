"use client";

import AppShareButton from "@/components/app-vnext/AppShareButton";

const PUBLIC_SONG_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function SongShareButton({
  id,
  title,
  artist,
  image,
  compact = true,
  triggerLabel = "Share song",
  onDismiss,
}: {
  id?: string | null;
  title: string;
  artist?: string | null;
  image?: string | null;
  compact?: boolean;
  triggerLabel?: string;
  onDismiss?: () => void;
}) {
  const trackId = String(id || "").trim();
  if (!PUBLIC_SONG_ID.test(trackId)) return null;
  const artistName = String(artist || "").trim();
  return (
    <AppShareButton
      title={title}
      text={artistName ? `${artistName} · Listen on BVS Radio` : "Listen on BVS Radio"}
      path={`/song/${encodeURIComponent(trackId)}`}
      image={image || undefined}
      kicker="Music"
      compact={compact}
      triggerLabel={triggerLabel}
      onDismiss={onDismiss}
    />
  );
}
