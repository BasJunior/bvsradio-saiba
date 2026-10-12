import "server-only";
import { participationRows, participationInsert, participationRpc } from "@/lib/participation-server";
import { notificationEligible, notificationHref, quietNow } from "@/lib/participation-delivery-policy";
import { rankNotifications, orchestrationPreferences, type NotificationCandidate, type NotificationContact, type OrchestrationCategory } from "@/lib/notification-orchestration";

// Deliberately no enforcement option yet: shadow decisions cannot change delivery.
export const notificationShadowEnabled = () => process.env.BVS_NOTIFICATION_ORCHESTRATION === "shadow";
const motivations: Record<string, OrchestrationCategory> = {
  player_start: "new_music", track_save: "new_music", first_listen: "new_music", creator_follow: "followed_artists",
  studio_open: "creator_updates", release_submitted: "creator_updates", create_submission_complete: "creator_updates",
  beat_save: "commerce", checkout_complete: "commerce", first_post: "community", search_result_open: "recommendations",
};
export async function recordNotificationActivity(userId: string, event: string) {
  const motivation = motivations[event];
  if (!notificationShadowEnabled() || !motivation) return;
  await participationRpc("record_notification_activity", { p_user: userId, p_motivation: motivation, p_entity: null });
}

type Row = {
  id: string; recipient_user_id: string; category: string; target_href: string; created_at: string;
  thread_id: string | null; message_id: string | null; event_id: string | null; seen_at: string | null; read_at: string | null;
};
type Delivery = { notification_id: string; updated_at: string };
type Interaction = { notification_id: string; event: string; created_at: string };
const keyFor = (row: Row) => row.message_id ? `message:${row.message_id}` : row.thread_id ? `thread:${row.thread_id}` : `notification:${row.id}`;
function candidateFor(row: Row, eligible: boolean): NotificationCandidate {
  return {
    id: row.id, category: "community", eventType: row.category, entityKey: keyFor(row),
    equivalentKey: `${row.category}:${keyFor(row)}`, deepLink: notificationHref(row.target_href, null),
    createdAt: row.created_at, expiresAt: new Date(Date.parse(row.created_at) + 48 * 3600000).toISOString(),
    importance: row.category === "mention" ? 80 : row.category === "reply" ? 65 : row.category === "like" ? 20 : 30,
    urgency: 1, operational: false, eligible, actionCompleted: false, seen: Boolean(row.seen_at || row.read_at),
  };
}
export async function evaluateNotificationShadow(limit = 100) {
  if (!notificationShadowEnabled()) return { enabled: false, evaluated: 0 };
  const now = Date.now();
  const since = new Date(now - 48 * 3600000).toISOString();
  const rows = await participationRows<Row>(`participation_notifications?created_at=gte.${encodeURIComponent(since)}&read_at=is.null&seen_at=is.null&select=id,recipient_user_id,category,target_href,created_at,thread_id,message_id,event_id,seen_at,read_at&order=created_at.desc&limit=${Math.min(250, Math.max(1, limit))}`);
  let evaluated = 0;
  const deadline = Date.now() + 20000;
  // Bounded audit only; does not suppress, enqueue, or mark any push as sent.
  for (const userId of [...new Set(rows.map(r => r.recipient_user_id))].slice(0, 5)) {
    if (Date.now() > deadline) break;
    const uid = encodeURIComponent(userId);
    const [legacy, preferences, profiles, devices, deliveries, interactions] = await Promise.all([
      participationRows<Record<string, boolean>>(`app_notification_preferences?user_id=eq.${uid}&select=releases,shows,creator_work,orders,community,marketing&limit=1`),
      participationRows<{ external_community_enabled: boolean; timezone: string; quiet_start: string | null; quiet_end: string | null }>(`participation_preferences?user_id=eq.${uid}&select=external_community_enabled,timezone,quiet_start,quiet_end&limit=1`),
      participationRows<{ motivation_counts: Partial<Record<OrchestrationCategory, number>>; active_entity_key: string | null; active_at: string | null }>(`notification_engagement_profiles?user_id=eq.${uid}&select=motivation_counts,active_entity_key,active_at&limit=1`),
      participationRows<{ platform: string }>(`app_push_devices?user_id=eq.${uid}&enabled=eq.true&select=platform&limit=10`),
      participationRows<Delivery>(`participation_deliveries?recipient_user_id=eq.${uid}&channel=eq.push&status=eq.sent&updated_at=gte.${encodeURIComponent(new Date(now - 7 * 86400000).toISOString())}&select=notification_id,updated_at&order=updated_at.desc&limit=1000`),
      participationRows<Interaction>(`notification_interactions?user_id=eq.${uid}&created_at=gte.${encodeURIComponent(new Date(now - 7 * 86400000).toISOString())}&select=notification_id,event,created_at&limit=1000`),
    ]);
    const sentIds = [...new Set(deliveries.map(d => d.notification_id).filter(Boolean))];
    const sentRows = sentIds.length ? await participationRows<Row>(`participation_notifications?id=in.(${sentIds.map(encodeURIComponent).join(",")})&select=id,recipient_user_id,category,target_href,created_at,thread_id,message_id,event_id,seen_at,read_at&limit=1000`) : [];
    const sentById = new Map(sentRows.map(r => [r.id, r]));
    const contacts: NotificationContact[] = deliveries.filter(d => d.notification_id).map(d => {
      const row = sentById.get(d.notification_id);
      return { notificationId: d.notification_id, category: "community", equivalentKey: row ? `${row.category}:${keyFor(row)}` : d.notification_id, sentAt: d.updated_at, openedAt: interactions.find(i => i.notification_id === d.notification_id && i.event === "notification_opened")?.created_at, operational: false };
    });
    const pref = preferences[0];
    const selected = rows.filter(r => r.recipient_user_id === userId);
    const candidates = await Promise.all(selected.map(async r => {
      // Be conservative when an account has iOS devices; never rank uncleared content for push.
      const candidate = candidateFor(r, await notificationEligible(r, devices.some(d => d.platform === "ios") ? "ios" : null));
      candidate.actionCompleted = interactions.some(i => i.notification_id === r.id && i.event === "primary_action_completed");
      return candidate;
    }));
    let quiet = true;
    try { quiet = quietNow(pref?.timezone || "UTC", pref?.quiet_start, pref?.quiet_end, new Date(now)); } catch { /* invalid timezone fails closed */ }
    const decisions = rankNotifications(candidates, {
      preferences: orchestrationPreferences({ ...legacy[0], community: pref?.external_community_enabled === true }),
      pushAllowed: devices.length > 0, quiet, holdout: false,
      affinities: Object.fromEntries(Object.entries(profiles[0]?.motivation_counts || {}).map(([k, count]) => [k, .5 + Math.min(1.5, Math.log1p(Math.max(0, Number(count))) / 3)])),
      activeEntityKey: profiles[0]?.active_entity_key, activeAt: profiles[0]?.active_at, contacts,
    }, now);
    if (decisions.length) await participationInsert("notification_decisions?on_conflict=notification_id", decisions.map(d => ({ notification_id: d.id, user_id: userId, model_version: "heuristic-v1", mode: "shadow", category: "community", action: d.action, reason: d.reason, score: d.score, evaluated_at: new Date(now).toISOString() })), "resolution=merge-duplicates,return=minimal");
    evaluated += decisions.length;
  }
  return { enabled: true, evaluated };
}
