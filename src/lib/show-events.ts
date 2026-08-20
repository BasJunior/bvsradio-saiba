export type ShowPhase = "scheduled" | "live" | "ended" | "archived";

export type ShowEventStatus = "scheduled" | "live" | "ended" | "archived" | "cancelled";

export type ShowEvent = {
  id: string;
  programmeSlug: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  status: ShowEventStatus;
  roomId: string;
  liveVideoUrl: string | null;
  replayVideoUrl: string | null;
  archivePublishedAt: string | null;
};

function timestamp(value: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Resolve the listener-facing lifecycle without claiming that an event is live
 * from a schedule alone. Editorial must explicitly set `status = live`.
 */
export function resolveShowPhase(event: ShowEvent, now = new Date()): ShowPhase {
  if (event.status === "archived") return event.archivePublishedAt && event.replayVideoUrl ? "archived" : "ended";
  if (event.status === "ended") return event.archivePublishedAt && event.replayVideoUrl ? "archived" : "ended";

  const nowMs = now.getTime();
  const endMs = timestamp(event.endsAt);
  if (endMs !== null && nowMs >= endMs) {
    return event.archivePublishedAt && event.replayVideoUrl ? "archived" : "ended";
  }

  if (event.status === "live") return "live";
  return "scheduled";
}

export function showPhaseLabel(phase: ShowPhase) {
  if (phase === "live") return "Live now";
  if (phase === "archived") return "Watch replay";
  if (phase === "ended") return "Broadcast ended";
  return "Upcoming";
}
