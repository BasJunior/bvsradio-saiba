# BVS Trending V1

Songs gain chart positions through listener momentum. The chart never reads Premium status, money, lifetime plays or radio rotation to determine a position, and never changes rotation.

## Listener experience

Discover on web and the app has a five-song chart preview. `/trending` and `/app/{ios|android}/trending` show up to 20 songs, with 24-hour and seven-day charts, movement since the previous saved hourly chart, real artwork, direct song links, save/share and the existing persistent player. Clicking a chart song supplies the chart as related tracks, so transport controls continue through it. Song pages and Discover song cards have subtle rank badges. Creator Insights shows the creator's own charting songs and an explanation of their momentum.

Empty charts stay empty; the product does not invent entries to fill 20 positions. A song needs at least five distinct qualified listeners. First charts show no movement; subsequent appearances without a position in the preceding chart show NEW. Stale charts display their timestamp as the last available chart.

## Measurement and ranking

Playback creates a server-timed session. Qualification requires at least 30 seconds of bounded overlap between media progress and wall-clock progress. The server also requires elapsed time after session creation. Completion requires at least 80% of media progression and sufficient server elapsed time against the stored track duration. The accumulator continues after qualification; seeking, buffering gaps and suspended timers do not manufacture progress.

Only public, editorial-approved tracks with playable audio can enter the system. Saves and successful share/copy handoffs made after starting a song are retained, but affect a score only when that device also qualifies a listen in the scoring window. A share handoff or copied link is not proof that a social post was published. Existing financial stream qualification and settlement remain separate and keep their existing feature flag.

For each song and window:

- Deduplicate by both verified account and signed device cookie, keeping at most one qualification per six-hour bucket for either identity. Authenticated tokens are verified server-side. Different-device activity from one account does not become multiple listeners.
- Cap a song's accepted traffic from a network to 20 qualifications per UTC hour. Network keys use HMAC with a daily salt; raw addresses are not stored. On Vercel, the protected `x-vercel-forwarded-for` header supplies this input. Other hosts still apply account/device caps, but need a trusted proxy integration to enable network caps.
- Exclude self-listens when the session has the artist's verified account identity. Anonymous self-listens cannot be reliably recognized.
- Aggregate distinct listeners, listeners who completed, saved, shared, and returned in another six-hour bucket. Each person can contribute at most one unit to each engagement factor in a chart window.
- Compute `ln(1 + listeners) * (1 + .5 * completion + .6 * saveRate + .5 * shareRate + .3 * returnRate) * (1 + .25 * velocity)`.
- Smooth completion with `(completedListeners + 2) / (listeners + 4)`. Velocity compares the most recent quarter-window with its preceding equal-length quarter-window, adds five to each count, and caps the ratio at four.
- Break ties by listener count and track UUID for reproducible positions.

The minimum is a launch setting, not a claim of statistical significance. This is a conservative V1 abuse filter, not bot attestation: clearing cookies or operating many accounts/devices/networks can still evade some caps. Shared mobile networks may also be capped. Review chart quality before changing these constants.

## Snapshots, permissions and retention

The worker computes both charts hourly, inside a transaction, with an advisory lock. A completed chart slot is immutable to retries; even an empty chart has a saved run. Public reads join current publication/approval state, then return only chart presentation data. Removing a song from public visibility excludes it from subsequent API reads (responses may be cached for up to 60 seconds).

Session and action data is retained for eight days; chart history for 35 days. Signed device cookies expire after eight days. All four tables have RLS enabled, with no browser-role grants or policies. All three RPCs use invoker security, and EXECUTE is restricted to service_role. Neither private listener identifiers nor scores are returned publicly.

## Release sequence

1. Apply `supabase/migrations/20261016190532_bvs_trending_momentum.sql` to the intended database before releasing the new code. It depends on the existing tracks table and Supabase auth schema.
2. The existing Supabase server/anonymous environment variables are required. `TRENDING_IDENTITY_SECRET` is optional; its fallback is the server-only service key. Rotating it resets device identities.
3. Deploy the code and cron configuration. `/api/cron/trending` runs at minute 7 of each hour. Only the existing canonical production worker project runs it, and its existing CRON_SECRET authorizes the request. Preview and isolated App Store projects skip it.
4. Run `select public.bvs_refresh_trending();` once with a privileged database connection, or invoke the authorized cron. Empty initial snapshots are valid. The next completed hour can show movement.
5. Listen on multiple independent devices/accounts, verify qualified sessions, refresh after the hour, and check chart playback and Creator Insights on production. There is no historical backfill: existing play totals are intentionally not treated as unique, qualified momentum.

No production database change or deployment was performed while preparing this implementation.

## Validation

`npm run test:bvs-trending` executes the migration in PostgreSQL via PGlite and tests server timing, completion, account/device deduplication, network burst caps, eligibility, historical-play exclusion, immutable snapshots, movement and browser-role permission denials. Component behavior checks cover persistent playback/queue, save/share links, app routes, period switching, loading, errors, retries and empty charts. The suite is part of both production build commands.
