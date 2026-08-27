# BVS Validation Sprint — 2026-08-28

## Goal
Prove and measure the creator loop: discover/licence a beat → create in Song Workspace → prepare rights → submit a release, while establishing a repeatable beta-to-production and iOS-content rollout process.

## Locked baseline
- Active beta branch: `saiba/beta-premium-royalty-share-2026-08-26`
- Active beta SHA at sprint start: `124690a7f4dc1c7c36a53b2635eda10e495e3bdc`
- Recovery deployment: `dpl_2KNDdBJKnP3sTZ6MFvkDBHTT7q3r` (READY)
- Production/main SHA at sprint start: `9b2c7a9dcbda5915ecaf7cf492bf3d0a7b684ca8`
- Beta Supabase project: `kuqdhuomcqonhnwfgrlw`
- Latest beta migration at sprint start: `20260827113122 song_workspaces_lyrics_pad_v1`
- Sprint integration branch: `saiba/sprint-validation-2026-08-28`

## P0 outcomes
1. Instrument creator + BeatStore conversion funnels.
2. Harden paid-beat entitlement and Song Workspace end-to-end behavior.
3. Verify mobile Studio / Lyrics Pad usability and fix observed friction only.
4. Inventory current rotation for web/iOS admissibility and evidence gaps.
5. Establish a feature-level beta → production promotion checklist.

## P1 outcomes
1. Runtime and API smoke-test checklist.
2. Rights/commerce trust checks for beat licences and release carry-forward.
3. First small iOS content candidate batch with evidence status.

## Do not touch without explicit approval
- `main`
- production database schema/data
- production Vercel aliases
- App Store binary/submission state
- Premium/Instant pricing or royalty-share economics
- mass iOS track clearance

## Release policy
- Work lands on the sprint branch first.
- Active beta is promoted only after build + smoke QA.
- Production is feature-level promotion only; never a blind sprint-branch merge.
- Content/config, web product, iOS-visible product and native changes are classified separately.

## Rights policy
Automation may gather evidence and flag risk, but final BVS rights/admissibility decisions remain human/editorial decisions.