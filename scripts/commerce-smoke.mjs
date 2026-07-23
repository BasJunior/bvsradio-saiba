#!/usr/bin/env node
/**
 * Commerce smoke: checkout config + create local order + verify download token gate.
 * Does not charge real money. Uses production URL or BVS_SMOKE_BASE.
 */
import { createHmac, randomUUID } from "crypto";

const base = process.env.BVS_SMOKE_BASE || "https://bvsradio.com";

async function main() {
  const out = { base, steps: [] };
  const cfgRes = await fetch(`${base}/api/checkout/config`, { cache: "no-store" });
  const cfg = await cfgRes.json().catch(() => ({}));
  out.steps.push({
    step: "checkout_config",
    ok: cfgRes.ok,
    status: cfgRes.status,
    keys: Object.keys(cfg || {}),
  });

  const orderBody = {
    customer: {
      name: "BVS Sprint Smoke",
      email: "smoke-sprint@bvsradio.local",
      phone: "+491700000000",
      country: "DE",
    },
    items: [
      {
        id: "smoke-single",
        title: "Sprint smoke item",
        type: "single",
        price: 2,
        quantity: 1,
      },
    ],
    paymentMethod: "whatsapp",
    countryCode: "DE",
  };

  const orderRes = await fetch(`${base}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderBody),
  });
  const orderJson = await orderRes.json().catch(() => ({}));
  out.steps.push({
    step: "create_order",
    ok: orderRes.ok,
    status: orderRes.status,
    reference: orderJson.reference || orderJson.order?.reference || null,
    saved: orderJson.saved,
    error: orderJson.error || null,
  });

  // Download without paid status must fail closed
  const token = "invalid-token";
  const dlRes = await fetch(`${base}/api/download?token=${token}`, { cache: "no-store" });
  out.steps.push({
    step: "download_reject_invalid",
    ok: dlRes.status === 403 || dlRes.status === 400,
    status: dlRes.status,
  });

  const failed = out.steps.filter((s) => !s.ok);
  out.ok = failed.length === 0;
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err) }));
  process.exit(1);
});
