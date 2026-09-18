import "server-only";

import {
  loadParticipationProfiles,
  participationInsert,
  participationPatch,
  participationRows,
  userBlockSet,
  participationThreadEligible,
} from "@/lib/participation-server";
import { queueAndDeliverPushForNotifications } from "@/lib/participation-push-server";

type DomainEvent = {
  id: string;
  event_type: "post_created" | "message_replied" | "message_mentioned" | "thread_liked" | "thread_reposted" | "creator_followed" | "thread_reported" | "thread_moderated";
  actor_user_id?: string | null;
  thread_id?: string | null;
  message_id?: string | null;
  occurred_at: string;
  payload?: Record<string, unknown> | null;
  fanout_status: string;
  fanout_attempts: number;
};

type ThreadRow = {
  status: string;
  object_kind: "track" | "beat" | "release" | null;
  object_id: string | null;
  id: string;
  thread_type: "post" | "content";
  author_user_id?: string | null;
  object_owner_user_id?: string | null;
  object_title?: string | null;
};

type MessageRow = {
  status: string;
  id: string;
  author_user_id?: string | null;
  reply_to_id?: string | null;
  body: string;
};

type Candidate = {
  userId: string;
  category: "reply" | "mention" | "like" | "repost" | "community";
  title: string;
  detail: string;
  priority: number;
};

type NotificationRow = {
  id: string;
  recipient_user_id: string;
  event_id: string;
  category: Candidate["category"];
  title: string;
  detail: string;
  target_href: string;
  thread_id?: string | null;
  message_id?: string | null;
  created_at: string;
};

function snippet(value: string, max = 220) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function addCandidate(map: Map<string, Candidate>, candidate: Candidate, actorId?: string | null) {
  if (!candidate.userId || candidate.userId === actorId) return;
  const current = map.get(candidate.userId);
  if (!current || candidate.priority > current.priority) map.set(candidate.userId, candidate);
}

async function eventContext(event: DomainEvent) {
  const thread = event.thread_id
    ? (await participationRows<ThreadRow>(
      `participation_threads?id=eq.${encodeURIComponent(event.thread_id)}&select=id,status,object_kind,object_id,thread_type,author_user_id,object_owner_user_id,object_title&limit=1`,
    ))[0] || null
    : null;
  const message = event.message_id
    ? (await participationRows<MessageRow>(
      `participation_messages?id=eq.${encodeURIComponent(event.message_id)}&select=id,status,author_user_id,reply_to_id,body&limit=1`,
    ))[0] || null
    : null;
  const parent = message?.reply_to_id
    ? (await participationRows<MessageRow>(
      `participation_messages?id=eq.${encodeURIComponent(message.reply_to_id)}&select=id,status,author_user_id,reply_to_id,body&limit=1`,
    ))[0] || null
    : null;
  const mentions = event.message_id
    ? await participationRows<{ mentioned_user_id: string }>(
      `participation_mentions?message_id=eq.${encodeURIComponent(event.message_id)}&select=mentioned_user_id&limit=20`,
    )
    : [];
  return { thread, message, parent, mentions };
}

