import "server-only";

import { createHash } from "node:crypto";
import {
  participationInsert,
  participationPatch,
  participationRows,
} from "@/lib/participation-server";

type PreferenceRow = { user_id: string; external_community_enabled: boolean };
type DeviceRow = { user_id: string; device_token: string; platform: "ios" | "android"; app_variant?: string | null };
type NotificationRow = {
  id: string;
  recipient_user_id: string;
  category: string;
  title: string;
  detail: string;
  target_href: string;
  thread_id?: string | null;
  created_at: string;
};
type DeliveryRow = {
  id: string;
  notification_id?: string | null;
  pulse_run_id?: string | null;
  recipient_user_id?: string | null;
  destination_key: string;
  app_identity?: string | null;
  status: string;
  attempts: number;
};

function tokenKey(token: string) {
  return createHash("sha256").update(token).digest("hex").slice(0, 24);
}

export async function queueParticipationPushNotifications(limit = 500) {
  const preferences = await participationRows<PreferenceRow>(
    `participation_preferences?external_community_enabled=eq.true&select=user_id,external_community_enabled&limit=1000`,
  );
  const userIds = preferences.map((row) => row.user_id);
  if (!userIds.length) return { users: 0, notifications: 0, devices: 0 };
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const [notifications, devices] = await Promise.all([
    participationRows<NotificationRow>(
      `participation_notifications?recipient_user_id=in.(${userIds.map(encodeURIComponent).join(",")})&created_at=gte.${encodeURIComponent(since)}&select=id,recipient_user_id,category,title,detail,target_href,thread_id,created_at&order=created_at.desc&limit=${Math.min(2000, Math.max(1, limit))}`,
    ),
    participationRows<DeviceRow>(
      `app_push_devices?user_id=in.(${userIds.map(encodeURIComponent).join(",")})&enabled=eq.true&select=user_id,device_token,platform,app_variant&limit=3000`,
    ),
  ]);
  const devicesByUser = new Map<string, DeviceRow[]>();
  for (const device of devices) devicesByUser.set(device.user_id, [...(devicesByUser.get(device.user_id) || []), device]);
  const rows = notifications.flatMap((notification) => (devicesByUser.get(notification.recipient_user_id) || []).map((device) => ({
    notification_id: notification.id,
    recipient_user_id: notification.recipient_user_id,
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
  })));
  if (rows.length) {
    await participationInsert(
      "participation_deliveries?on_conflict=dedupe_key",
      rows,
      "resolution=ignore-duplicates,return=minimal",
    );
  }
  return { users: userIds.length, notifications: notifications.length, devices: devices.length, queuedCandidates: rows.length };
}

function retryAt(attempt: number) {
  const delayMinutes = Math.min(60, Math.max(2, 2 ** Math.max(1, attempt)));
  return new Date(Date.now() + delayMinutes * 60_000).toISOString();
}

async function notificationFor(delivery: DeliveryRow) {
  if (!delivery.notification_id) return null;
  return (await participationRows<NotificationRow>(
    `participation_notifications?id=eq.${encodeURIComponent(delivery.notification_id)}&select=id,recipient_user_id,category,title,detail,target_href,thread_id,created_at&limit=1`,
  ))[0] || null;
}

export async function deliverParticipationPushQueue(limit = 100) {
  const endpoint = String(process.env.BVS_PUSH_DELIVERY_ENDPOINT || "").trim();
  const secret = String(process.env.BVS_PUSH_DELIVERY_SECRET || "").trim();
  if (!endpoint || !secret) return { configured: false, scanned: 0, sent: 0, failed: 0, deadLetter: 0 };

  const now = new Date().toISOString();
  await participationPatch(
    `participation_deliveries?channel=eq.push&status=eq.processing&lease_until=lt.${encodeURIComponent(now)}`,
    { status: "failed", error_class: "lease_expired", last_error: "Delivery lease expired before completion.", updated_at: now },
  );
  const deliveries = await participationRows<DeliveryRow>(
    `participation_deliveries?channel=eq.push&status=in.(queued,failed,ambiguous)&attempts=lt.5&scheduled_at=lte.${encodeURIComponent(now)}&select=id,notification_id,pulse_run_id,recipient_user_id,destination_key,app_identity,status,attempts&order=scheduled_at.asc&limit=${Math.min(250, Math.max(1, limit))}`,
  );
  let sent = 0;
  let failed = 0;
  let deadLetter = 0;

  for (const delivery of deliveries) {
    const attempt = Number(delivery.attempts || 0) + 1;
    const leaseUntil = new Date(Date.now() + 2 * 60_000).toISOString();
    const claimed = await participationPatch<DeliveryRow>(
      `participation_deliveries?id=eq.${encodeURIComponent(delivery.id)}&status=in.(queued,failed,ambiguous)&attempts=eq.${delivery.attempts}`,
      { status: "processing", attempts: attempt, lease_until: leaseUntil, updated_at: new Date().toISOString() },
    );
    if (!claimed[0]) continue;
    const notification = await notificationFor(delivery);
    if (!notification) {
      await participationPatch(`participation_deliveries?id=eq.${encodeURIComponent(delivery.id)}`, {
        status: "dead_letter",
        error_class: "missing_notification",
        last_error: "Notification payload no longer exists.",
        lease_until: null,
        updated_at: new Date().toISOString(),
      });
      deadLetter += 1;
      continue;
    }

    const [platform = "unknown", appVariant = "vnext"] = String(delivery.app_identity || "unknown:vnext").split(":", 2);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
        body: JSON.stringify({
          token: delivery.destination_key,
          platform,
          appVariant,
          notification: {
            title: notification.title,
            body: notification.detail,
            category: notification.category,
            threadId: notification.thread_id || null,
            href: notification.target_href,
          },
        }),
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      });
      const providerBody = await response.json().catch(() => ({})) as { receipt?: string; id?: string; error?: string };
      if (response.ok) {
        await participationPatch(`participation_deliveries?id=eq.${encodeURIComponent(delivery.id)}`, {
          status: "sent",
          provider_receipt: String(providerBody.receipt || providerBody.id || "accepted").slice(0, 500),
          error_class: null,
          last_error: null,
          lease_until: null,
          updated_at: new Date().toISOString(),
        });
        sent += 1;
        continue;
      }
      const terminal = response.status === 400 || response.status === 404 || response.status === 410 || attempt >= 5;
      await participationPatch(`participation_deliveries?id=eq.${encodeURIComponent(delivery.id)}`, {
        status: terminal ? "dead_letter" : "failed",
        error_class: `provider_${response.status}`,
        last_error: String(providerBody.error || `Push provider returned HTTP ${response.status}.`).slice(0, 500),
        lease_until: null,
        scheduled_at: terminal ? now : retryAt(attempt),
        updated_at: new Date().toISOString(),
      });
      if (terminal) deadLetter += 1;
      else failed += 1;
    } catch (error) {
      const terminal = attempt >= 5;
      await participationPatch(`participation_deliveries?id=eq.${encodeURIComponent(delivery.id)}`, {
        status: terminal ? "dead_letter" : "ambiguous",
        error_class: "provider_transport",
        last_error: error instanceof Error ? error.message.slice(0, 500) : "Push provider request failed.",
        lease_until: null,
        scheduled_at: terminal ? now : retryAt(attempt),
        updated_at: new Date().toISOString(),
      });
      if (terminal) deadLetter += 1;
      else failed += 1;
    }
  }
  return { configured: true, scanned: deliveries.length, sent, failed, deadLetter };
}
