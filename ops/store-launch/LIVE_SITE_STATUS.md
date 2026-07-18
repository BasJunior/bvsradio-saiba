# Live site status — bvsradio.com

**Checked:** 2026-07-18  
**Production deploy:** Ready (`bvsradio-saiba-807ehufn6`) ≈ commit `9da2fed`  
**Aliases:** bvsradio.com, www.bvsradio.com

## Verified green

| Surface | Status |
|---------|--------|
| Homepage | 200 |
| /radio | 200, progress bar strings present |
| /checkout | 200 |
| AASA `/.well-known/apple-app-site-association` | 200 `application/json`, Team `VGFK77VH73.com.bvsradio.app` |
| assetlinks.json | 200 (Play SHA still placeholder) |
| `/api/checkout/config` | Stripe on, Paynow off, tax region_table live |
| Music cover asset | 200 |

## Tax live

- `tax.enabled: true`
- Mode: `region_table` / `bvs_region_rates`
- Countries include DE 19%, ZW 15%, GB 20%, etc.

## Notes

- Vercel **Attack Mode** should stay **disabled** so Apple AASA crawlers and APIs are not HTML-challenged.
- Earlier Error deploy backlog was VHS disk; fixed by `.vercelignore` + tracing excludes.
- iOS App Review: WAITING_FOR_REVIEW (per bridge).
- Play: assetlinks SHA still `REPLACE_WITH_PLAY_APP_SIGNING_SHA256`.
