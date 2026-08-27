# iOS Content Evidence Queue — 2026-08-27

This is an evidence/risk queue, **not an authorization list**. No clearance rows are created by this document.

## Production source of truth
Read-only production Supabase project `rdwwyolrxahimcgpkzzy` matches the public station API:
- 65 approved/public/in-rotation web tracks
- 5 `ios / cleared` rows

## Current 65-track classification

| Class | Count | Meaning |
|---|---:|---|
| A — already iOS-cleared | 5 | Existing fail-closed iOS set |
| B — release Rights Passport ready | 26 | Release linked; rights-confirmed; Passport present; original-only; preflight `ready`; no unconfirmed contributors |
| C — release needs review | 1 | Release-linked but not at current Passport/preflight standard |
| D — standalone with verified credits | 18 | Some verified people/credit records, but not the same as a complete master/composition rights chain |
| E — standalone needs evidence | 15 | No current release Passport and no verified-credit basis strong enough to shortlist automatically |

### Class C item
- **Zororo — Therslicks**: original/right-confirmed legacy release, but `passport_version=0` and preflight is `legacy_approved`, not current `ready`. Upgrade the Rights Passport before considering iOS expansion.

## Existing five: evidence maintenance first

The current iOS set remains:
1. On the Moon — BVS archive
2. Jegera — I Ratty
3. Thugging — BasJunior
4. Heavy — BasJunior
5. Party Tarpy — BVS archive

Evidence review found:
- **On the Moon** and **Party Tarpy** have BVS archive / B.V.SStudios + Amuse release references, UPC/ISRC evidence references recorded.
- **Heavy**, **Jegera**, and **Thugging** are cleared on a `founder-owned master` basis, but their own clearance review notes state that supporting master-rights documentation remains required for the evidence pack.

### Sprint gate
Before enlarging the iOS set, close or deliberately accept the evidence gap on Heavy / Jegera / Thugging. Existing clearance does not mean the evidence record should remain incomplete forever.

## Strongest new release-level candidate pool

There are 26 non-cleared rotation tracks whose BVS records currently satisfy all of:
- linked to a release;
- release `rights_confirmed=true`;
- Rights Passport present;
- preflight `ready` with no blockers;
- material declared original-only;
- all release contributors rights-confirmed;
- worldwide territory recorded.

These are the best database candidates for human evidence review. The first releases by rights-graph simplicity are:

| Release | Rotation tracks | Master owner in Passport | Composition owner(s) | Contributor count |
|---|---:|---|---|---:|
| FRESHMAN MUSIK — kniightcrawler | 3 | Kniightcrawler | Kniightcrawler | 3 |
| Whisper II Drive — BasJunior | 2 | B.V.SStudios | BVSStudios | 4 |
| Nicer things — Fishermvnn | 1 | Red Asylum | Tanaka Mpofu | 4 |
| Small Talk Long Wait — dkwhereyouat | 5 | DKWhereYouAt | Denzil Wasterfall; Samuel Bvunzawabaya | 6 |
| Revo Masprime — REVO | 7 | Joshua Mushakavanhu | Joshua Mushakavanhu | 8 |
| STRAIGHTENIN — Wolf Bridges | 8 | Wolf Bridges | Wolf Bridges | 19 |

All 26 of these tracks are currently marked explicit in the track records. The current iOS five already include explicit tracks, so this is not by itself a new-content blocker, but BVS should separately decide whether the player/API should surface explicit metadata more clearly before broad expansion.

## Proposed first review batch — 5 tracks

These are **candidates for evidence review only**, not cleared tracks:

1. **Deep** — BasJunior, Wolf Bridges, ft. W.Hill$ — Whisper II Drive
2. **Uptown Wins** — BasJunior, Wolf Bridges — Whisper II Drive
3. **OUTRO 1** — kniightcrawler — FRESHMAN MUSIK
4. **LIFE GAVE ME LEMONS** — kniightcrawler — FRESHMAN MUSIK
5. **YOU ALREADY KNOWW** — kniightcrawler — FRESHMAN MUSIK

Why this batch:
- only two release rights packages to inspect;
- both releases are current-Passport, original-only and preflight-ready;
- all contributors are marked rights-confirmed;
- Whisper II Drive is recorded with B.V.SStudios as master owner;
- FRESHMAN MUSIK has a very simple rights graph (Kniightcrawler master/composition/songwriter/producer).

## Evidence required before any `ios / cleared` row
For each release/track, human Editorial/BVS review should confirm the database declaration is backed by adequate evidence for the rights BVS needs to stream it through the iOS-facing service. At minimum record:
- master-rights basis;
- composition/songwriter basis;
- contributor/feature/producer permissions where relevant;
- sample/cover/remix status;
- evidence reference(s);
- reviewer + review date;
- any limitations/territories;
- explicit-content decision/metadata state.

A Rights Passport is strong internal evidence, but it is not automatically equivalent to an external rights licence. Final clearance remains a BVS editorial/legal decision.

## Standalone non-explicit tracks
There are non-explicit standalone rotation tracks with verified credits (for example Voicenotes, Ghetto, Murder, Sorry zvenyu, Happy birthday, wakandinyepera). They are useful future candidates, but verified credits alone do not prove the master/composition grant needed for iOS distribution. They should move into Class B only after a stronger rights record/Passport is created.
