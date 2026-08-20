# Grok Build handoff — 2026-08-20 20:22 Berlin

Telegram agent was on this work (context overflow + heredoc syntax errors). Grok Build closed the remaining ZVSJQ hole. **Do not revert subscribe order.**

## Done on `saiba/bvs-radio-beta-shell` (uncommitted, tsc clean)

1. **Subscribe fail-closed, save-first** (`src/app/api/artist/premium/subscribe/route.ts`)
   - `saveOrderToSupabase` is checked for `{saved}` (it does **not** throw).
   - Durable order is saved **before** `paynow.send()`.
   - If save fails → 500, no Paynow payment created.
2. **Webhook** (`src/app/api/webhooks/paynow/route.ts`)
   - Missing `BVS-PREM-*` + trusted paid poll → recover row (Telegram wrote this).
   - If still missing after recovery → **503 retry**, not 404 (404 dropped ZVSJQ).
3. Telegram already wired Premium → `distribution_jobs` eligible + internal `amuse_pilot` (public UI stays partner-anonymous).

## Do not

- Deploy `bvsradio/` / production while Apple Review is open.
- Name Amuse on public/artist marketing copy.
- Trample dirty `bvsradio/` main WIP.

## Still Telegram’s to finish

- Seed/demo path if still planned
- Commit + **beta-only** promote
- Do **not** activate CalmBeast again unless Abias asks (data backfill already done 2026-08-18)

Runbook: `bvsradio/ops/finance/PAYNOW_PREMIUM_ZVSJQ_AFTER_REVIEW.md`
