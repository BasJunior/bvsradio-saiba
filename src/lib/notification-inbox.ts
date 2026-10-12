"use client";

export type InboxEvent = {
  id: string; title: string; detail: string; created_at: string; href: string; kind: string;
  notificationId?: string; seen_at?: string | null; read_at?: string | null;
  source?: "operations" | "participation" | "marketplace";
  marketplaceEntity?: "profile" | "listing"; marketplaceEntityId?: string; canReply?: boolean;
};

// Keep independent inbox sources usable when one API is unavailable.
export async function loadNotificationInbox(token: string, surface?: "ios" | "android", signal?: AbortSignal) {
  const sources = [
    { source: "operations" as const, href: "/api/notifications" },
    { source: "participation" as const, href: `/api/app/participation/notifications?${surface ? `surface=${surface}&` : ""}limit=75` },
    { source: "marketplace" as const, href: "/api/marketplace/messages/notifications" },
  ];
  const results = await Promise.allSettled(sources.map(async ({ source, href }) => {
    const response = await fetch(href, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000) });
    const payload = await response.json().catch(() => ({})) as { events?: InboxEvent[]; unreadCount?: number };
    if (response.status === 404 && source === "participation") return { source, events: [] as InboxEvent[], unreadCount: 0 };
    if (!response.ok) throw new Error(`${source} inbox unavailable`);
    return { source, events: (payload.events || []).filter(event => event.id && Number.isFinite(Date.parse(event.created_at))).map(event => ({ ...event, source })), unreadCount: Number(payload.unreadCount) || 0 };
  }));
  const loaded = results.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
  return { loaded, failed: results.length - loaded.length, total: sources.length };
}

export function mergeNotificationInbox(previous: InboxEvent[], loaded: Array<{ source: NonNullable<InboxEvent["source"]>; events: InboxEvent[] }>) {
  const replaced = new Set(loaded.map(row => row.source));
  const merged = [...previous.filter(event => event.source && !replaced.has(event.source)), ...loaded.flatMap(row => row.events)];
  return [...new Map(merged.map(event => [event.id, event])).values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

// Acknowledge only updates actually loaded by this view. Failed sources and
// notifications arriving during the request must remain unseen.
export async function acknowledgeNotificationInbox(token: string, userId: string, loaded: Array<{ source: NonNullable<InboxEvent["source"]>; events: InboxEvent[] }>, signal?: AbortSignal) {
  let confirmed = false;
  let failed = false;
  for (const row of loaded) {
    if (row.source === "participation") {
      const ids = row.events.filter(event => !event.seen_at && !event.read_at).map(event => event.notificationId).filter(Boolean);
      if (!ids.length) continue;
      try {
        const response = await fetch("/api/app/participation/notifications", {
          method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ ids, seen: true }), signal,
        });
        if (!response.ok) { failed = true; continue; }
        confirmed = true;
      } catch { failed = true; }
    } else if (row.events.length) {
      // Separate watermarks: a successful operations refresh cannot clear a
      // failed Marketplace refresh. Use event time, never the client's clock.
      const latest = row.events.map(event => event.created_at).sort().at(-1)!;
      try {
        const key = `bvs_notifications_seen_at:${userId}:${row.source}`;
        const previous = window.localStorage.getItem(key) || "";
        if (latest > previous) window.localStorage.setItem(key, latest);
        confirmed = true;
      } catch { failed = true; }
    }
  }
  if (confirmed && !signal?.aborted) window.dispatchEvent(new Event("bvs:notifications-seen"));
  return !failed;
}
