# BVS Premium AI

Ask BVS has one conversation and composer. Its Premium button enables upgraded answers in place for eligible members, preserving conversation history. Other visitors see a membership offer popup. The paid listener membership (currently BVS Supporter) is the entry level; paid creator memberships also qualify. Premium conversations send up to 12 messages to `/api/chat/premium`; they are kept in the current browser component only, and cleared when changing modes or signing in/out. The endpoint does not persist conversations.

## Access

The server verifies the bearer token with Supabase Auth on every request. It reads that user's `bvs_memberships` with the server-only service key, then requires an active or trialing paid plan in `PREMIUM_CATALOG`, or `artist_annual`. Memberships must have started and must not have expired. Free plans, unknown plans, shell records, canceled memberships and Premium Instant release purchases do not unlock AI. There is no client flag or administrator bypass.

The existing `consume_participation_rate_limit` service-only RPC supplies a shared 30-message hourly limit per verified account in its own `premium_ai` bucket. Failed checks deny generation. Each model call has a 900-token output limit, no automatic retry and a 20-second timeout. Requests and responses are private/no-store.

## Activation

The local environment currently has no AI Gateway credential. Configure `AI_GATEWAY_API_KEY` through the environment's secret settings (local `.env.local` or deployment environment), then restart the server. Vercel's existing `VERCEL_OIDC_TOKEN` is also supported by the installed AI SDK. Do not put either credential in a `NEXT_PUBLIC_` variable or commit it.

Optional `BVS_PREMIUM_AI_MODEL` overrides the Gateway model ID; the default matches the existing application's `google/gemini-2.5-flash-lite`. Verify model availability and budget in the existing Gateway account before activation. Missing credentials return an explicit unavailable state; no synthetic AI answer is substituted.

No checkout products, prices, billing subscriptions or database policies are changed. The existing Premium page remains the plan destination. Premium AI cannot access private creator files, execute actions, verify current licence terms or guarantee editorial outcomes.

## Validation

Run `npm run test:premium-ai` for mocked authentication, membership expiry, free/Instant denial, rate-limit denial, input validation, model gating and response checks. This test also runs in build preflight. Run `npm run typecheck` and targeted ESLint for the changed files.

A real paid-account model response still needs verification after Gateway credentials are configured. Test with an existing authorized membership; do not create a purchase or alter production memberships to bypass this check.
