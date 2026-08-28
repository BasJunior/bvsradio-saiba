# BVS production lineage (canonical)

**Question:** What exact Git SHA is production right now?  
**Answer:** Inspect the live Vercel production deployment, then confirm `origin/production/current` matches it. **Never use GitHub `main`.**

## Live production (verified 2026-08-28)

| Item | Value |
|------|--------|
| Domain | `bvsradio.com` / `www.bvsradio.com` |
| Vercel project | `bvsradio-saiba` (`prj_jdey5oej8CGAROfdPK2f5frnq2YK`) |
| Team | Saiba-BVS (`team_HYmWoU6WIW4IHXmh3mrB10Oq`) |
| Production deployment | `dpl_ANWXUhGAiPmxYNM5hFYKmVTW1WKd` |
| Production SHA | `eb80df4f276c40461b8d849195f7d2dfa9f9dda3` |
| Canonical git pointer | `origin/production/current` **must equal** that SHA |
| GitHub `origin/main` | `9b2c7a9` — **different UI lineage. Not live.** |
| Also at this SHA | `chatgpt/prod-creator-studio-safe` |

How this deploy is served: Vercel project `bvsradio-saiba`, target `production`, aliases on `bvsradio.com`. Do not assume git auto-promote from `main`.

## How to create a production candidate

1. `npx vercel inspect bvsradio.com` — record deployment ID.
2. `git fetch origin production/current`
3. Confirm `git rev-parse origin/production/current` equals the live SHA.
4. Branch from **that SHA**, not from `main`, not from beta.
5. `node scripts/prod-candidate-preflight.mjs`
6. Preview only until the matching approval switch is YES.

## After a successful production promote

1. Verify `bvsradio.com` aliases the new Ready production deployment.
2. Fast-forward `production/current` to the **exact promoted SHA** (no extra docs commit on that pointer).
3. Record the previous deployment as rollback (`dpl_ANWXUhGAiPmxYNM5hFYKmVTW1WKd` / `eb80df4` until the next promote).

## Hard rules

- Do not rewrite or force-push `main`.
- Do not merge beta into production.
- Do not treat `origin/main` as the iOS/web shell.
- Capacitor iOS still loads `https://bvsradio.com/app/ios`.
