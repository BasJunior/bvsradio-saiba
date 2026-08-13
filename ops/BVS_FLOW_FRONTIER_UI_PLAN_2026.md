# BVS Flow — Frontier UI Movement and Content Placement Plan

**Status:** Review proposal  
**Date:** 12 August 2026  
**Scope:** Listener-facing BVS web, PWA, iOS and Android editions  
**Product thesis:** BVS should feel like a living music world, not a collection of pages or a smaller Spotify.

## 1. Desired outcome

A listener can begin with one piece of content and naturally move through its real relationships without losing playback or orientation:

> track → artist → release → producer → beat → story/show → service

The interface must preserve four forms of continuity:

1. **Audio continuity** — playback, queue and mode survive navigation.
2. **Spatial continuity** — Back restores the exact rail, card and scroll position.
3. **Identity continuity** — every object uses the same name, artwork, credit and action language everywhere.
4. **Journey continuity** — BVS remembers the meaningful path taken through connected content.

Success is not “more animation.” Success is less disorientation, faster first play, deeper discovery and more qualified creator/commerce movement.

## 2. Current-state diagnosis

### What should be preserved

- `StationPlayerProvider` already provides global audio ownership, station/on-demand modes, queueing, history, autoplay, similarity, live refresh and media-session support.
- `PersistentPlayer` already survives route changes.
- Catalogue, BeatStore, published creators, articles, shows, services and library are real product surfaces.
- Public search already combines multiple published data sources.
- The dark BVS visual identity is credible and does not need a wholesale rebrand.

### What currently breaks the sense of one world

- Desktop navigation exposes many peer destinations: Listen, Music, Beats, Shows, Stories, Services, For Artists, Search, Library, Cart, Studio and Editorial.
- Mobile depends on a large drawer for most destinations and mixes listener, buyer and creator operations.
- The mobile app edition has a separate top-link model instead of a native-feeling primary shell.
- Home explains paths well but places explanatory and institutional content above much of the live catalogue.
- Track, beat, artist, story, show and service cards do not share a predictable anatomy or action model.
- Search is a page rather than a universal layer and its visible taxonomy understates beats, producers, services and stories.
- Creator pages are long profile pages, not relationship hubs.
- Small actions often require route changes rather than contextual sheets.
- Player expansion currently prioritizes queue control; it is not yet a connected Now Playing world.
- Relationship data exists in several models, but there is no single public content-graph contract.
- Motion is mostly local hover/transition behavior rather than a documented system.

## 3. The BVS Flow model

### Four persistent listener zones

The new listener shell has four stable zones:

1. **Global navigation** — Home, Explore, Beats/Marketplace, Library.
2. **Content canvas** — the current rail, object or collection.
3. **Persistent player** — always available after a playable object is selected.
4. **Transient layer** — Search, action sheet, queue, filters or object quick view.

Only the content canvas normally changes route. Search and minor actions open above it. Playback never belongs to a page lifecycle.

### Recommended primary navigation

#### Mobile/PWA/app

- **Home** — personalized/editorial entry surface.
- **Explore** — music, artists, releases, shows and stories.
- **Beats** — BeatStore and producer discovery. Use `Marketplace` later only if non-beat creator products/services reach sufficient density.
- **Library** — saves, follows, history and continue listening.

Search is a prominent top action, not a fifth bottom item. Account/avatar opens the identity and workspace switcher.

#### Desktop

- Left: BVS identity.
- Centre: Home, Explore, Beats, Library.
- Right: Search, cart, notifications, account/workspace.
- Radio status and playback live in the persistent player rather than consuming a permanent primary-nav label.

The player must still expose an unmistakable **Live BVS**/station control. Systemic does not mean hidden.

### Workspace separation

Listener navigation must not compete with operational navigation.

Account/avatar opens a workspace switcher:

- Listener
- Creator Studio, when authorized
- Writer Desk, when authorized
- Editorial, when authorized
- Administration, when authorized

Switching workspace changes the shell and navigation context; it does not add more listener-navigation links.

## 4. Placement specification

### Home

Home becomes content-first and state-aware.

#### New visitor order

1. Compact BVS identity + immediate **Listen live** action.
2. Live on BVS / current station state.
3. New and featured music.
4. Fresh from BeatStore.
5. Artists and producers to know.
6. Stories and shows behind the sound.
7. Short “What BVS is” explanation.
8. Creator/services paths and FAQ lower down.

#### Returning listener order

1. Continue listening.
2. Live on BVS.
3. New from followed creators.
4. Because you explored/listened to…
5. Editorial picks / Zimbabwe next.
6. Fresh BeatStore and behind-the-sound stories.

