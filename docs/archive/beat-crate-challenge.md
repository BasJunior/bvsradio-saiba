# Archived: 25 Beat Crate Challenge (2026)

Archived at the owner’s request on 24 October 2026. The campaign is finished and hidden from creator-facing surfaces.

The original UI, rules, Instagram verification, progress calculation and editorial evidence remain in `BeatCrateChallenge.tsx`, `beat-crate.ts`, the crate API and existing database records. No entries, beats, receipts or uploaded media have been deleted.

`CRATE_CHALLENGE_ACTIVE` in `src/lib/beat-crate.ts` is the shared campaign switch. It gates Studio promotion, uploader progress and opt-in, deep-link activation, challenge-only validation and Instagram entry writes. Ordinary 1–25 beat crates, drafts, retries and editorial review remain available. Restored unfinished campaign drafts become ordinary uploads; completed historical records are retained.

Before reusing the campaign, review its ID, dates, rules, prizes and eligibility with the owner, and decide how historical entries should be separated. Then explicitly enable the switch and run the crate and Studio checks. Do not simply re-enable old prizes for a new campaign.
