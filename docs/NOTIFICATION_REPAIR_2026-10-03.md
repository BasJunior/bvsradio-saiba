# Notification repair — 3 October 2026

The canonical production database was missing `app_push_devices` and `app_notification_preferences`, although both existed in beta. Production participation cron returned 503 at 10:20 UTC. After applying `supabase-native-notifications.sql`, its 10:25 UTC run returned 200. Beta tokens were not copied across databases or accounts.

The repair adds server-only storage with RLS and no browser grants, truthful device/provider status, category preference writes that preserve unrelated settings, community consent checks, registration retries on resume/reconnect, saved-device unregistration before sign-out, and independently refreshed web/iOS inboxes. Marketplace Editorial messages now appear in the iOS inbox and unread badge.

Apple alerts now have 24 hours of offline retention and a stable per-notification collapse ID. Ambiguous and expired-lease deliveries re-enter bounded retries. Quiet hours remain effective without enabling the daily digest. The worker logs aggregate health without tokens or recipient identities.

Native build 15 retains a notification tap until the web listener acknowledges it, including cold starts, refreshes the foreground inbox on receipt, and offers an app-settings handoff. These Swift changes require a signed iOS build; a Vercel deployment cannot update the installed native binary. Run the existing `ops/store-launch/scripts/archive-ios.sh` on the signing Mac. No signed archive or App Store submission was produced from this Linux workspace.

Verification: `npm run build`, targeted ESLint, `scripts/notification-reliability-tests.mjs`, existing participation/mobile social/Marketplace checks; live database RLS and privilege queries. The new behavioral tests exercise partial inbox failures/recovery, category filtering, denial and storage failure during real iOS registration code, sign-out cleanup, actual APNs headers/payload generation, missing-consent suppression and uncertain-delivery recovery. Native tap queue wiring is checked in source; physical-device APNs delivery is not established by these tests.

A registered production iPhone and working Apple provider credentials are still required for an end-to-end lock-screen check. Do not describe provider acceptance, a successful worker run or browser verification as proof that a physical iPhone displayed an alert. Notification settings report provider unavailability rather than falsely promising delivery. Releases/shows and creator/order notices retain their existing inbox sources; this repair does not invent new outbound campaign fanout.
