# from-vps LATEST — Discord team review captured

**From:** VPS Saiba Codex  
**Source:** Discord guild BVS · channel **#general**  
**When checked:** 2026-07-17  

## PDF found — YES
Latest brief (use this, not v1):

| File | Path in repo |
|------|----------------|
| **Bvsradio-Developer-Change-Brief-v2.pdf** | `ops/agent-bridge/team-review/Bvsradio-Developer-Change-Brief-v2.pdf` |
| Text extract | `ops/agent-bridge/team-review/Bvsradio-Developer-Change-Brief-v2.txt` |
| v1 (superseded) | `ops/agent-bridge/team-review/Bvsradio-Developer-Change-Brief.pdf` |
| Raw Discord dump | `ops/agent-bridge/team-review/discord-general-notes.md` |

Discord CDN (v2): posted by Saiba after consolidating notes; v2 adds explicit “remaining preview time” language.

## Team review notes (summary for agents)

From basjunior. + consolidated PDF v2 + later note:

1. **Browse** control → navigate/scroll to Browse section (sticky header offset, mobile+desktop).  
2. **Preview player** → stop at snippet end; show **elapsed / total** (e.g. `0:12 / 0:30`) so remaining time is clear; optional progress bar.  
3. **Search Results** heading under search bar (match section title style).  
4. **Submit Music** page → remove redundant header; reorder requirements (eligibility/files first).  
5. **Ultimate Bundle** on services/shop → mix + master + **publish**.  
6. **Later note (after PDF):** more aesthetic **search bar** on catalogue; **checkout should recognize cart** and improve **checkout page flow**.

Also: varskinisjuozas — *make changes and send screenshots and a link*.

## Who does what
| Work | Owner |
|------|--------|
| Website UX items 1–6 | **VPS / web agents** (Next.js on bvsradio.com) — not Xcode |
| App Store **Submit for Review** | **Mac agent** (ASC API key on Mac only) |
| Screenshots + link for team | After web fixes deploy |

## Mac agent (if prompted now)
- Prefer: **App Review submit** path (build 1, app 6792035284) if listing complete.  
- Do **not** expect to implement catalogue CSS in Xcode — shell loads live site; web fixes land via Vercel.  
- After web deploys, TestFlight auto-shows new UI (hybrid).  
- Report submit state to `from-mac/LATEST.md`.

## VPS next (web)
Implement PDF v2 + cart/checkout note; screenshot; post link for team.

## iOS facts (unchanged)
Team `VGFK77VH73` · bundle `com.bvsradio.app` · ASC `6792035284` · TestFlight Internal OK  

## Do not
- Commit ASC `.p8`  
- Start artists hub  
- Change bundle ID  
