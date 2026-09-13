import "server-only";
import { participationRows, participationThreadEligible, userBlockSet } from "@/lib/participation-server";
import type { AppSurface } from "@/lib/app-surface";

export function notificationHref(target: string, surface: AppSurface | null) {
  const thread = target.match(/^\/participation\/thread\/([a-f0-9-]+)$/i);
  if (thread) return surface ? `/app/${surface}/feed/${thread[1]}` : `/feed/${thread[1]}`;
  if (target === "/participation/feed") return surface ? `/app/${surface}/notifications` : "/notifications";
  return surface ? `/app/${surface}/notifications` : "/notifications";
}

export function quietNow(timezone: string, start?: string | null, end?: string | null, now = new Date()) {
  if (!start || !end || start.slice(0, 5) === end.slice(0, 5)) return false;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone || "UTC", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const clock = `${parts.find(p => p.type === "hour")?.value}:${parts.find(p => p.type === "minute")?.value}`;
  const a = start.slice(0, 5), b = end.slice(0, 5);
  return a < b ? clock >= a && clock < b : clock >= a || clock < b;
}

export async function notificationEligible(row: { recipient_user_id: string; event_id?: string | null; thread_id?: string | null; message_id?: string | null }, surface: AppSurface | null = null) {
  if (!row.thread_id) return !row.event_id;
  const threads = await participationRows<{ id: string; status: string; thread_type: "post" | "content"; object_kind: "track" | "beat" | "release" | null; object_id: string | null; author_user_id: string | null }>(`participation_threads?id=eq.${encodeURIComponent(row.thread_id)}&select=id,status,thread_type,object_kind,object_id,author_user_id&limit=1`);
  const thread = threads[0];
  if (!thread || !["published", "locked"].includes(thread.status) || !(await participationThreadEligible(thread, surface))) return false;
  const blocked = await userBlockSet(row.recipient_user_id);
  if (thread.author_user_id && blocked.has(thread.author_user_id)) return false;
  if (row.message_id) {
    const messages = await participationRows<{ status: string; author_user_id: string | null }>(`participation_messages?id=eq.${encodeURIComponent(row.message_id)}&select=status,author_user_id&limit=1`);
    if (!messages[0] || messages[0].status !== "published" || (messages[0].author_user_id && blocked.has(messages[0].author_user_id))) return false;
  }
  if (row.event_id) {
    const events = await participationRows<{ actor_user_id: string | null }>(`participation_domain_events?id=eq.${encodeURIComponent(row.event_id)}&select=actor_user_id&limit=1`);
    if (!events[0] || (events[0].actor_user_id && blocked.has(events[0].actor_user_id))) return false;
  }
  return true;
}