Do not invent personalization when data is sparse. Fall back to transparent editorial, recency and relationship rules.

### Explore

Explore is the main connected discovery surface, not a renamed catalogue.

- Top: universal search trigger and lightweight filter chips.
- Editorial feature with a clear primary action.
- Rails: New this week, BVS rotation, Zimbabwe next, Releases, Producers to watch, Shows, Stories.
- Optional dense browse mode beneath rails for users who want lists/filters.
- Filters update the URL and browser history so states are shareable and restorable.

### Beats

BeatStore keeps its commercial distinction from ordinary music.

- Preview is the primary media action; licence is the primary commercial action.
- Cards expose producer, BPM, key, mood/genre and starting price.
- Never imply BeatStore publication means radio rotation.
- Producer identity is always a navigable relationship.
- Filters: genre, mood, BPM range, key, price, producer and newest/featured.
- Pack membership is visible without replacing the individual beat identity.

### Library

Library becomes the continuity centre:

- Continue listening
- Saved tracks/releases/beats
- Followed artists/producers/shows
- Recently played
- Queue history where appropriate
- Purchased/licensed content for signed-in users

Local-device history and account-synced history must be clearly distinguished until sync is complete.

### Creator universe

Unify artist and producer pages into one adaptable creator surface:

- **Overview** — identity, follow, current highlight and key relationships.
- **Music** — tracks and releases.
- **Credits** — performed, produced, written, mixed, mastered and featured.
- **Beats** — only when the creator publishes beats.
- **Products** — creator products when present.
- **Services** — bookable services when present.
- **Stories** — articles, interviews and show appearances.

Tabs with no published content remain hidden. Role emphasis changes placement, not the fundamental component system.

### Now Playing World

Tapping the persistent player opens a layered Now Playing surface:

1. Artwork, title, artist and essential transport controls.
2. Playing source and an understandable “why this is playing.”
3. Save, follow, share and overflow actions.
4. Queue/history tab.
5. Verified credits and release context.
6. Related creator, music, story/show and marketplace relationships.

The first screen remains emotionally simple. Metadata and commerce appear progressively below or in tabs/sheets.

## 5. Universal object and card language

Every public object implements one `BvsObject` presentation contract:

- stable object ID and kind
- canonical route
- title and supporting identity
- artwork/media
- context label
- primary action
- overflow actions
- relationship edges
- rights/availability state
- analytics context

### Predictable card anatomy

1. Media/artwork zone
2. Object-kind/context label
3. Identity/title zone
4. Useful metadata
5. Primary action
6. Overflow action (`•••`)

Variants share behavior:

- `compact-row` — search, queue and dense lists
- `rail-card` — home/explore horizontal rails
- `feature-card` — editorial hero placement
- `grid-card` — catalogue and BeatStore browse
- `relationship-card` — related content inside creator/Now Playing views

Do not let each page invent a new play button, overflow menu, artwork ratio or metadata order.

## 6. Contextual action system

Use one accessible action-sheet primitive.

### Track/release

- Play now
- Play next
- Add to queue
- Save
- Go to artist/release
- View credits
- Share

### Beat

- Preview
- View licence
- Play next/add preview to queue only if player semantics support preview boundaries
- Go to producer
- Similar beats
- Save
- Share

### Creator

- Follow
- Play music
- View beats/products/services when present
- View credits
- Share

On mobile this is a bottom sheet. On desktop it is an anchored popover or side sheet. Keyboard focus, Escape, screen-reader naming and focus restoration are mandatory.

Long press may be an enhancement, never the only way to open actions.

## 7. Search as BVS Command

The visible user action remains **Search**. Internally the component can be called BVS Command.

- Open from any listener screen.
- `/` keyboard shortcut on desktop when focus is not in an input.
- Results grouped by Tracks, Releases, Creators, Beats, Shows, Stories and Services.
- Each result exposes one direct action where useful: Play, Preview, Follow, View licence or Book.
- Recent searches and recently opened objects appear before typing.
- Query and group selection can become a full shareable results route when needed.
- Log privacy-safe search-to-result, search-to-play and no-result events.

Search must degrade to the current full page if overlay JavaScript fails.

## 8. Content graph foundation

Build this before the visual redesign expands.

### Canonical node types

- creator
- track
- release
- beat
- story
- show/episode
- product
- service

### Canonical edge types

- performed_by
- released_on
- produced_by
- written_by
- mixed_by
- mastered_by
- featured_on
- discussed_in
- appeared_on
- offered_by
- related_to
- part_of_pack

