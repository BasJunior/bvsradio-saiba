# November 2026 maintenance update

The web runtime is pinned to Next.js 16.4.4 and React / React DOM 19.3.1, with matching Next ESLint configuration and React test renderer. The lockfile refreshes other dependencies within their existing compatible ranges. Nodemailer moves to 10.3.1 to resolve production email security advisories; the SMTP transport configuration is unchanged. See the [upstream release notes](https://github.com/nodemailer/nodemailer/releases).

Stripe remains pinned to 22.3.1, matching the existing `2026-06-24.dahlia` API contract. An unrestricted compatible-range refresh exposed a TypeScript mismatch with the SDK's newer API version. Payment API and webhook migrations need separate sandbox checkout validation. Capacitor stays on major 7, and the AI SDK stays on major 6.

## Listening experience

- Now Playing offers 15, 30, 45 and 60 minute sleep timers, plus Off. The timer stays active when the panel closes and across track changes. It ends when this browser session is reloaded or the player unmounts.
- The timer uses an absolute deadline and rechecks on audio time updates and app foreground restoration. It is a web timer, so an OS that fully suspends JavaScript can delay the pause until execution resumes. Native background deadline enforcement still needs device validation.
- Space toggles playback; Shift + Left / Right changes tracks. Shortcuts leave text entry, buttons, links, media controls, modifier shortcuts and other dialogs alone.
- The persistent and full-player seek bars support keyboard arrows in five-second steps, Home and End, and announce elapsed and total time.
- Now Playing traps keyboard focus, returns focus to its opener, and uses the shared nested-modal scroll lock. Escape only closes the top modal.

## Validation and release

`npm run test:modern-playback` executes timer replacement, cancellation, expiry, background rechecks, cleanup and shortcut safety tests. It is included in the existing product-maturity build gate.

The full `npm run build` test chain and production compilation passed, as did TypeScript, targeted ESLint, and the additional CI checks for payment floors, rights, app navigation, participation, Signal database/runtime behavior and marketplace behavior. Next reports an existing broad-filesystem tracing warning in `station-host.mjs`; production deployment size should be monitored.

The final production-only npm audit reported zero vulnerabilities. The full audit retained 19 moderate findings in development tooling (glob/minimatch and their dependants). Forced downgrades and broad transitive major overrides were not applied.

Browser checks on the local radio page confirmed the timer selection, persistence after closing/reopening the panel, Escape dismissal, focus restoration and reverse-Tab wrapping. This isolated checkout has no live catalogue or SMTP credentials; real stream playback and email delivery were not exercised. No messages or payments were sent.

Before a native release, sync Capacitor and validate the iOS/Android projects on devices, especially lock-screen controls, background playback and sleep-timer behavior. This update does not submit a native store release.
