# VPS Handoff — Canonical Standalone Beta Deploy

This handoff is only for the standalone Vercel project `bvsradio-beta`.

## Expected source
- Branch: `saiba/beta-premium-royalty-share-2026-08-26`
- Expected SHA: `09e6a361a16a0c362a11b25205c114b7a12bd3ea`
- Beta Vercel project ID: `prj_gv9stqkz190faX23mT3dy3wWStEo`
- Production Vercel project ID that must **never** be targeted by this procedure: `prj_jdey5oej8CGAROfdPK2f5frnq2YK`
- Expected beta Supabase ref: `kuqdhuomcqonhnwfgrlw`
- Production Supabase ref that must never appear in beta preflight: `rdwwyolrxahimcgpkzzy`

## Safe procedure
Use an isolated clean worktree/checkout; do not relink the normal production checkout.

```bash
set -euo pipefail

# From the existing repository clone:
git fetch origin --prune
EXPECTED_SHA=09e6a361a16a0c362a11b25205c114b7a12bd3ea
DEPLOY_DIR="../bvsradio-beta-deploy-${EXPECTED_SHA:0:8}"
rm -rf "$DEPLOY_DIR"
git worktree add --detach "$DEPLOY_DIR" "$EXPECTED_SHA"
cd "$DEPLOY_DIR"

test "$(git rev-parse HEAD)" = "$EXPECTED_SHA"
test -z "$(git status --porcelain)"

# Link only this isolated checkout to the beta Vercel project.
npx vercel link --yes --project bvsradio-beta --scope saiba-bvs

# The repo guard must identify the exact beta project and refuse production.
npm run deploy:beta:guard

# Pull beta project env into a temporary local file only for staging preflight.
npx vercel env pull .env.beta.deploy.local --environment=production --yes --scope saiba-bvs
node --env-file=.env.beta.deploy.local scripts/beta-staging-preflight.mjs
rm -f .env.beta.deploy.local

# Canonical beta alias is the production target of the isolated bvsradio-beta project.
npx vercel --prod --yes --scope saiba-bvs
```

## Required post-deploy checks

```bash
curl -fsS https://bvsradio-beta.vercel.app/api/build
curl -fsS https://bvsradio-beta.vercel.app/api/beta/config
curl -fsS https://bvsradio-beta.vercel.app/api/station/tracks
curl -fsS 'https://bvsradio-beta.vercel.app/api/station/tracks?surface=ios'
```

Accept only if:
- `/api/build` reports SHA beginning `09e6a361...` and env `staging`;
- `/api/beta/config` reports effective `beta/staging` and `productionLocked=false`;
- web station remains the intentionally tiny beta dataset unless separately staged;
- `surface=ios` remains fail-closed (currently expected count `0`);
- no production domain/project/Supabase identifiers appear as the beta target.

## Abort conditions
Abort immediately if:
- `deploy:beta:guard` fails;
- preflight says production Supabase, live Stripe/EcoCash, wrong site URL or non-isolated media;
- `.vercel/project.json` resolves to `prj_jdey5oej8CGAROfdPK2f5frnq2YK`;
- checkout has uncommitted changes;
- HEAD differs from the expected SHA.

Do not run a production/main deploy as part of this handoff.