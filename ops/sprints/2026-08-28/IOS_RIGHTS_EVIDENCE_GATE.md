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
- uploaded/owned in BVS by the BasJunior creator account
- one verified BasJunior track credit
- rights basis recorded as founder-owned master
- evidence reference currently points to BVS Founder catalogue instruction, Telegram 18196, 2026-08-12
- clearance note explicitly says supporting master-rights documentation remains required for the Apple evidence pack
- **production editorial note says: `Heavier is a demo made by BasJunior still not mixed and mastered`**
- licence summary says `Still in progress`
- no later `Heavy` / `Heavier` track row was found in the production catalogue
- no linked release, release-clearance-evidence row or distribution job was found for this track

**Open gate — QUALITY + RIGHTS HOLD:**
1. Confirm whether this exact audio file is intentionally acceptable as the public/iOS version despite the existing demo/in-progress note.
2. If a later final master exists outside the current catalogue, ingest/review that version rather than treating this file as final.
3. If the current file is intentionally retained, add durable master-rights evidence and preserve the composition/songwriter authority basis.
4. Do not use Heavy as precedent for expanding iOS while this intent conflict remains unresolved.

Recommended operational stance: **review keep/replace/remove before adding new iOS tracks.** No production change is authorized by this document.

### Jegera — I Ratty
Current state:
- iOS cleared
- explicit
- track row is owned/uploaded by the BasJunior creator account
- credited public artist: I Ratty
- verified credits: I Ratty — Singer; Wolfbridges — Producer
- rights basis recorded as founder-owned master
- evidence reference currently points to the same founder catalogue instruction
- clearance note explicitly says supporting master-rights documentation remains required
- no linked release, release-clearance-evidence row or distribution job was found

**Open gate — THIRD-PARTY CONTROL:**
1. Document why BVS/BasJunior owns or controls the master despite the credited performing artist being I Ratty.
2. Retain direct authority/permission covering I Ratty's performance and BVS mobile/radio streaming use.
3. Retain producer/master authority involving Wolfbridges where applicable.
4. Record the composition/songwriter/publishing authority basis; verified performance/producer credits alone are not composition clearance.

This is the most important rights-control gap in the current five because the public artist and producer are third parties while the recorded rights basis says founder-owned master.

### Thugging — BasJunior
Current state:
- iOS cleared
- explicit
- uploaded/owned by the BasJunior creator account
- verified BasJunior artist credit
- rights basis recorded as founder-owned master
- evidence reference currently points to the founder catalogue instruction
- clearance note explicitly says supporting master-rights documentation remains required
- no linked release, release-clearance-evidence row or distribution job was found

**Open gate:**
1. Add a durable BasJunior/BVS master-control declaration or equivalent ownership record.
2. Preserve composition/songwriter/publishing authority basis.
3. Confirm no uncleared third-party beat/sample/material is present before treating the founder declaration as complete.

Of Heavy / Jegera / Thugging, this is currently the most straightforward evidence pack to close because the uploader, credited artist and asserted master controller align.

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

1. Decide whether the current Heavy file should remain iOS-cleared, be replaced by a final master, or be removed from the cleared set.
2. Close the Thugging durable master/composition pack.
3. Close the Jegera third-party master/performance/producer/composition pack.
4. Confirm the retained evidence pack for On the Moon / Party Tarpy remains accessible.
5. Review Whisper II Drive evidence package.
6. Review FRESHMAN MUSIK evidence package.
7. Only after human approval, stage the selected track clearance rows in **beta** first.
8. Verify `GET /api/station/tracks?surface=ios` in beta.
9. Smoke playback, artwork, metadata and explicit-content handling.
10. Require explicit BVS approval before any production clearance write.

## Important distinction
A Rights Passport / preflight-ready state is a strong internal signal, but it is **not by itself the same thing as a durable external evidence pack**. The iOS clearance gate requires both a coherent rights declaration and enough retained evidence that BVS can explain the basis later.
