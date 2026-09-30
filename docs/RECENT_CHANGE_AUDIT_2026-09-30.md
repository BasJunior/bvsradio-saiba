# BVS recent-change audit — 30 September 2026

Scope: main changes since the dark-only change `a204784`, through `6e20bcf` (36 commits, 96 changed files), plus comparison with the existing beta Ask BVS implementation. This is a source and local runtime audit; it does not establish the current production alias or database migration state.

## Confirmed findings and fixes

| Finding | Evidence | Fix |
| --- | --- | --- |
| Ask BVS differs substantially between beta and main | Beta has `ask-bvs-flow.ts`, catalogue/credit resolution and object results. Main had only the older page guide and optional AI response. Recent root deferral did not delete the assistant. | Port the published-data resolver, retain the compact launcher, web/native containment and existing page guide fallback. Render results as normal links to existing pages so licensing and playback checks remain in those flows. Send device history/follows only for relevant questions. |
| Playback failures disappear from the post-fix cohort | Dashboard selected v2 lifecycle events but selected v1 failures. | Select failures from the same v2 cohort, including tracks outside the station list. |
| Continued listening is undercounted | `playback_continue_60s` lacked the v2 tag required by the dashboard. | Tag the emitter consistently and validate each proof emitter. Previously emitted untagged events cannot be retroactively corrected by this code change. |
| Old play promises can corrupt a newer request | Async play success/failure handlers unconditionally changed state after pause/source changes. The direct play catch also cleared state before checking AbortError. | Invalidate old requests on pause, audio ownership changes and playback effects; ignore obsolete success/failure results. |
| Installation prompt blocks player controls | At 390×844 the browser reported Play/Pause covered by the install dialog at `bottom-24`. | Position the prompt above the measured player/navigation stack, bound its height, guard optional storage and cancel/recheck the delayed iPhone hint. |
| Optimized show artwork lacks responsive size hints | Newly extracted Home/Radio show cards used `fill` without `sizes`. | Add responsive sizes for featured/regular Home cards and Radio cards. |

## Runtime and build evidence

- All configured repository regression gates passed before the production build. The relevant Apple surface, dark-only, library isolation, player progress and deferred root gates also passed after the later prompt fix.
- New `test:recent-changes` exercises the actual resolver/chat/dashboard functions with mocked public data: matched entities, unknown verified credits, release relationships, newest releases with Pulse disabled, malformed history links, guide fallback, v2 failures and continued-listening rates.
- TypeScript and changed-file ESLint passed. Removed an unused player helper and moved player refs ahead of callbacks that capture them to satisfy hook immutability lint.
- Optimized Next build passed without production credentials. This proves compilation and fallback rendering, not live backend health.
- Local production browser, 390×844: Ask BVS returned Chiraq Drillaz → Wolf Bridges using the curated catalogue, with beat and creator links. Escape closes the panel; input receives focus.
- Local silent audio fixture: Home → Library → Explore kept the same document and audio element, unpaused; media time advanced from 19 seconds to 73 seconds. Existing main fix #116 is retained.
- Local browser race: an old Play promise was held pending, a newer track was started, then the old promise was rejected with NotSupportedError. The newer audio stayed unpaused with a Pause button and no old playback error.

## Areas to improve next

1. Replace more source-string tests with browser/user-flow checks. Current tests passed even with the v1/v2 mismatch and missing 60-second tag. Add real-device Safari and iOS lock-screen acceptance alongside fixture tests.
2. Make release alignment explicit across beta, web and native hosts. A successful Vercel build/check alone does not prove the intended deployment owns an alias. Compare the target commit and feature behavior before promotion.
3. Measure deferred Home layout shifts. The observer placeholders lose their minimum height as soon as mounting starts, before fetched shelves necessarily appear. Verify real mobile CLS before changing reserved space or deferral thresholds.
4. Split the large StationPlayer module by transport, reporting and UI responsibilities, preserving one root audio owner. Progress context isolation helps, but substantial UI and transport code still share one module.
5. Verify database migrations and real upload recovery in the correct environment. Upload session ownership, submission-scoped cleanup paths and submitted/finalizing exclusions are present; source checks do not prove migrations are installed or resolve concurrent cleanup/finalization races.
6. Keep programme labels separate from broadcast truth. The extracted Radio programme cards still use programme status to label “Live”; this audit did not establish SRS-backed broadcast truth for those cards.

## Release boundary

Changes are prepared on `saiba/recent-change-audit-2026-09-30` for review. No production database writes, migration execution, merge or alias promotion was performed by this audit. Native lock-screen and real backend upload/payment acceptance remain outside the local test evidence.