Each edge includes verification/publication state and source. Only publish relationships that are editorially verified or explicitly safe.

Expose a typed server-side relationship API such as:

`GET /api/graph/:kind/:id?include=creator,credits,stories,beats,services`

The API may initially adapt existing tables. Do not block the first vertical slice on a graph database; Postgres relationship tables/views are sufficient.

## 9. Movement and state contract

### Route behavior

- Opening a full object pushes browser history.
- Closing a transient sheet does not destroy the underlying route state.
- Back closes the top transient layer before leaving the page.
- Returning to a discovery surface restores scroll position, selected rail, filters and focused card.
- Deep links load the same object state without requiring a previous screen.
- Player state is not stored in route components.

### Scene Trail

First implement a typed exploration-history service:

- meaningful opens only, not every click
- deduplicate repeated adjacent objects
- maximum recent path length
- session persistence with optional account sync later
- privacy controls and clearing

Only after navigation restoration works, expose Scene Trail as a compact visual history. It must complement browser Back, never replace it.

### View transitions

Adopt progressively:

- Start with player morph, sheets, card activation and route scroll restoration.
- Use the View Transitions API for supported same-origin routes after testing Safari/WebView/Chromium behavior.
- Every transition has a non-animated fallback.
- Never delay navigation waiting for decorative animation.

## 10. Motion design system

Motion communicates hierarchy and origin.

### Tokens

- **Micro:** 120–180ms — press, toggle, icon, selection.
- **Navigation:** 220–320ms — sheets, popovers, tab/rail changes.
- **Immersive:** 350–500ms — player expansion and carefully selected object transitions.
- Standard easing: decelerate on entry, accelerate on exit; springs only for direct manipulation.

### Rules

- Animate transform and opacity by default; avoid layout-triggering properties.
- One dominant motion per transition.
- Artwork may scale/move; text should mostly fade/translate subtly.
- No continuous decorative motion behind reading or controls.
- `prefers-reduced-motion` removes spatial travel and keeps short fades/state changes.
- Gesture-driven surfaces track the finger and settle predictably; cancellation returns to the original state.

## 11. Responsive placement

### Mobile

- Bottom navigation above safe-area inset.
- Persistent mini-player sits immediately above bottom navigation.
- Expanded player uses full-height sheet/page semantics.
- Minimum 44×44px targets; primary actions in thumb reach.
- Horizontal rails use snap points but retain visible next-card affordance.
- Sheets avoid covering the currently important control without a clear dismiss path.

### Tablet/foldable

- Use available width for master-detail layouts, not stretched phone cards.
- Rail/detail or creator/sidebar combinations at appropriate container widths.
- Support posture changes without resetting playback or navigation state.

### Desktop

- Denser grids and optional right-side detail/queue panels.
- Hover previews supplement rather than replace click/focus behavior.
- Persistent player can expand into a right panel or centred immersive layer based on viewport.

Use container queries for reusable cards; do not make every component depend on viewport breakpoints.

## 12. Accessibility, performance and resilience budgets

### Accessibility gates

- WCAG 2.2 AA target.
- Fully operable with keyboard and screen reader.
- Visible focus and logical focus restoration after sheets/navigation.
- No hover-only or gesture-only function.
- Reduced motion and sufficient contrast in dark/light themes.
- Announce player state changes without noisy time-update announcements.
- Bottom navigation, tabs, sheets and progress controls use correct semantics.

### Performance gates

- Preserve Core Web Vitals: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 at the 75th percentile on target mobile traffic.
- UI motion must maintain approximately 60fps on representative mid-range Android hardware.
- Lazy-load lower rails and heavyweight relationship panels.
- Avoid shipping all search/catalogue data to the client; move toward indexed server search and paginated groups.
- Artwork uses stable dimensions, responsive sizes and appropriate caching.
- Player provider must not cause broad application rerenders on every audio time update; profile and split state selectors if necessary.

### Resilience

- Core links and content remain useful without overlay JavaScript.
- Audio errors provide recovery and preserve queue context.
- Empty relationships disappear cleanly rather than rendering dead tabs.
- Offline/PWA behavior clearly separates cached content from unavailable streams.

## 13. Measurement model

Establish baselines before the redesign.

### Primary metric

**Discovery Depth:** number of distinct, meaningful, related objects opened after the first content interaction in a session.

Report its distribution, not only its average, and exclude accidental opens.

### Guardrail and supporting metrics

- time to first play
- search to play/preview
- player interruption/failure rate
- track → creator transition
- creator → track/release transition
- creator → beat/service transition
- story/show → creator/music transition
- save, follow and queue-add rate
- beat preview → licence view → checkout
- Back restoration success
- navigation abandonment
- search no-result rate
- Core Web Vitals and accessibility failures

