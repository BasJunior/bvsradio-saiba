# Studio intent-first beta

Beta UX change based on creator feedback that posting a beat exposed too much of the BVS system at once.

## Front door

`/creator/studio` now asks what the creator wants to do first:

- Release music
- Sell a beat
- Offer a service

Advanced management stays available under `/creator/studio/manage`.

## Focused creation

- `/creator/studio/create/beat` uses a short beat flow: title/audio, price, optional details, rights confirmation. The creator does not need to build a separate Marketplace listing for the beat.
- `/creator/studio/create/release` isolates the existing release + Rights Passport submission from the rest of Studio.
- `/creator/studio/create/service` uses progressive seller setup. If a client-facing profile is not approved yet, only the essentials are requested before editorial review.

## Compatibility

Legacy `/creator/studio#...` deep links redirect to the equivalent anchor under `/creator/studio/manage#...`.

## Beta QA

1. Creator Studio opens the intent-first home on mobile and desktop.
2. Producer can submit a single beat without visiting Marketplace profile/listing screens.
3. Approved marketplace creator can submit a service from the focused flow.
4. Creator without an approved marketplace profile sees only the minimal client-facing setup.
5. Existing full Studio tools remain reachable and functional at `/creator/studio/manage`.
