"use client";

import AppShareButton from "@/components/app-vnext/AppShareButton";

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
  if (!id) return null;
  const artistName = String(artist || "").trim();
  return (
    <AppShareButton
      title={title}
      text={artistName ? `${artistName} · Listen on BVS Radio` : "Listen on BVS Radio"}
      path={`/song/${encodeURIComponent(id)}`}
      image={image || undefined}
      kicker="Music"
      compact={compact}
      triggerLabel={triggerLabel}
      onDismiss={onDismiss}
    />
  );
}
