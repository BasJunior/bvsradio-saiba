import "server-only";

import { createHash } from "node:crypto";
import {
  participationInsert,
  participationPatch,
  participationRows,
} from "@/lib/participation-server";

import { notificationEligible } from "@/lib/participation-delivery-policy";

type PreferenceRow = {
  user_id: string;
  external_community_enabled: boolean;
  digest_enabled: boolean;
  digest_time: string;
  timezone: string;
  quiet_start?: string | null;
  quiet_end?: string | null;
};

type PulseRun = {
  id: string;
  user_id?: string;
  recipient_user_id?: string | null;
  recipient_key: string;
  local_date: string;
  state: string;
  window_start: string;
  window_end: string;
  updated_at: string;
};

type NotificationRow = {
  id: string;
  recipient_user_id: string;
  thread_id?: string | null;
  message_id?: string | null;
  event_id?: string | null;
  pulse_run_id?: string | null;
  category: string;
  title: string;
  detail: string;
  target_href: string;
  created_at: string;
};

type PushDevice = {
  user_id: string;
  device_token: string;
  platform: "ios" | "android";
  app_variant?: string | null;
};

function timeText(value: string | null | undefined) {
  return String(value || "00:00").slice(0, 5);
}

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function localClock(now: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(formatter.formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

function inQuietHours(current: string, start?: string | null, end?: string | null) {
  if (!start || !end) return false;
  const now = minutes(current);
  const from = minutes(timeText(start));
  const to = minutes(timeText(end));
  if (from === to) return false;
  return from < to ? now >= from && now < to : now >= from || now < to;
}

function summaryText(rows: NotificationRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.category, (counts.get(row.category) || 0) + 1);
  const labels: Record<string, string> = {
    reply: "replies",
    mention: "mentions",
    like: "likes",
    repost: "reposts",
    follow: "follows",
    community: "community updates",
    moderation: "moderation updates",
  };
  const parts = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([kind, count]) => `${count} ${labels[kind] || kind}`);
  return parts.length ? `${parts.join(" · ")}. Open BVS to catch up.` : "Your BVS community has new activity.";
}

function tokenKey(token: string) {
  return createHash("sha256").update(token).digest("hex").slice(0, 24);
}

async function beginRun(preference: PreferenceRow, localDate: string, now: Date) {
  const existing = await participationRows<PulseRun>(
    `participation_pulse_runs?run_type=eq.user_digest&recipient_key=eq.${encodeURIComponent(preference.user_id)}&local_date=eq.${encodeURIComponent(localDate)}&select=id,recipient_user_id,recipient_key,local_date,state,window_start,window_end,updated_at&limit=1`,
  );
  if (existing[0]) {
    const previous = existing[0];
    if (previous.state !== "failed" && !(previous.state === "processing" && Date.parse(previous.updated_at) < now.getTime() - 120_000)) return null;
    const claimed = await participationPatch<PulseRun>(`participation_pulse_runs?id=eq.${previous.id}&state=eq.${previous.state}&updated_at=eq.${encodeURIComponent(previous.updated_at)}`, { state: "processing", updated_at: now.toISOString() });
    return claimed[0] ? { ...claimed[0], windowStart: previous.window_start, windowEnd: previous.window_end } : null;
  }
  const windowEnd = now.toISOString();
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const rows = await participationInsert<PulseRun>(
    "participation_pulse_runs?on_conflict=run_type,recipient_key,local_date",
    {
      run_type: "user_digest",
      recipient_key: preference.user_id,
      recipient_user_id: preference.user_id,
      local_date: localDate,
      timezone: preference.timezone,
      window_start: windowStart,
      window_end: windowEnd,
      state: "processing",
      checkpoint: { phase: "aggregate" },
      summary: {},
      created_at: windowEnd,
      updated_at: windowEnd,
    },
    "resolution=ignore-duplicates,return=representation",
  );
  return rows[0] ? { ...rows[0], windowStart, windowEnd } : null;
}

