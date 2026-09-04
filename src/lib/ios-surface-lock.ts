/**
 * iOS surface lock contract.
 *
 * 1.0 (3) remains the approved listener shell. App Store 1.1 is the deliberate
 * native release that may mount the vNext chrome (Create / You / contained
 * studio). Ordinary web deploys must not silently enable that chrome inside
 * already-installed 1.0 binaries.
 */

export const IOS_SURFACE_ROOT = "/app/ios";
export const IOS_APPSTORE_VNEXT_VERSION = "1.1";

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

/** Extra primary destinations for the 1.1 App Store update only. */
export const IOS_VNEXT_PRIMARY_PATHS = [
  "/app/ios/you",
  "/app/ios/join",
  "/app/ios/studio",
  "/app/ios/marketplace",
  "/app/ios/notifications",
  "/app/ios/support",
  "/app/ios/rooms",
] as const;

/** Extra contained prefixes for the 1.1 App Store update only. */
export const IOS_VNEXT_DETAIL_PREFIXES = [
  "/app/ios/studio/",
  "/app/ios/join/",
  "/app/ios/playlist/",
  "/app/ios/rooms/",
  "/app/ios/creator/",
  "/app/ios/show/",
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

export type IosAppEdition = "1.0" | "1.1";

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix.slice(0, -1) || pathname.startsWith(prefix);
}

export function isAllowedIosPathname(pathname: string, edition: IosAppEdition = "1.0"): boolean {
  if (!pathname.startsWith(IOS_SURFACE_ROOT)) return false;
  if (pathname === IOS_SURFACE_ROOT || pathname === `${IOS_SURFACE_ROOT}/`) return true;
  if (IOS_ALLOWED_PRIMARY_PATHS.includes(pathname as (typeof IOS_ALLOWED_PRIMARY_PATHS)[number])) {
    return true;
  }
  if (IOS_ALLOWED_DETAIL_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) return true;
  if (edition !== "1.1") return false;
  if (IOS_VNEXT_PRIMARY_PATHS.includes(pathname as (typeof IOS_VNEXT_PRIMARY_PATHS)[number])) return true;
  return IOS_VNEXT_DETAIL_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
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
