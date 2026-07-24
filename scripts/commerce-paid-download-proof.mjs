#!/usr/bin/env node
/**
 * Sprint 1 #5 proof: create order → mark paid (Supabase) → download bytes.
 * Does not charge money. Uses service role from env (never prints secrets).
 *
 * Required env (from .env.vercel.runtime or export):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   BVS_DOWNLOAD_SECRET or PAYNOW_INTEGRATION_KEY (must match Vercel)
 * Optional:
 *   BVS_SMOKE_BASE (default https://bvsradio.com)
 */
import { createHmac } from "crypto";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvFile(p) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.vercel.runtime"));
loadEnvFile(resolve(process.cwd(), ".env.local"));

const base = process.env.BVS_SMOKE_BASE || "https://bvsradio.com";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tokenSecret =
  process.env.BVS_DOWNLOAD_SECRET ||
  process.env.PAYNOW_INTEGRATION_KEY ||
  "bvs-dev-download-secret-change-me";

function createDownloadToken(reference, itemId, ttlSec = 72 * 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${reference}:${itemId}:${exp}`;
  const sig = createHmac("sha256", tokenSecret).update(payload).digest("hex").slice(0, 32);
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

async function main() {
  const out = { base, steps: [], ok: false };
  if (!supabaseUrl || !serviceKey) {
    out.error = "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY";
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  }

  // Use a real public catalogue title so Vercel can resolve public/music file
  const item = {
    id: "4-love-smoke",
    title: "4 love",
    type: "single",
    price: 2,
    quantity: 1,
  };

  const orderBody = {
    customer: {
      name: "BVS Paid Download Proof",
      email: "paid-proof@bvsradio.local",
      phone: "+491700000001",
      country: "DE",
    },
    items: [item],
    paymentMethod: "whatsapp",
    countryCode: "DE",
  };

  const orderRes = await fetch(`${base}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderBody),
  });
  const orderJson = await orderRes.json().catch(() => ({}));
  const reference = orderJson.reference || null;
  out.steps.push({
    step: "create_order",
    ok: orderRes.ok && Boolean(reference),
    status: orderRes.status,
    reference,
    savedSupabase: orderJson.savedSupabase,
    error: orderJson.error || null,
  });
  if (!reference) {
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  }

  // Mark paid in Supabase (simulates successful Stripe/Paynow webhook)
  const patchRes = await fetch(
    `${supabaseUrl}/rest/v1/orders?reference=eq.${encodeURIComponent(reference)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        status: "paid",
        delivery_status: "paid_processing",
        updated_at: new Date().toISOString(),
      }),
    },
  );
  const patchBody = await patchRes.json().catch(() => []);
  const patched = Array.isArray(patchBody) && patchBody.length > 0;
  out.steps.push({
    step: "mark_paid_supabase",
    ok: patchRes.ok && patched,
    status: patchRes.status,
    rows: Array.isArray(patchBody) ? patchBody.length : 0,
  });

  // Pending token must not download (use unpaid ref clone via invalid status path already covered)
  const unpaidToken = createDownloadToken(`${reference}-unpaid`, String(item.id));
  const unpaidDl = await fetch(`${base}/api/download?token=${unpaidToken}`, { cache: "no-store" });
  out.steps.push({
    step: "download_reject_unknown_order",
    ok: unpaidDl.status === 402 || unpaidDl.status === 403 || unpaidDl.status === 404,
    status: unpaidDl.status,
  });

  const token = createDownloadToken(reference, String(item.id));
  const dlRes = await fetch(`${base}/api/download?token=${token}`, { cache: "no-store" });
  const ct = dlRes.headers.get("content-type") || "";
  const cl = Number(dlRes.headers.get("content-length") || 0);
  const buf = Buffer.from(await dlRes.arrayBuffer());
  const looksAudio =
    dlRes.ok &&
    buf.length > 10000 &&
    (ct.includes("octet-stream") || ct.includes("audio") || ct.includes("mpeg"));
  out.steps.push({
    step: "download_paid_file",
    ok: looksAudio,
    status: dlRes.status,
    contentType: ct,
    bytes: buf.length,
    contentLengthHeader: cl || null,
  });

  out.ok = out.steps.every((s) => s.ok);
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err) }));
  process.exit(1);
});
