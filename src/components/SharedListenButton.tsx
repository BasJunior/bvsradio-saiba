"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useStationPlayer } from "@/components/StationPlayer";

export default function SharedListenButton({
  className,
  idleLabel = "Listen live",
}: {
  className?: string;
  idleLabel?: string;
}) {
  const player = useStationPlayer();
  const pathname = usePathname();
  const surface = pathname.match(/^\/app\/(ios|android)(?:\/|$)/)?.[1];
  const radioHref = surface ? `/app/${surface}/radio` : "/radio";
  const [pending, setPending] = useState(false);
  const live = player.sharedProgramme && player.isPlaying;

  if (live) {
    return (
      <Link href={radioHref} className={className}>
        Go to Radio
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={async () => {
        setPending(true);
        try {
          await player.joinSharedProgramme();
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? "Joining…" : idleLabel}
    </button>
  );
}
