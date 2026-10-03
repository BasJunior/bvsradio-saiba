# BVS platform audit — 3 October 2026

Baseline: main `9e5f282098095db6d132b2e76305d8abad8f765f` (PR #139).

This was a repository-wide inventory and checks run, with focused code review of playback, web/native navigation, authentication, account isolation, sharing, Feed/Discover/Home/Marketplace design, Studio/editorial permissions, purchases, notifications and offline handling. It is not a guarantee that every line or every device combination is defect-free.

## Problems fixed

| Area | Finding | Result |
| --- | --- | --- |
| Native account hydration | The auth callback reacquired the Supabase session while the auth lock could still be held. Late previous-account responses could restore stale profile/access state. | Defer callback work, consume its supplied session, bound explicit session reads and access requests, invalidate superseded requests and clear account-specific state. |
| Login | Optional profile requests and session installation could hold navigation indefinitely; native return-path validation did not enforce the surface boundary. | Shared timeout and destination validation, bounded profile lookups and safe best-effort fallback. |
| Studio writing | An older PATCH could clear the dirty flag after the user had written a newer draft. Overlapping requests could finish out of order; network exceptions were not handled. | Serialize writes, track edit revisions and workspace lifecycle, retain edits on failure, expose retry, bound requests and preserve attached audio URLs. Release navigation waits for a current successful save. |
| Continuous playback | Several internal catalogue, library and Studio actions replaced the document. | Use client navigation for these transitions so the persistent player can remain mounted. Authentication boundaries still reload deliberately. |
| Native links | Feed, individual beats, playlists and Studio song workspaces were absent from URL mapping. | Map existing native routes, preserve query/hash and reject malformed/untrusted destinations. |
| Touch/navigation | Native page CSS permitted vertical panning only; two handlers could react to one Now Playing swipe. | Permit sideways rails and zoom, assign player swipe handling to one bridge and avoid native/browser double back. Align bottom navigation order across surfaces. |
| Notifications | Settings could retain a previous account's form values or accept stale fetch results. | Remount settings per account and ignore superseded results, with bounded fetches. |
| Offline privacy | The service worker retained navigation responses that could include private account pages. | Purge old BVS caches and cache only explicit public shell/build assets. Provide a branded static offline page instead of replaying account HTML. |
| Design/accessibility | Square editorial surfaces needed consistent keyboard focus; unavailable creator rails could wait forever. | Add visible purple focus outlines, bound portrait fetches and retain client navigation in the directory fallback. Preserve charcoal sections, square artwork, divider lines, purple producer/Join accents and calmer secondary controls. |
| Native tablet layout | Live browser measurement showed a 77px tab bar but a zero player offset at tablet widths. The player covered the tabs and intercepted navigation. | Map the contained-nav measurement into the shared layout token at every width, explicitly dock the player above it and reserve the full bottom stack in page content. |

## Verification

- Production build and its regression gates passed. The new audit tests are included in both build commands through `test:recent-changes`.
- Behavioral tests execute the real auth provider with delayed account responses and an auth-lock sentinel; the real Studio save handlers with edits during an outstanding PATCH, failed writes and retry; the real service worker with account navigation, RSC requests and offline fallback.
- Safe-floor, rights compliance, app-flow, marketplace experience/economics, stream qualification and participation/worker/owner-pulse suites passed during the audit.
- Type checking passed. Lint findings in `src` decreased from 83 errors/54 warnings to 71 errors/44 warnings. Lint is still failing; it is not presented as a passing release check.
- Live public audio GET with a byte range returned HTTP 206 and `audio/mpeg`. HEAD requests to GET-signed media URLs are not valid playback tests.
- The production database check found no public tables without row-level security and no SECURITY DEFINER functions callable by anonymous/authenticated roles. This verifies those predicates, not every policy's complete business semantics.
- Production cron logs showed the notification worker returning 200 with APNs configured and an enabled iOS device. No eligible notification was queued in those inspected runs. This establishes configuration/worker execution, not lock-screen delivery.
- Vercel's error-cluster checks returned no clusters for either project in the inspected 24-hour window. That is a limited monitoring sample, not proof of zero runtime failures.

## Remaining work and practical limits

1. **Physical iOS release verification:** TestFlight/Xcode build, background/lock-screen playback, interruption recovery, notification delivery/tap routing and Instagram/WhatsApp native sharing need a physical device. This Linux environment cannot certify those behaviors. No real payment, public share, notification to another user or production creator-content mutation was submitted during the audit.
2. **Authentication setting:** Production Supabase reports leaked-password protection disabled. Enable the protection in the production Auth settings and verify the registration/reset flow. No supported settings mutation was exposed in this session, so the audit did not claim to change it.
3. **Lint debt:** Remaining errors include 66 state-in-effect findings, four ref findings in marketplace row-render helper closures and one purity finding around event-driven date validation. Resolve with component/lifecycle refactoring rather than disabling rules or delaying state setters solely to silence lint.
4. **Test quality:** Many existing gates assert source structure. Keep them where they protect boundaries, but expand behavioral coverage for checkout/webhooks, upload interruptions, account switching and native gestures. The new tests cover verified failure cases rather than only implementation strings.
5. **Maintainability:** Large player/catalogue/marketplace components combine fetching, account state, navigation and rendering. Incremental extraction into stable domain components/hooks will make future design changes easier to review and less likely to regress playback or purchases. Avoid a broad rewrite during this reliability release.

The corrected flows are stronger, but these remaining limits prevent an honest “10/10, no mistakes” claim.
