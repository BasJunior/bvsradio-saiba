#!/usr/bin/env node
import process from "node:process";

const PROD_SUPABASE_REF = "rdwwyolrxahimcgpkzzy";
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "R2_ENDPOINT",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
];

const missing = required.filter((key) => !String(process.env[key] || "").trim());
const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
const lane = String(process.env.BVS_ENV_LANE || "").toLowerCase();
const site = String(process.env.NEXT_PUBLIC_SITE_URL || "");
const bucket = String(process.env.R2_BUCKET || "");
const mediaPrefix = String(process.env.R2_KEY_PREFIX || "").replace(/^\/+|\/+$/g, "");
const errors = [];

if (lane !== "staging") errors.push("BVS_ENV_LANE must be staging");
if (!site.includes("bvsradio-beta.vercel.app")) errors.push("NEXT_PUBLIC_SITE_URL must be the beta Vercel alias");
if (url.includes(PROD_SUPABASE_REF)) errors.push("beta points at the production Supabase project");
if (!/beta/i.test(bucket) && !/^beta(?:\/|$)/i.test(mediaPrefix)) errors.push("shared R2 buckets require an explicit beta/ key prefix");
if (missing.length) errors.push(`missing: ${missing.join(", ")}`);

const stripe = String(process.env.STRIPE_SECRET_KEY || "");
if (stripe && !stripe.startsWith("sk_test_")) errors.push("Stripe key is not a test key");
if (String(process.env.ECOCASH_MODE || "sandbox").toLowerCase() === "live") errors.push("EcoCash is set to live");
if (String(process.env.BVS_STAGING_SHARES_PROD_SUPABASE || "").toLowerCase() === "true") errors.push("shared production Supabase marker is enabled");

console.log(JSON.stringify({
  ok: errors.length === 0,
  lane,
  siteOk: site.includes("bvsradio-beta.vercel.app"),
  isolatedSupabase: Boolean(url) && !url.includes(PROD_SUPABASE_REF),
  isolatedMedia: Boolean(bucket) && (/beta/i.test(bucket) || /^beta(?:\/|$)/i.test(mediaPrefix)),
  payments: stripe ? "stripe-test" : "disabled",
  errors,
}, null, 2));

process.exit(errors.length ? 1 : 0);
