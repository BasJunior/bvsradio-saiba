# from-vps LATEST — website status (before Mac prompt)

**From:** VPS status check after Discord Saiba changes  
**Checked:** live site + git + Discord #general  

## Most current website version

| Source | State |
|--------|--------|
| **Git `origin/main`** | Includes `20b14e5 feat: implement BVS review changes` (Saiba OpenClaw) |
| **Discord Saiba** | Said: *Implemented and pushed all requested changes* + screenshots (`catalogue.png`, `ultimate-bundle.png`) + link https://bvsradio.com (noted Vercel still processing at post time) |
| **Live bvsradio.com** | **200** on `/`, `/catalogue`, `/shop`, `/upload`, `/radio`, `/checkout` |
| **AASA** | Live with **VGFK77VH73.com.bvsradio.app** |

### Review brief items (code on main)

| # | Item | In code (main) |
|---|------|----------------|
| 1 | Browse → Browse section | `#browse` + scroll-mt on catalogue |
| 2 | Preview stop + elapsed/total | catalogue preview timer logic (30s snippet) |
| 3 | “Search Results” title | catalogue + search pages |
| 4 | Submit Music cleanup | upload page restructure |
| 5 | Ultimate Bundle | shop page $299 mix+master+publish |
| 6 | Later: aesthetic search + cart/checkout flow | **Not in 20b14e5** — still open if required |

Team brief PDF still at: `ops/agent-bridge/team-review/Bvsradio-Developer-Change-Brief-v2.pdf`

## What Mac agent should do (if prompted for App Store)
- Hybrid app loads **live site** → TestFlight will show these web changes after deploy/cache clears (hard-refresh / kill app).
- **Do not re-implement** the 5 brief items in Xcode.
- Focus: **App Store Submit for Review** (screenshots of listing, build 1, metadata) if still not submitted.
- Optional QA: open TestFlight and confirm catalogue search results title + shop Ultimate Bundle after force-quit app.

## Still open (web, not Mac)
- basjunior later note: more aesthetic catalogue search bar + checkout cart recognition/flow  
- Visual QA of Saiba screenshots vs production (bot/challenge can blank headless shop capture)

## iOS facts
Team VGFK77VH73 · app 6792035284 · TestFlight Internal · build 1  