async function eligibleCandidates(event: DomainEvent) {
  const { thread, message, parent, mentions } = await eventContext(event);
  if (!thread || !event.thread_id || !["published", "locked"].includes(thread.status) || (message && message.status !== "published") || !(await participationThreadEligible(thread))) return { candidates: [], thread: null, message: null };
  const actorId = event.actor_user_id || null;
  const actorProfile = actorId ? (await loadParticipationProfiles([actorId]))[0] : null;
  const actorName = actorProfile?.displayName || "A BVS member";
  const ownerId = thread.thread_type === "post" ? thread.author_user_id || null : thread.object_owner_user_id || null;
  const subject = thread.thread_type === "post" ? "your post" : (thread.object_title ? `“${thread.object_title}”` : "your BVS work");
  const detail = snippet(message?.body || "Open the conversation on BVS.");
  const map = new Map<string, Candidate>();

  if (event.event_type === "post_created" || event.event_type === "message_replied" || event.event_type === "message_mentioned") {
    for (const mention of mentions) {
      addCandidate(map, {
        userId: mention.mentioned_user_id,
        category: "mention",
        title: `${actorName} mentioned you`,
        detail,
        priority: 30,
      }, actorId);
    }
  }

  // Creator follows are stored in the shared library. A creator card uses the
  // `artist-<profile id>` key while older clients may have stored the UUID
  // directly, so fan out to both forms. Mentions/replies still win because
  // addCandidate keeps the highest-priority notification for each event/user.
  if (event.event_type === "post_created" && actorId && thread.thread_type === "post") {
    const followKeys = [actorId, `artist-${actorId}`];
    const followers = await participationRows<{ user_id: string }>(
      `user_library_items?section=eq.follows&item_id=in.(${followKeys.map(encodeURIComponent).join(",")})&select=user_id&limit=5000`,
    );
    for (const follower of followers) {
      addCandidate(map, {
        userId: follower.user_id,
        category: "community",
        title: `${actorName} posted on BVS`,
        detail,
        priority: 8,
      }, actorId);
    }
  }

  if (event.event_type === "message_replied") {
    if (parent?.author_user_id) {
      addCandidate(map, {
        userId: parent.author_user_id,
        category: "reply",
        title: `${actorName} replied to you`,
        detail,
        priority: 20,
      }, actorId);
    }
    if (ownerId) {
      addCandidate(map, {
        userId: ownerId,
        category: "reply",
        title: `${actorName} replied on ${subject}`,
        detail,
        priority: 15,
      }, actorId);
    }
    const watchers = await participationRows<{ user_id: string }>(
      `participation_thread_subscriptions?thread_id=eq.${encodeURIComponent(event.thread_id)}&watch_all_replies=eq.true&muted_at=is.null&select=user_id&limit=500`,
    );
    for (const watcher of watchers) {
      addCandidate(map, {
        userId: watcher.user_id,
        category: "community",
        title: `New reply on a conversation you watch`,
        detail,
        priority: 10,
      }, actorId);
    }
  }

  if ((event.event_type === "thread_liked" || event.event_type === "thread_reposted") && ownerId) {
    const liked = event.event_type === "thread_liked";
    addCandidate(map, {
      userId: ownerId,
      category: liked ? "like" : "repost",
      title: `${actorName} ${liked ? "liked" : "reposted"} ${subject}`,
      detail: liked ? "Your work received a like on BVS." : "Your work was reposted on BVS.",
      priority: 20,
    }, actorId);
  }

  if (event.event_type === "creator_followed" && ownerId) {
    addCandidate(map, {
      userId: ownerId,
      category: "community",
      title: `${actorName} followed you on BVS`,
      detail: "Someone new is following your work.",
      priority: 12,
    }, actorId);
  }

  if (event.event_type === "thread_moderated" && ownerId) {
    addCandidate(map, {
      userId: ownerId,
      category: "community",
      title: "BVS updated a conversation you started",
      detail: "Open the thread for the current status.",
      priority: 18,
    }, actorId);
  }

  const candidates = [...map.values()];
  if (!candidates.length) return { candidates: [], thread, message };

  const actorBlocks = actorId ? await userBlockSet(actorId) : new Set<string>();
  const ids = candidates.map((candidate) => candidate.userId);
  const [preferences, muted] = await Promise.all([
    participationRows<{ user_id: string; inbox_enabled: boolean }>(
      `participation_preferences?user_id=in.(${ids.map(encodeURIComponent).join(",")})&select=user_id,inbox_enabled&limit=500`,
    ),
    participationRows<{ user_id: string }>(
      `participation_thread_subscriptions?thread_id=eq.${encodeURIComponent(event.thread_id)}&user_id=in.(${ids.map(encodeURIComponent).join(",")})&muted_at=not.is.null&select=user_id&limit=500`,
    ),
  ]);
  const preferenceById = new Map(preferences.map((row) => [row.user_id, row.inbox_enabled]));
  const mutedIds = new Set(muted.map((row) => row.user_id));
  return {
    candidates: candidates.filter((candidate) => !actorBlocks.has(candidate.userId) && !mutedIds.has(candidate.userId) && preferenceById.get(candidate.userId) !== false),
    thread,
    message,
  };
}

