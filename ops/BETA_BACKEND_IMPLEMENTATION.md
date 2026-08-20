# BVS Radio Beta backend implementation

The beta web alias is `https://bvsradio-beta.vercel.app`. Production remains locked.

## Required isolation

- A separate Supabase project named `bvsradio-beta`
- Prefer a separate R2 bucket named `bvsradio-beta-media`. If Cloudflare
  management access is unavailable, use the existing scoped bucket only with
  mandatory `R2_KEY_PREFIX=beta`; logical database paths remain unchanged.
- Stripe test keys only; Paynow/EcoCash sandbox only
- `BVS_ENV_LANE=staging`
- Never set `BVS_STAGING_SHARES_PROD_SUPABASE=true`

## Agent sequence after project credentials exist

1. Store beta `DATABASE_URL` in `~/.openclaw/secrets/bvs-supabase-beta-db.env`.
2. Export the beta URL, publishable key and service-role key only in the trusted shell.
3. Run `npm run beta:preflight` — it must pass before any seed or test.
4. Apply SQL packs with `DATABASE_URL` pointing at beta:
   `python3 scripts/apply-supabase-packs.py --apply-missing --yes`.
5. Run `python3 scripts/verify-supabase-schema.py --full`.
6. Set Supabase Auth Site URL to the beta alias and allow:
   `/auth/confirmed`, `/auth/reset-password`, `/auth/qr/approve`.
7. Run `npm run beta:seed` with a strong `BVS_BETA_DEMO_PASSWORD`.
8. Run the smoke suite and only then install the native Beta app.

The seed tool refuses the known production Supabase project reference.
