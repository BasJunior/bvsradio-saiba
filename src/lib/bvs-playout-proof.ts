import { createHmac, timingSafeEqual } from "node:crypto";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type PlayoutStarted = { eventId: string; stationId: string; trackId: string; startedAt: string };
export function verifyPlayoutSignature(raw: string, timestamp: string, signature: string, secret: string, now = Date.now()) {
  if (secret.length < 32 || !/^\d{13}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  if (Math.abs(now - Number(timestamp)) > 300_000) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export function parsePlayoutStarted(value: unknown, stationId: string, now = Date.now()): PlayoutStarted | null {
  if (!value || typeof value !== "object" || !stationId) return null;
  const v = value as Record<string, unknown>;
  if (v.stationId !== stationId || typeof v.eventId !== "string" || !/^[\w.:-]{1,128}$/.test(v.eventId) ||
      typeof v.trackId !== "string" || !UUID.test(v.trackId) || typeof v.startedAt !== "string") return null;
  const time = Date.parse(v.startedAt);
  if (!Number.isFinite(time) || time > now + 5000 || time < now - 7 * 86_400_000) return null;
  return { eventId: v.eventId, stationId, trackId: v.trackId, startedAt: new Date(time).toISOString() };
}