async function fanoutEvent(event: DomainEvent) {
  const claimed = await participationPatch<DomainEvent>(
    `participation_domain_events?id=eq.${encodeURIComponent(event.id)}&fanout_status=in.(pending,failed)`,
    { fanout_status: "processing", last_error: null, fanout_attempts: (event.fanout_attempts || 0) + 1, fanout_lease_until: new Date(Date.now() + 120_000).toISOString() },
  );
  if (!claimed[0]) return { processed: false, notifications: 0 };

  try {
    const { candidates, thread, message } = await eligibleCandidates(event);
    if (!thread || !event.thread_id) {
      await participationPatch<DomainEvent>(`participation_domain_events?id=eq.${encodeURIComponent(event.id)}`, {
        fanout_status: "complete", fanout_lease_until: null, processed_at: new Date().toISOString(), fanout_checkpoint: "no-thread",
      });
      return { processed: true, notifications: 0 };
    }

    if (candidates.length) {
      await participationInsert<NotificationRow>(
        "participation_notifications?on_conflict=recipient_user_id,event_id",
        candidates.map((candidate) => ({
          recipient_user_id: candidate.userId,
          event_id: event.id,
          category: candidate.category,
          title: candidate.title,
          detail: candidate.detail,
          target_href: `/participation/thread/${event.thread_id}`,
          thread_id: event.thread_id,
          message_id: message?.id || null,
          created_at: event.occurred_at,
        })),
        "resolution=ignore-duplicates,return=representation",
      );
    }

    const notifications = candidates.length
      ? await participationRows<NotificationRow>(
        `participation_notifications?event_id=eq.${encodeURIComponent(event.id)}&select=id,recipient_user_id,event_id,category,title,detail,target_href,thread_id,message_id,created_at&limit=500`,
      )
      : [];
    if (candidates.length && !notifications.length) throw new Error("notification persistence failed");

    if (notifications.length) {
      await participationInsert(
        "participation_deliveries?on_conflict=dedupe_key",
        notifications.map((notification) => ({
          notification_id: notification.id,
          recipient_user_id: notification.recipient_user_id,
          channel: "in_app",
          destination_key: notification.recipient_user_id,
          provider: "bvs",
          scheduled_at: event.occurred_at,
          status: "sent",
          attempts: 1,
          dedupe_key: `inbox:${notification.id}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })),
        "resolution=ignore-duplicates,return=minimal",
      );
      await queueAndDeliverPushForNotifications(notifications).catch(() => null);
    }

    await participationPatch<DomainEvent>(`participation_domain_events?id=eq.${encodeURIComponent(event.id)}`, {
      fanout_status: "complete", fanout_lease_until: null,
      fanout_checkpoint: `recipients:${notifications.length}`,
      processed_at: new Date().toISOString(),
      last_error: null,
    });
    return { processed: true, notifications: notifications.length };
  } catch (error) {
    await participationPatch<DomainEvent>(`participation_domain_events?id=eq.${encodeURIComponent(event.id)}`, {
      fanout_status: "failed", fanout_lease_until: null,
      last_error: error instanceof Error ? error.message.slice(0, 500) : "notification fanout failed",
    });
    return { processed: false, notifications: 0 };
  }
}

export async function processParticipationOutbox(limit = 25) {
  await participationPatch("participation_domain_events?fanout_status=eq.processing&fanout_lease_until=lt." + encodeURIComponent(new Date().toISOString()), { fanout_status: "failed", fanout_lease_until: null });
  const events = await participationRows<DomainEvent>(
    `participation_domain_events?fanout_status=in.(pending,failed)&fanout_attempts=lt.10&event_type=in.(post_created,message_replied,message_mentioned,thread_liked,thread_reposted,creator_followed,thread_reported,thread_moderated)&select=id,event_type,actor_user_id,thread_id,message_id,occurred_at,payload,fanout_status,fanout_attempts&order=occurred_at.asc&limit=${Math.min(100, Math.max(1, limit))}`,
  );
  let processed = 0;
  let notifications = 0;
  for (const event of events) {
    const result = await fanoutEvent(event);
    if (result.processed) processed += 1;
    notifications += result.notifications;
  }
  return { scanned: events.length, processed, notifications };
}
