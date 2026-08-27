# iOS Rights Evidence Gate — 2026-08-27

Purpose: separate **BVS metadata / declarations** from a durable **human-reviewable evidence pack** before expanding the iOS-cleared rotation.

No item in this file is automatically cleared. Final admissibility is a BVS human/editorial rights decision.

## Gate 0 — strengthen the five already live on iOS

### On the Moon — BVS archive
Current state:
- iOS cleared
- non-explicit
- rights basis: BVS archive master / B.V.SStudios label release via Amuse
- evidence reference includes Amuse release 3765147, UPC 7300344470365, ISRC SE6XY2585734
- current notes say the Amuse screenshots corroborate delivery/label/track membership and the underlying rights declaration remains controlling

Human pack to retain:
- underlying BVS master-rights declaration / ownership basis
- Amuse release/UPC/ISRC proof already referenced
- composition/songwriter ownership statement if not already preserved outside the database

### Party Tarpy — BVS archive
Current state:
- iOS cleared
- non-explicit
- same Amuse release / UPC evidence family
- track ISRC SE6XY2585739

Human pack to retain:
- same underlying master-rights declaration
- existing Amuse delivery/label/track evidence
- composition/songwriter ownership statement

### Heavy — BasJunior
Current state:
- iOS cleared
- explicit
- rights basis recorded as founder-owned master
- evidence reference currently points to BVS Founder catalogue instruction, Telegram 18196, 2026-08-12
- clearance note explicitly says supporting master-rights documentation remains required for the Apple evidence pack

**Open gate:** add durable master-rights evidence beyond the catalogue instruction; preserve composition/songwriter authority basis.

### Jegera — I Ratty
Current state:
- iOS cleared
- explicit
- rights basis recorded as founder-owned master
- evidence reference currently points to the same founder catalogue instruction
- clearance note explicitly says supporting master-rights documentation remains required

**Open gate:** document why BVS/founder controls this master despite the credited artist being I Ratty; preserve composition/songwriter authority basis.

### Thugging — BasJunior
Current state:
- iOS cleared
- explicit
- rights basis recorded as founder-owned master
- evidence reference currently points to the founder catalogue instruction
- clearance note explicitly says supporting master-rights documentation remains required

**Open gate:** add durable master-rights evidence; preserve composition/songwriter authority basis.

## Gate 1 — proposed first expansion package

### Release package: Whisper II Drive
Candidate tracks:
- Deep — BasJunior, Wolf Bridges, ft. W.Hill$
- Uptown Wins — BasJunior, Wolf Bridges

Database position:
- Rights Passport v1
- `rights_confirmed=true`
- material type: original
- preflight: ready
- master owner: B.V.SStudios
- composition owner: BVSStudios
- contributors recorded and rights-confirmed
- release clearance evidence rows: 0
- distribution job: `private_dsp_partner:live_on_dsp`
- Uptown Wins has ISRC `SE6XY2585736`
- both tracks are marked explicit

Human evidence required before iOS clearance:
1. B.V.SStudios master-control/ownership basis for the release.
2. Composition authority / songwriter-publisher basis behind the `BVSStudios` composition-owner declaration.
3. Contributor authority covering Wolf Bridges and W.Hill$ where applicable.
4. Retain DSP delivery / identifier proof for Uptown Wins and, if available, equivalent delivery/identifier proof for Deep.
5. Confirm explicit-content metadata is intentionally correct.

### Release package: FRESHMAN MUSIK
Candidate tracks:
- OUTRO 1 — kniightcrawler
- LIFE GAVE ME LEMONS — kniightcrawler
- YOU ALREADY KNOWW — kniightcrawler

Database position:
- Rights Passport v1
- `rights_confirmed=true`
- material type: original
- preflight: ready
- master owner: Kniightcrawler
- composition owner: Kniightcrawler
- contributors recorded and rights-confirmed
- release clearance evidence rows: 0
- distribution status: not eligible
- no ISRC currently recorded on the three candidate track rows
- all three are marked explicit

Human evidence required before iOS clearance:
1. Direct master-control declaration/permission from Kniightcrawler suitable for BVS streaming/mobile distribution.
2. Composition/songwriter authority basis matching the Kniightcrawler declaration.
3. Confirm contributor/producer permissions represented by the release contributors.
4. No DSP/ISRC proof is required merely because iOS streaming is contemplated, but absence of external delivery evidence means the direct rights declaration must carry more weight.
5. Confirm explicit-content metadata is intentionally correct.

## Decision order

1. Close Heavy / Jegera / Thugging evidence gaps first.
2. Review Whisper II Drive evidence package.
3. Review FRESHMAN MUSIK evidence package.
4. Only after human approval, stage the selected track clearance rows in **beta** first.
5. Verify `GET /api/station/tracks?surface=ios` in beta.
6. Smoke playback, artwork, metadata and explicit-content handling.
7. Require explicit BVS approval before any production clearance write.

## Important distinction
A Rights Passport / preflight-ready state is a strong internal signal, but it is **not by itself the same thing as a durable external evidence pack**. The iOS clearance gate requires both a coherent rights declaration and enough retained evidence that BVS can explain the basis later.
