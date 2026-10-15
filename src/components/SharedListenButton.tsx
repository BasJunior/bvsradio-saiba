"use client";

import Link from "next/link";
import { useState } from "react";
import { useStationPlayer } from "@/components/StationPlayer";

export default function SharedListenButton({
  className,
  idleLabel = "Listen live",
}: {
  className?: string;
  idleLabel?: string;
}) {
  const player = useStationPlayer();
  const [joined, setJoined] = useState(false);
  const [pending, setPending] = useState(false);
  // The station poll marks the shared clock before audio starts. The button
  // stays Listen until this press joins, or until shared audio is already playing.
  const live = joined || (player.sharedProgramme && player.isPlaying);

  if (live) {
    return (
      <Link href="/radio" className={className}>
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
        const ok = await player.joinSharedProgramme();
        setPending(false);
        if (ok) setJoined(true);
      }}
    >
      {pending ? "Joining…" : idleLabel}
    </button>
  );
}
