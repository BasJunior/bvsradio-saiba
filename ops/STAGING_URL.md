# BVS staging URL (free Vercel sub)

**Updated:** 2026-08-20

| Lane | Project | URL |
|------|---------|-----|
| **Staging / beta web** | `bvsradio-beta` | **https://bvsradio-beta.vercel.app** |
| Current deployment | same | Resolve with `vercel ls bvsradio-beta`; stable alias above is canonical |
| **Production** | `bvsradio-saiba` | https://bvsradio.com (**do not deploy beta here**) |

## Beta app
```bash
BVS_APP_VARIANT=beta BVS_MOBILE_URL=https://bvsradio-beta.vercel.app
```
(`com.bvsradio.beta` / `ios-beta/`)

## Agent split
- **Discord:** Flow v2 handoff completed through `c653bb5`
- **Telegram/Saiba:** post-handoff beta implementation; no prod during Apple lock

## Notes
- Free `*.vercel.app` — no extra domain purchase for BVS preview
- Env/keys on this project should be staging/test where possible
- Branch preview also exists: `bvsradio-saiba-git-saiba-bvs-radio-beta-shell-saiba-bvs.vercel.app`
