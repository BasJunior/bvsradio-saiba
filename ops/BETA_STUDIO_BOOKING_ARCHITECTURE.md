# BVS Studios — Beta architecture and product concept

## Product promise

**Book a studio session near you.**

BVS Studios is a specialized discovery layer inside Services Marketplace. It should feel as effortless as a modern travel marketplace while remaining specific to music creation: city-first discovery, studio map/list browsing, verified previous-client ratings, real creator packages, published availability and BVS booking requests.

The discovery flow is:

`Services Marketplace → BVS Studios → City / near me → Map + list → Studio → Package → Availability → Booking request → Confirmed session → Verified client rating`

## Architecture principle

Do not build a second marketplace.

The existing Creator Marketplace remains authoritative for:

- creator/provider identity
- service listings
- packages and prices
- seller entitlements
- availability slots
- booking requests
- future commerce/payment linkage

BVS Studios adds only the vertical-specific information that generic service providers do not need:

- city / country / neighborhood
- approximate or exact map pin
- studio amenities and room types
- capacity / starting rate
- gallery metadata
- studio verification state
- ratings tied to completed BVS sessions

## Data model

### `marketplace_studio_profiles`

One studio discovery profile per provider key. `owner_user_id` is optional so seeded BVS stores can exist before a creator account claims them. Public coordinates are rounded according to `location_precision` so “near me” works without forcing creators to publish exact addresses.

### `marketplace_studio_reviews`

One review per BVS booking request. A review can only be created by the authenticated buyer after a confirmed session has ended. This prevents self-awarded or imported fake star ratings. Public output never includes booking email/phone data.

Both tables are service-only: RLS enabled, no anon/authenticated grants, server routes only.

## Experience design

### Discovery surface `/marketplace/studios`

Desktop uses a sticky split layout: studio cards on the left and a synchronized BVS city map on the right. Mobile switches cleanly between list and map.

Core interactions:

- search by city / country / neighborhood
- city chips with real studio counts
- “Use my location” sorts to the nearest published studio coordinates and selects that studio city
- recording / mixing / mastering / production quick filters
- selected list card highlights the corresponding map pin
- price bubbles on map pins
- cards show approximate distance, verified badge, star rating or “New on BVS,” starting price and next published availability

The beta map deliberately uses BVS-owned lightweight rendering rather than committing the product to a third-party map vendor. The data contract exposes normal latitude/longitude so a later Mapbox/Google/MapLibre adapter can replace the renderer without changing studio/profile/booking schemas.

### Studio detail `/marketplace/studios/[slug]`

Optimized for a music buyer rather than a hotel guest:

- studio hero and BVS verification state
- location privacy label
- room types / amenities / specialties
- recording/session services
- creator-defined package tiers and prices
- package-specific booking CTA
- published availability
- verified client reviews
- review submission after a confirmed ended booking
- sticky booking panel

### Creator Marketplace

Approved creators with the `studio` role get a Studio Discovery Profile desk where they can set city, public area label, starting rate, amenities, room types, genres, capacity, timezone and optional map pin. The existing Marketplace Availability desk remains the only place that publishes real time slots.

## Privacy and trust

- No fake ratings or seeded stars.
- Reviews require a confirmed BVS booking and ended session.
- City/neighborhood coordinates are rounded in public API responses.
- Exact arrival details do not need to be public.
- Public review output never exposes client email, phone, order or provider secrets.
- Booking, listing and review errors are normalized at the API boundary.

## Package booking contract

A creator service can expose package tiers. The studio detail route carries `package=<index>` into booking. The booking API resolves the authoritative package from the published listing and freezes the selected package title/price into the booking request. The browser never gets to invent a package price.

## Beta acceptance

1. Services Marketplace exposes **Book a studio session near you**.
2. `/marketplace/studios` shows the number of published BVS studios in the selected city.
3. List and map selection stay synchronized.
4. “Use my location” works without external geocoding and never blocks city search.
5. Studio detail shows real packages/prices from Marketplace listings.
6. Package selection reaches booking with server-authoritative price.
7. Availability remains real published slots only.
8. Reviews display only for verified BVS sessions; empty state says New / no verified reviews.
9. Approved studio creators can manage discovery metadata in Creator Marketplace.
10. No production or Apple-review surface is touched.
