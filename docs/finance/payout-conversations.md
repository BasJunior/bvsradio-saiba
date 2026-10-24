# Private payout conversations

Creators and staff with `manage_artist_wallet` can exchange messages on an existing payout request. Editorial opens **Messages & account-holder confirmation** in Finance → Payouts. Creators open the same panel under **Payout messages** on Creator Studio → Payouts. No payout status transition is needed to send a message. Historical conversations remain readable and replyable after a payout closes.

Only the creator can confirm the name registered to the selected payout account: use the saved private account full name, or type a different registered name. Confirmation is explicit, records a timestamp on that request, and appends a message to the audit trail. It never infers a holder name from an artist name, changes the private account name, edits another payout method, approves a transfer, or moves money. Staff must still match the confirmed name against the payment service before transferring. Closed requests cannot receive a new holder-name confirmation.

## Access and delivery

- New tables use RLS with no browser grants. Service-only SECURITY INVOKER functions check ownership / Finance permissions, reject invalid senders, enforce a six-message-per-minute limit, and write the message, confirmation and audit record atomically.
- Client-generated message IDs make retries idempotent. A failed request retains the message draft; changed content gets a new ID. The inbox exposes only generic payout-message notices, scoped to owners or Finance staff. Messages and legal names are not included in notification previews or email bodies.
- A private message is stored before email is attempted. Finance messages notify the creator’s account email; creator replies notify `BVS_PAYOUT_EMAIL`, falling back to `BVS_ORDER_EMAIL` or the existing BVS contact address. Email replies are not ingested: both sides follow the link and reply in BVS.
- `/api/cron/payout-messages` retries failed / abandoned deliveries every five minutes on the canonical production worker only. The existing `CRON_SECRET` and SMTP settings are reused. Delivery claims prevent normal worker overlap, with five total attempts. SMTP delivery is at-least-once: a process crash after SMTP acceptance but before recording success can yield a duplicate email notice. Message storage itself is idempotent. Failed email notices are visible to the sender; the in-app conversation remains available.
- History is paginated in blocks of 100. Opening a conversation acknowledges only the incoming IDs actually displayed, and Finance shows a new-reply indicator until read. Open conversations refresh every 30 seconds; closed conversations have no polling cost.

## Release

Apply `20261024162446_payout_conversations.sql` to the existing production database before releasing the application code. It is additive; preserve all existing requests, balances, messages and methods. No live message is sent during deployment. Existing saved holder names remain unconfirmed until the creator explicitly confirms.

Verification: `npm run test:payout-conversations`, TypeScript, scoped ESLint and the full production build. The targeted suite uses a local Postgres-compatible test engine and mocked mail/UI/API calls; it never sends production email or changes live payout requests. Payout scheduling / estimated payment dates and email-to-thread ingestion are outside this change.
