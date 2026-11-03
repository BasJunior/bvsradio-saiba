# Local homepage restoration review

Compared the current homepage with the 2 November 20:33 checkpoint `fc62387` and the preserved release `9072c03`.

Restored locally:
- Audio-services offer carousel: mixing, mastering and mix/master packages. Uses existing service data, checkout identifiers, package links and offer analytics.
- Creator offer carousel: Studio, BeatStore and music submission.
- BVS Original video caption and Studio/discovery links.

Both offers sit beneath the video in the left hero column; the listening room stretches alongside it. Rotation uses a shared hook: visible cards only, every 10 seconds; pause for hover, keyboard focus, hidden pages and reduced motion. Choosing a slide pauses rotation until Resume. Existing commerce tracking and booking paths are retained.

Other differences identified:
- Yesterday's four-card HomePathways navigation is absent. Today's listener/creator closing section and existing navigation cover these routes, so it was not duplicated.
- Yesterday's Worth a listen and Your BVS/daily-discovery blocks were explicitly removed in today's review; they remain removed.
- The older video used HomeMediaStage; today's inline video retains its layout while restoring the missing caption/actions.
- The current artist/release/producer order, compact beat cards, footer and Ask BVS work are retained.

## Release scope

Included in the 3 November deployment alongside the latest BeatStore work from origin/main:
- Balanced homepage columns, restored offers and artist catalogue/producer-beat recommendations with artwork; fallback BeatStore discoveries are shuffled per catalogue load.
- Discover search/filter panel, artwork shelves, inline Trending cards and repaired media-route artwork delivery.
- Gentle opt-in scrolling on Home portrait and Discover artwork rails, with pause controls, interaction/reduced-motion handling and offscreen suspension.
- Stationary web Library collections with visible category navigation, collection search/sort, list/grid views, filtered playback and playlist search.
- Ask BVS preference and navigation routing, clear missing-catalogue responses and title-versus-artist disambiguation.

Validation: release test chain and production build; targeted lint/type checks; local Discover search/arrows/artwork and Library save/search/clear/remove interactions. Temporary guest Library test saves were removed. Premium model generation remains dependent on a configured model credential; no credentials or environment files are included.
