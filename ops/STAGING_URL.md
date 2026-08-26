# BVS staging URL (free Vercel sub)

**Updated:** 2026-08-20

| Lane | Project | URL |
|------|---------|-----|
| **Staging / beta web** | `bvsradio-beta` | **https://bvsradio-beta.vercel.app** |
| Deploy hash (this ship) | same | https://bvsradio-beta-jvwcyrq0g-saiba-bvs.vercel.app |
| **Production** | `bvsradio-saiba` | https://bvsradio.com (**do not deploy beta here**) |

## Beta app
```bash
BVS_APP_VARIANT=beta BVS_MOBILE_URL=https://bvsradio-beta.vercel.app
```
(`com.bvsradio.beta` / `ios-beta/`)

## Agent split
- **Discord:** Flow/product on `saiba/bvs-radio-beta-shell` — leave cooking
- **Telegram/Saiba:** staging project + pipeline; no prod during Apple lock

## Notes
- Free `*.vercel.app` — no extra domain purchase for BVS preview
- Env/keys on this project should be staging/test where possible
- Branch preview also exists: `bvsradio-saiba-git-saiba-bvs-radio-beta-shell-saiba-bvs.vercel.app`
