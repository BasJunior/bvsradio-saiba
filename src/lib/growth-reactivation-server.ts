import "server-only";

import {
  participationInsert,
  participationPatch,
  participationRows,
} from "@/lib/participation-server";
import { queueAndDeliverPushForNotifications } from "@/lib/participation-push-server";

type GrowthMember = {
  user_id: string;
  role: string;
  joined_at: string;
  last_active_at?: string | null;
};

type DomainEvent = {
  id: string;
  source_key: string;
};

type Notification = {
  id: string;
  recipient_user_id: string;
  event_id: string;
  category: string;
  title: string;
  detail: string;
  target_href: string;
  created_at: string;
};

function copyFor(role: string) {
  if (role === "artist") {
    return {
      title: "Finish your BVS artist start",
      detail: "Submit your first release, follow creators and save something you want to come back to.",
    };
  }
  if (role === "producer") {
    return {
      title: "Open your BVS BeatStore path",
      detail: "Add your first beat, follow creators and save something useful for your next session.",
    };
  }
  if (role === "writer" || role === "show_creator") {
    return {
      title: "Finish setting up your BVS creator path",
      detail: "Start your first creator action and give your Feed a few people to remember.",
    };
  }
  return {
    title: "Make BVS yours",
    detail: "Follow 3 creators, save something you like and finish the few steps that make your next visit personal.",
  };
}

export async function runGrowthReactivation(now = new Date(), limit = 40) {
  const newest = new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString();
  const oldest = new Date(now.getTime() - 7 * 86400000).toISOString();
  const rows = await participationRows<GrowthMember>(
    `growth_members?activated_at=is.null&reengagement_sent_at=is.null&joined_at=gte.${encodeURIComponent(oldest)}&joined_at=lte.${encodeURIComponent(newest)}&select=user_id,role,joined_at,last_active_at&order=joined_at.asc&limit=${Math.min(100, Math.max(1, limit * 2))}`,
  );

  const inactivityCutoff = now.getTime() - 18 * 60 * 60 * 1000;
  const candidates = rows.filter((row) => {
    const activity = Date.parse(row.last_active_at || row.joined_at);
    return Number.isFinite(activity) && activity <= inactivityCutoff;
  }).slice(0, Math.max(1, limit));

  const createdNotifications: Notification[] = [];
  let nudged = 0;

  for (const member of candidates) {
    const sourceKey = `activation-nudge:${member.user_id}:v1`;
    const timestamp = now.toISOString();
    let events = await participationInsert<DomainEvent>(
      "participation_domain_events?on_conflict=source_key",
      {
        source_key: sourceKey,
        event_type: "activation_nudge",
        actor_user_id: null,
        occurred_at: timestamp,
        payload: { role: member.role || "listener", version: "v1" },
        fanout_status: "complete",
        processed_at: timestamp,
      },
      "resolution=ignore-duplicates,return=representation",
    );

    if (!events[0]) {
      events = await participationRows<DomainEvent>(
        `participation_domain_events?source_key=eq.${encodeURIComponent(sourceKey)}&select=id,source_key&limit=1`,
      );
    }
    const event = events[0];
    if (!event) continue;

    const copy = copyFor(member.role);
    const inserted = await participationInsert<Notification>(
      "participation_notifications?on_conflict=recipient_user_id,event_id",
      {
        recipient_user_id: member.user_id,
        event_id: event.id,
        category: "community",
        title: copy.title,
        detail: copy.detail,
        target_href: "/start",
        created_at: timestamp,
      },
      "resolution=ignore-duplicates,return=representation",
    );

    await participationPatch(
      `growth_members?user_id=eq.${encodeURIComponent(member.user_id)}&reengagement_sent_at=is.null`,
      { reengagement_sent_at: timestamp, updated_at: timestamp },
    );

    if (inserted[0]) {
      createdNotifications.push(inserted[0]);
      nudged += 1;
    }
  }

  const push = createdNotifications.length
    ? await queueAndDeliverPushForNotifications(createdNotifications)
    : { queued: 0, delivered: { configured: false, scanned: 0, sent: 0, failed: 0, deadLetter: 0 } };

  return {
    scanned: rows.length,
    candidates: candidates.length,
    nudged,
    push,
  };
}