Do not optimize Discovery Depth at the expense of successful listening, comprehension or purchase intent.

## 14. Professional rollout

All work flows through ephemeral preview → protected staging → production. Test write-heavy journeys only against isolated staging services.

### Phase 0 — Release, evidence and baseline (1–2 weeks)

- Establish preview/staging/production promotion workflow.
- Define event taxonomy and current journey baselines.
- Add performance and accessibility budgets to CI.
- Inventory canonical IDs and relationship sources.
- Test current player continuity and route restoration failures.

**Exit:** staging is safe; baseline dashboard exists; critical journeys are documented.

### Phase 1 — Graph and UI primitives (2–4 weeks)

- Define `BvsObject`, card variants and action contracts.
- Create accessible sheet/popover primitive.
- Create relationship API adapter over current data.
- Add navigation-state/scroll restoration service.
- Create motion tokens and reduced-motion behavior.
- Instrument object opens and relationship transitions.

**Exit:** one object renders consistently in search, rail, creator page and relationship panel.

### Phase 2 — One complete vertical slice (2–3 weeks)

Implement and test:

> Home/Explore track → play → Now Playing → artist → verified producer → producer beat preview → Back/Scene history

- Preserve audio, queue, scroll and focus throughout.
- Use real published BVS data.
- Validate on iPhone/iPad, representative Android, keyboard desktop and reduced motion.

**Exit:** the signature BVS journey works end to end and improves measured movement without harming playback.

### Phase 3 — Shell and placement (2–4 weeks)

- Mobile bottom navigation and mini-player placement.
- Simplified desktop navigation.
- Account/workspace switcher.
- Content-first Home and connected Explore.
- Beats primary surface.
- Expanded Now Playing World.

**Exit:** listener paths are coherent across web/PWA/app and operational tools are separated.

### Phase 4 — Connected creator and universal search (3–5 weeks)

- Adaptive creator universe.
- Credits and relationship views.
- Universal Search/Command overlay with full-page fallback.
- Related content panels across track/release/story/show/service surfaces.

**Exit:** every published object can lead somewhere meaningful through verified relationships.

### Phase 5 — Editorial intelligence (after data sufficiency)

- Continue listening and followed-creator updates.
- Editorial/personalized hybrid rails.
- Diversity and emerging-creator quotas.
- Transparent “why recommended” labels.
- Recommendation quality and cold-start fallbacks.

**Exit:** discovery improves for returning users without burying emerging creators.

### Phase 6 — Frontier layer

- Visual Scene Trail.
- Progressive artwork-to-object transitions.
- Ambient Now Playing artwork treatment.
- Advanced direct-manipulation gestures.
- Desktop side panels and adaptive tablet/foldable layouts.

**Exit:** frontier behavior passes performance, accessibility and comprehension tests; otherwise it remains experimental.

## 15. Acceptance criteria for every shipped slice

- Starts from a real user job, not an animation demo.
- Uses canonical published data and verified relationships.
- Playback and queue survive the journey.
- Browser Back, deep links and scroll restoration behave correctly.
- Keyboard, screen reader and reduced-motion paths work.
- Meets performance budgets on representative hardware.
- Has analytics that prove whether the movement improved.
- Has empty, loading, error and offline states.
- Is reviewed on protected staging before production promotion.
- Can be rolled back by deployment/commit without data loss.

## 16. Explicit non-goals

- Rebuilding the audio engine before evidence demands it.
- Copying Spotify navigation or recommendation behavior wholesale.
- Rebranding BVS before fixing movement and relationships.
- A graph database merely to claim “content graph.”
- AI personalization without sufficient events, catalogue density and editorial controls.
- Gesture-only navigation.
- A months-long big-bang redesign.
- Shared-element motion on every card or route.
- Mixing creator/editorial operations into primary listener navigation.

## 17. First implementation recommendation

Do not start by replacing the homepage or navbar globally.

Start with the vertical slice in Phase 2 on staging using:

1. one featured published track with verified artist and producer relationships;
2. the existing persistent player;
3. the new universal card and action sheet;
4. an upgraded artist/producer relationship view;
5. one published BeatStore preview;
6. exact Back/scroll restoration and transition analytics.

This slice proves the BVS advantage in a form users can feel. Once it works, the new shell and Home placement can extend a validated interaction model rather than speculate about one.

## Final product rule

> Every movement should either preserve context or reveal a meaningful verified relationship. If it does neither, it does not belong in BVS Flow.
