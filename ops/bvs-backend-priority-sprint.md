# BVS Backend Priority Sprint

**Updated:** 2026-07-20  
**Owner:** Saiba / BVS backend sprint  
**Scope:** Credibility, safer checkout, creator review flow, and public catalogue hygiene.

## Completed in this pass

- Cleaned the bundled BVS archive audio filenames so public paths no longer expose `DEMO`, `DRAFT`, `MIXDOWN`, or numbered staging names.
- Updated catalogue, radio library fallback, playlist, and music migration script references to the clean BVS naming.
- Added server-side checkout price normalization so Stripe, Paynow, and manual orders do not trust browser-supplied prices.
- Fixed checkout auth header construction so signed-in orders can be linked to the authenticated user.
- Added owner notification for new artist uploads using the existing webhook/Telegram notification environment.
- Kept artist uploads non-public and out of rotation until editorial approval.
- Added DB-backed play tracking for approved Supabase tracks in station rotation: `/api/tracks/play`, `track_play_events`, and safe `tracks.play_count` incrementing.
- Added artist-facing creator studio release dashboard basics: upload status, publish/rotation state, editor notes, play totals, licensing/download terms, and request history.
- Added artist request workflow for takedown/unpublish, metadata correction, artwork replacement, rights update, payout questions, and other review requests.
- Added editorial dashboard visibility and staff actions for artist requests.

## Verified current backend behavior

- `/api/tracks/upload` stores artist submissions with `editorial_status: submitted`, `is_public: false`, and `in_rotation: false`.
- `/admin/editorial` already contains a `Submission queue` for tracks and can approve/reject, publish/unpublish, manage rotation, licensing, and credits based on staff permissions.
- `/admin/creator-workflows` exists for writer/article/brief/show/episode review queues, separate from track submission review.
- Production deploy `dpl_H22zedkwovxXjfJgCDXh2PX1fyAB` is aliased to `https://bvsradio.com`.
- Public production routes verified with HTTP 200: `/auth/signup`, `/auth/login`, `/radio`, `/creator/studio`, and `/admin/editorial`.
- Live radio playback verified in browser before the Vercel checkpoint blocked further automated browser QA: `paused=false`, `currentTime` advanced, `readyState=4`, and `error=null`.
- Production MP3 byte-range requests return HTTP 206 with `audio/mpeg`.
- Artist signup reaches the expected email-confirmation state and confirmation mail is delivered to the accessible test inbox.
- Fixed Vercel `NEXT_PUBLIC_SITE_URL` and hardened `src/lib/auth-url.ts` so production auth confirmation/reset callbacks do not fall back to `localhost`.

## Next creator dashboard work

- Creator dashboard tools should be filtered by approved profile/role type from registration, so creators only see relevant tools; admins see everything, and multi-role creators see tools for every approved role.
- Artist dashboard should show each upload status: submitted, in review, approved, rejected, published, in rotation, not in rotation.
- Artist dashboard should show stream analytics when play tracking is fully wired: plays, listener geography when lawful/available, saves, rotation adds, and recent performance.
- Artist dashboard should support requests: takedown/unpublish request, metadata correction, artwork replacement, rights/licence update, payout/wallet question.
- Artist dashboard should resemble an Amuse-style operations view: release cards, review state, earnings/credits, analytics, and clear next actions.
- Upload notifications should become a first-class staff workflow: dashboard count, Telegram/email/webhook alert, and audit trail entry.
- Editorial dashboard should add a filtered “new uploads waiting” view if the general submission queue becomes too busy.
- Production SQL applied by Abias: `supabase-editorial-workflow.sql` and `supabase-final-sprint-core.sql`.

## Next editorial/content sprint

- Add a public-site "BVS Industry Watch" or "Regional Music Events to Watch" format for editorial event listings.
- Publish Southern Africa music event items only after verifying dates, artists, venues, ticket links, and source URLs from official event pages or trusted outlets.
- Use original BVS summaries for public event listings; do not copy full third-party articles.
- Avoid event posters, logos, and photographer images unless they are official press assets or BVS has permission.
- Make wording clear that BVS is covering/listing the event, not sponsoring, partnering, or providing official representation unless confirmed.
- Track outreach tasks for Sambiri/Sofar Sounds Harare, Maskiri/Winky D tribute coverage, regional festivals, and South Africa jazz events as interview, playlist, news-post, and social-caption opportunities.

## Remaining backend priorities

- Confirm Supabase migrations for creator workflows, artist wallet ledger, community chat, editorial workflow, and final sprint core are applied in production.
- Add DB-backed upload notification/audit records, not only external Telegram/webhook alerts.
- Verify checkout with real provider test mode or supported sandbox flow before claiming payment completion.
- Capture authenticated editorial dashboard screenshot after an editor session or credentials are available.
- Continue full authenticated role QA for listener, artist, writer, show creator, editor, and admin. Automated browser QA was blocked by Vercel Security Checkpoint Code 29 after deployment; use a normal user browser session or temporarily allow the QA environment.
- Verify a fresh signup confirmation link after the auth callback fix. The first test email before the fix used a `localhost` redirect.
- Decide whether `/api/tracks/play` should return a stable 204 no-op instead of 503 for well-formed but unknown track UUIDs.
