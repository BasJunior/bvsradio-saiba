/**
 * iOS surface lock contract (Candidate 03 — 2026-08-28).
 *
 * Goal: keep https://bvsradio.com/app/ios a deliberately controlled listener
 * surface so ordinary web product deploys cannot silently change the installed
 * App Store experience.
 *
 * This module is documentation + machine-checkable allow/deny lists.
 * It must not invent routes, buttons, or product functionality by itself.
 */

export const IOS_SURFACE_ROOT = "/app/ios";

/** Primary destinations already approved in the live listener shell. */
export const IOS_ALLOWED_PRIMARY_PATHS = [
  "/app/ios",
  "/app/ios/explore",
  "/app/ios/beats",
  "/app/ios/library",
  "/app/ios/account",
  "/app/ios/artists",
] as const;

/** Contained detail prefixes already part of the native listen edition. */
export const IOS_ALLOWED_DETAIL_PREFIXES = [
  "/app/ios/track/",
  "/app/ios/beat/",
  "/app/ios/artist/",
] as const;

/**
 * Product surfaces that must not be imported, linked, or mounted inside the
 * iOS shell unless a separate deliberate App Store release approves them.
 */
export const IOS_FORBIDDEN_PRODUCT_MARKERS = [
  "Creator Studio",
  "Song Workspace",
  "Lyrics Pad",
  "/creator/studio",
  "/creator/studio/songs",
  "src/components/SongWorkspace",
  "src/components/QuickBeatCreate",
  "src/components/QuickServiceCreate",
  "src/app/creator/studio",
  "src/app/admin/editorial",
  "song-workspaces",
] as const;

/**
 * Copy/content keys may only hold plain display strings.
 * Values must never contain pathnames, hrefs, markdown links, or executable UI.
 */
export type IosCopyKey =
  | "homeEyebrow"
  | "homeTitle"
  | "homeTrackCount"
  | "homeEmptyTitle"
  | "homeEmptyBody"
  | "homeFeaturedEyebrow"
  | "homeFeaturedTitle"
  | "homeFeaturedDescription"
  | "homeBeatsEyebrow"
  | "homeBeatsTitle"
  | "homeBeatsDescription"
  | "homePeopleTitle"
  | "homeShowsTitle"
  | "homeStoriesTitle"
  | "homeAboutEyebrow"
  | "homeAboutBody"
  | "accountSignedInBody"
  | "accountSignInBody"
  | "beatsEmptyTitle"
  | "beatsEmptyBody"
  | "libraryEmptyFavourites"
  | "libraryEmptyFollows"
  | "libraryEmptyHistory";

export function isAllowedIosPathname(pathname: string): boolean {
  if (!pathname.startsWith(IOS_SURFACE_ROOT)) return false;
  if (pathname === IOS_SURFACE_ROOT || pathname === `${IOS_SURFACE_ROOT}/`) return true;
  if (IOS_ALLOWED_PRIMARY_PATHS.includes(pathname as (typeof IOS_ALLOWED_PRIMARY_PATHS)[number])) {
    return true;
  }
  return IOS_ALLOWED_DETAIL_PREFIXES.some(
    (prefix) => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix),
  );
}

/** Reject copy that could inject navigation or new product UI. */
export function assertPlainIosCopy(value: string, key: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`ios copy "${key}" must be non-empty plain text`);
  }
  if (/https?:\/\//i.test(trimmed) || /javascript:/i.test(trimmed)) {
    throw new Error(`ios copy "${key}" must not include URLs or javascript:`);
  }
  if (trimmed.includes("</") || trimmed.includes("<script") || trimmed.includes("{{")) {
    throw new Error(`ios copy "${key}" must not include markup/templates`);
  }
  // Paths and product route tokens are not allowed in the copy lane.
  if (/(^|\s)\/[a-z0-9_-]+/i.test(trimmed) || trimmed.includes("/app/") || trimmed.includes("/creator/")) {
    throw new Error(`ios copy "${key}" must not include route paths`);
  }
  return value;
}