async function queuePushForNotification(notification: NotificationRow, preference: PreferenceRow) {
  if (!preference.external_community_enabled) return 0;
  const devices = await participationRows<PushDevice>(
    `app_push_devices?user_id=eq.${encodeURIComponent(preference.user_id)}&enabled=eq.true&select=user_id,device_token,platform,app_variant&limit=20`,
  );
  if (!devices.length) return 0;
  await participationInsert(
    "participation_deliveries?on_conflict=dedupe_key",
    devices.map((device) => ({
      notification_id: notification.id,
      pulse_run_id: notification.pulse_run_id || null,
      recipient_user_id: preference.user_id,
      channel: "push",
      destination_key: device.device_token,
      provider: "bvs-native",
      app_identity: `${device.platform}:${device.app_variant || "vnext"}`,
      scheduled_at: new Date().toISOString(),
      status: "queued",
      attempts: 0,
      dedupe_key: `push:${notification.id}:${tokenKey(device.device_token)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })),
    "resolution=ignore-duplicates,return=minimal",
  );
  return devices.length;
}

async function runDigest(preference: PreferenceRow, now: Date) {
  let clock: { date: string; time: string };
  try {
    clock = localClock(now, preference.timezone || "UTC");
  } catch {
    return { status: "invalid_timezone" as const, notifications: 0 };
  }
  if (minutes(clock.time) < minutes(timeText(preference.digest_time))) return { status: "not_due" as const, notifications: 0 };
  if (inQuietHours(clock.time, preference.quiet_start, preference.quiet_end)) return { status: "quiet_hours" as const, notifications: 0 };

  const run = await beginRun(preference, clock.date, now);
  if (!run) return { status: "already_ran" as const, notifications: 0 };
  try {
    const candidates = await participationRows<NotificationRow>(
      `participation_notifications?recipient_user_id=eq.${encodeURIComponent(preference.user_id)}&read_at=is.null&seen_at=is.null&event_id=not.is.null&created_at=gte.${encodeURIComponent(run.windowStart)}&created_at=lt.${encodeURIComponent(run.windowEnd)}&select=id,recipient_user_id,event_id,thread_id,message_id,pulse_run_id,category,title,detail,target_href,created_at&order=created_at.desc&limit=250`,
    );
    const eligibility = await Promise.all(candidates.map(row => notificationEligible(row)));
    const activity = candidates.filter((_, index) => eligibility[index]);
    if (!activity.length) {
      await participationPatch<PulseRun>(`participation_pulse_runs?id=eq.${encodeURIComponent(run.id)}`, {
        state: "skipped",
        checkpoint: { phase: "complete", reason: "no_activity" },
        summary: { eventCount: 0 },
        updated_at: now.toISOString(),
      });
      return { status: "skipped" as const, notifications: 0 };
    }

    const detail = summaryText(activity);
    const created = await participationInsert<NotificationRow>("participation_notifications?on_conflict=recipient_user_id,pulse_run_id", {
      recipient_user_id: preference.user_id,
      event_id: null,
      pulse_run_id: run.id,
      category: "community",
      title: `Your BVS Pulse · ${activity.length} ${activity.length === 1 ? "update" : "updates"}`,
      detail,
      target_href: "/participation/feed",
      created_at: now.toISOString(),
    }, "resolution=ignore-duplicates,return=representation");
    const pulseNotification = created[0] || (await participationRows<NotificationRow>(
      `participation_notifications?recipient_user_id=eq.${encodeURIComponent(preference.user_id)}&pulse_run_id=eq.${encodeURIComponent(run.id)}&select=id,recipient_user_id,event_id,thread_id,message_id,pulse_run_id,category,title,detail,target_href,created_at&limit=1`,
    ))[0];
    if (!pulseNotification) throw new Error("pulse notification persistence failed");

    await participationInsert(
      "participation_deliveries?on_conflict=dedupe_key",
      {
        notification_id: pulseNotification.id,
        pulse_run_id: run.id,
        recipient_user_id: preference.user_id,
        channel: "in_app",
        destination_key: preference.user_id,
        provider: "bvs",
        scheduled_at: now.toISOString(),
        status: "sent",
        attempts: 1,
        dedupe_key: `pulse-inbox:${run.id}`,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      "resolution=ignore-duplicates,return=minimal",
    );
    const queuedPush = await queuePushForNotification(pulseNotification, preference);
    await participationPatch<PulseRun>(`participation_pulse_runs?id=eq.${encodeURIComponent(run.id)}`, {
      state: "sent",
      checkpoint: { phase: "complete", inbox: true, queuedPush },
      summary: {
        eventCount: activity.length,
        categories: Object.fromEntries([...new Set(activity.map((item) => item.category))].map((category) => [category, activity.filter((item) => item.category === category).length])),
      },
      delivery_receipt: pulseNotification.id,
      updated_at: now.toISOString(),
    });
    return { status: "sent" as const, notifications: 1, queuedPush };
  } catch (error) {
    await participationPatch<PulseRun>(`participation_pulse_runs?id=eq.${encodeURIComponent(run.id)}`, {
      state: "failed",
      last_error: error instanceof Error ? error.message.slice(0, 500) : "daily pulse failed",
      checkpoint: { phase: "failed" },
      updated_at: now.toISOString(),
    });
    return { status: "failed" as const, notifications: 0 };
  }
}

export async function runParticipationDigests(now = new Date(), limit = 300) {
  const preferences: PreferenceRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const batch = await participationRows<PreferenceRow>(
    `participation_preferences?digest_enabled=eq.true&select=user_id,external_community_enabled,digest_enabled,digest_time,timezone,quiet_start,quiet_end&order=user_id.asc&limit=500&offset=${offset}`,
  );
    preferences.push(...batch);
    if (batch.length < 500) break;
  }
  void limit;
  const counts: Record<string, number> = {};
  let notifications = 0;
  let queuedPush = 0;
  for (const preference of preferences) {
    const result = await runDigest(preference, now);
    counts[result.status] = (counts[result.status] || 0) + 1;
    notifications += result.notifications || 0;
    queuedPush += "queuedPush" in result ? Number(result.queuedPush) || 0 : 0;
  }
  return { scanned: preferences.length, counts, notifications, queuedPush };
}
