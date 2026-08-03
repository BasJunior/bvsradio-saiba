#!/usr/bin/env node
/**
 * CLI sandbox tester for EcoCash C2B API.
 *
 * Usage:
 *   export ECOCASH_API_KEY=your-sandbox-key
 *   export ECOCASH_MODE=sandbox
 *   node scripts/test-ecocash-sandbox.mjs config
 *   node scripts/test-ecocash-sandbox.mjs pay 0771234567 1 USD "Test payment"
 *   node scripts/test-ecocash-sandbox.mjs lookup 0771234567 YOUR-REF
 *
 * Or hit local Next route after `npm run dev`:
 *   curl -s http://localhost:3000/api/payments/ecocash/sandbox
 */

const BASE = "https://developers.ecocash.co.zw/api/ecocash_pay";
const PATHS = {
  payment: {
    sandbox: `${BASE}/api/v2/payment/instant/c2b/sandbox`,
    live: `${BASE}/api/v2/payment/instant/c2b/live`,
  },
  lookup: {
    sandbox: `${BASE}/api/v1/transaction/c2b/status/sandbox`,
    live: `${BASE}/api/v1/transaction/c2b/status/live`,
  },
};

function mode() {
  return (process.env.ECOCASH_MODE || "sandbox").toLowerCase() === "live" ? "live" : "sandbox";
}

function normalizeMsisdn(input) {
  const digits = String(input || "").replace(/\D/g, "");
  if (digits.startsWith("263") && digits.length >= 12) return digits;
  if (digits.startsWith("07") && digits.length === 10) return `263${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 9) return `263${digits}`;
  return null;
}

function buildHeaders() {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const apiKey = process.env.ECOCASH_API_KEY;
  if (apiKey) headers["X-API-KEY"] = apiKey;

  const user = process.env.ECOCASH_BASIC_USER;
  const pass = process.env.ECOCASH_BASIC_PASSWORD;
  if (user && pass) {
    headers.Authorization = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
  }

  if (!apiKey && !(user && pass)) {
    console.error(
      "Missing credentials. Set ECOCASH_API_KEY and/or ECOCASH_BASIC_USER + ECOCASH_BASIC_PASSWORD",
    );
    process.exit(1);
  }
  return headers;
}

async function post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  console.log("HTTP", res.status);
  console.log(JSON.stringify(data, null, 2));
  process.exit(res.ok ? 0 : 1);
}

const [action, a, b, c, d] = process.argv.slice(2);
const m = mode();

if (!action || action === "config" || action === "help") {
  console.log(
    JSON.stringify(
      {
        mode: m,
        hasApiKey: Boolean(process.env.ECOCASH_API_KEY),
        hasBasicAuth: Boolean(
          process.env.ECOCASH_BASIC_USER && process.env.ECOCASH_BASIC_PASSWORD,
        ),
        paymentUrl: PATHS.payment[m],
        lookupUrl: PATHS.lookup[m],
        portal: "https://developers.ecocash.co.zw",
        portalLogin: "https://developers.ecocash.co.zw/portal",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (action === "pay") {
  const msisdn = normalizeMsisdn(a);
  if (!msisdn) {
    console.error("Usage: pay <07xxxxxxxx> <amount> [currency] [reason]");
    process.exit(1);
  }
  const amount = Number(b);
  const currency = (c || "USD").toUpperCase();
  const reason = d || "BVS Radio EcoCash sandbox test";
  const sourceReference = `BVS-SBX-${Date.now()}`;
  console.error("Sending payment…", { msisdn, amount, currency, sourceReference });
  await post(PATHS.payment[m], {
    customerMsisdn: msisdn,
    amount,
    reason,
    currency,
    sourceReference,
  });
}

if (action === "lookup") {
  const msisdn = normalizeMsisdn(a);
  const reference = b;
  if (!msisdn || !reference) {
    console.error("Usage: lookup <07xxxxxxxx> <sourceReference>");
    process.exit(1);
  }
  await post(PATHS.lookup[m], {
    sourceMobileNumber: msisdn,
    sourceReference: reference,
  });
}

console.error("Unknown action. Use: config | pay | lookup");
process.exit(1);
