import "server-only";

import { createPrivateKey, sign } from "node:crypto";
import { connect } from "node:http2";

type ApnsNotification = {
  token: string;
  title: string;
  body: string;
  href: string;
  category?: string | null;
  threadId?: string | null;
};

export type ApnsResult = {
  ok: boolean;
  status: number;
  receipt?: string;
  error?: string;
  terminal: boolean;
};

let cachedToken: { value: string; createdAt: number } | null = null;

function base64Url(value: Buffer | string) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buffer.toString("base64url");
}

function keyMaterial() {
  return String(process.env.BVS_APNS_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
}

export function apnsConfigured() {
  return Boolean(
    String(process.env.BVS_APNS_KEY_ID || "").trim()
    && String(process.env.BVS_APNS_TEAM_ID || "").trim()
    && keyMaterial(),
  );
}

function providerToken() {
  if (cachedToken && Date.now() - cachedToken.createdAt < 45 * 60_000) return cachedToken.value;
  const keyId = String(process.env.BVS_APNS_KEY_ID || "").trim();
  const teamId = String(process.env.BVS_APNS_TEAM_ID || "").trim();
  const privateKey = keyMaterial();
  if (!keyId || !teamId || !privateKey) throw new Error("APNs credentials are not configured.");

  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = base64Url(JSON.stringify({ iss: teamId, iat: issuedAt }));
  const unsigned = `${header}.${claims}`;
  const signature = sign("sha256", Buffer.from(unsigned), {
    key: createPrivateKey(privateKey),
    dsaEncoding: "ieee-p1363",
  });
  const value = `${unsigned}.${base64Url(signature)}`;
  cachedToken = { value, createdAt: Date.now() };
  return value;
}

function terminalStatus(status: number) {
  return status === 400 || status === 403 || status === 404 || status === 405 || status === 410 || status === 413;
}

export async function sendApnsPush(notification: ApnsNotification): Promise<ApnsResult> {
  if (!apnsConfigured()) return { ok: false, status: 0, error: "APNs is not configured.", terminal: false };
  const token = notification.token.trim();
  if (!/^[0-9a-f]{32,}$/i.test(token)) return { ok: false, status: 400, error: "BadDeviceToken", terminal: true };

  const production = String(process.env.BVS_APNS_ENV || "production").toLowerCase() !== "development";
  const authority = production ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com";
  const topic = String(process.env.BVS_APNS_TOPIC || "com.bvsradio.app").trim() || "com.bvsradio.app";
  const payload = JSON.stringify({
    aps: {
      alert: { title: notification.title.slice(0, 120), body: notification.body.slice(0, 500) },
      sound: "default",
      ...(notification.threadId ? { "thread-id": notification.threadId } : {}),
      ...(notification.category ? { category: notification.category } : {}),
    },
    href: notification.href,
    category: notification.category || null,
    threadId: notification.threadId || null,
  });

  return await new Promise<ApnsResult>((resolve) => {
    const client = connect(authority);
    let settled = false;
    let responseStatus = 0;
    let receipt = "";
    let responseBody = "";
    const finish = (result: ApnsResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try { client.close(); } catch {}
      resolve(result);
    };
    const timeout = setTimeout(() => {
      try { client.destroy(); } catch {}
      finish({ ok: false, status: 0, error: "APNs request timed out.", terminal: false });
    }, 8_000);

    client.on("error", (error) => finish({ ok: false, status: 0, error: error.message, terminal: false }));

    let request;
    try {
      request = client.request({
        ":method": "POST",
        ":path": `/3/device/${token}`,
        authorization: `bearer ${providerToken()}`,
        "apns-topic": topic,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-expiration": "0",
        "content-type": "application/json",
      });
    } catch (error) {
      finish({ ok: false, status: 0, error: error instanceof Error ? error.message : "Could not create APNs request.", terminal: false });
      return;
    }

    request.setEncoding("utf8");
    request.on("response", (headers) => {
      responseStatus = Number(headers[":status"] || 0);
      receipt = String(headers["apns-id"] || "");
    });
    request.on("data", (chunk) => { responseBody += String(chunk); });
    request.on("error", (error) => finish({ ok: false, status: responseStatus, error: error.message, terminal: terminalStatus(responseStatus) }));
    request.on("end", () => {
      if (responseStatus >= 200 && responseStatus < 300) {
        finish({ ok: true, status: responseStatus, receipt: receipt || "accepted", terminal: false });
        return;
      }
      let reason = "Apple Push rejected the notification.";
      try {
        const parsed = JSON.parse(responseBody) as { reason?: string };
        if (parsed.reason) reason = parsed.reason;
      } catch {}
      finish({ ok: false, status: responseStatus, receipt: receipt || undefined, error: reason, terminal: terminalStatus(responseStatus) });
    });
    request.end(payload);
  });
}
