import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export async function readSignedJson(request: Request) {
  const raw = await request.text();
  const secret = process.env.BVS_LIVE_HOOK_SECRET || "";
  if (!secret) return { ok: false as const, error: "Live hook secret is not configured." };

  const signature = request.headers.get("x-bvs-signature") || "";
  const timestamp = request.headers.get("x-bvs-timestamp") || "";
  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() - sentAt) > 5 * 60 * 1000) {
    return { ok: false as const, error: "Invalid or stale live hook timestamp." };
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${raw}`)
    .digest("hex");
  const a = Buffer.from(signature.replace(/^sha256=/, ""), "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false as const, error: "Invalid live hook signature." };
  }

  return {
    ok: true as const,
    body: JSON.parse(raw || "{}") as Record<string, unknown>,
  };
}

export function clean(value: unknown, max = 1000) {
  return String(value || "").trim().slice(0, max);
}
