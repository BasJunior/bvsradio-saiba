# BVS mobile app edition

The native apps share BVS accounts and backend services but use a fail-closed,
surface-specific music catalogue and a listener shell.

- iOS start URL: `https://bvsradio.com/app/ios`
- Android start URL: `https://bvsradio.com/app/android`
- Primary tabs: Home, Explore, Beats, Library
- Search lives in the top bar and opens Explore
- Website catalogue and station stay available; the app edition does not replace them
- A track appears in a mobile edition only when Editorial records a `cleared`
  row for that surface with both a rights basis and evidence reference.
- Missing, `not_reviewed`, or `blocked` rows never fall back to archive audio.
- Cards play through the persistent BVS player. Beat licence still opens the full listing.

## Native sync

```bash
# iOS (default)
npx cap sync ios

# Android when Play clearance is activated
BVS_MOBILE_SURFACE=android npx cap sync android
```

## Editorial operation

Open `/editorial` → Singles → Mobile distribution. Approve and publish a track
first, then record the rights basis, internal agreement/evidence reference, and
the iOS decision. Every decision is written to the Editorial audit log.

The database model already accepts `android`, but Android rows should remain
absent until the Play Store evidence review begins.
