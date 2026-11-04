# Distribution reporting

Creators: Studio → Catalogue → Insights → Distribution analytics.
Staff: Editorial → Distribution reports (`/admin/editorial/distribution`).

Before enabling persistence, apply `supabase/migrations/20261103203405_distribution_reports.sql` through the normal database release process. Until then staff can preview but cannot publish. No production migration was applied by this local implementation.

1. Find the release in Amuse. Set the same release, start date and end date in BVS.
2. Enter daily store totals, one line per date/store: `2026-01-01,Spotify,120` (no header).
3. Optionally enter matching country totals: `ZW,120`. Omitted geography is unavailable, not zero.
4. Include the release title/UPC and source export reference. Preview the figures and map, then publish.
5. A correction creates another immutable report. The creator selects one report; reports are never summed across overlapping periods. Retain old versions for traceability.

Only staff with submission approval permission can publish. The server resolves the release owner and requires a matching distribution job. Client-supplied owner IDs are ignored. No browser role can read or write the reporting table directly. Creator reads are scoped to the authenticated owner by the server.

Premium purchase does not generate numbers. Start the existing distribution workflow, then publish analytics when the partner has real reporting data. The creator DSP desk requires active Artist Premium with distribution enabled and a release in the wider-distribution workflow. Historical data stays stored when membership expires, but the DSP desk is hidden. BVS playback analytics remain available. Cancelled or ineligible releases are excluded. Nothing changes royalties, wallet balances, growth stars or BVS listening counts.

There is no automatic Amuse API integration in this version. Staff enter partner figures manually. Do not copy account-wide totals into a single release. Only dates supplied are plotted. Map totals may be partial; missing countries remain grey. Map polygons: Natural Earth 1:110m, public domain; https://www.naturalearthdata.com/about/terms-of-use/.

Checks: `npm run test:distribution-reports`, `npx tsc --noEmit`.
