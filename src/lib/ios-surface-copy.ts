import { assertPlainIosCopy, type IosCopyKey } from "./ios-surface-lock";

/**
 * Server-side copy lane for the locked iOS listen surface.
 *
 * Structural behaviour (routes, buttons that navigate to new product areas,
 * player contracts) is NOT controlled here. Only plain display strings.
 *
 * Editorial may change these strings without a native binary when the change
 * is copy-only. Anything that needs a new control or destination is out of band.
 */
const RAW_IOS_SURFACE_COPY: Record<IosCopyKey, string> = {
  homeEyebrow: "Live on BVS · iPhone and iPad",
  homeTitle: "Start listening.",
  homeTrackCount: "cleared recording",
  homeEmptyTitle: "More music is on the way",
  homeEmptyBody: "The BVS team is preparing the next rights-cleared selection for this edition.",
  homeFeaturedEyebrow: "Featured music",
  homeFeaturedTitle: "Cleared for this edition",
  homeFeaturedDescription: "Play from the card. Playback stays with you while you move.",
  homeBeatsEyebrow: "BeatStore",
  homeBeatsTitle: "Beats from BVS producers",
  homeBeatsDescription: "Preview here. Licence on the full BVS website listing.",
  homePeopleTitle: "Artists to know",
  homeShowsTitle: "Shows around the scene",
  homeStoriesTitle: "Stories",
  homeAboutEyebrow: "BVS Radio",
  homeAboutBody:
    "A focused listening edition of BVS. Accounts and library stay connected with the full site while the native listening catalogue remains rights-gated.",
  accountSignedInBody:
    "This App Store surface keeps account access limited to listener identity and session controls. Creator, editorial, finance and administrative tools remain on the BVS website and are not native app features.",
  accountSignInBody: "Use the review account from App Review Information or your BVS listener account.",
  beatsEmptyTitle: "Published beats will appear here",
  beatsEmptyBody: "BeatStore listings are added after BVS Editorial approval.",
  libraryEmptyFavourites: "Save tracks you want to find again.",
  libraryEmptyFollows: "Follow artists as their BVS profiles go live.",
  libraryEmptyHistory: "Tracks you open from BVS search will appear here.",
};

function freezeCopy(raw: Record<IosCopyKey, string>): Readonly<Record<IosCopyKey, string>> {
  const out = {} as Record<IosCopyKey, string>;
  for (const key of Object.keys(raw) as IosCopyKey[]) {
    out[key] = assertPlainIosCopy(raw[key], key);
  }
  return Object.freeze(out);
}

export const IOS_SURFACE_COPY = freezeCopy(RAW_IOS_SURFACE_COPY);

export function iosTrackCountLabel(count: number): string {
  if (count <= 0) return "Selection in progress";
  const unit = IOS_SURFACE_COPY.homeTrackCount;
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}
