/**
 * Store-delivery pack — fields stores need before BVS can send a Premium release.
 * Public/artist copy never names the private aggregator.
 */

export const STORE_GENRES = [
  "Hip Hop/Rap",
  "Pop",
  "R&B/Soul",
  "Afrobeats",
  "Amapiano",
  "Dancehall",
  "Electronic",
  "Gospel",
  "Jazz",
  "Reggae",
  "Rock",
  "Folk",
  "World",
  "Sungura",
  "Zimdancehall",
  "Chimurenga",
  "Other",
] as const;

export const TRACK_VERSIONS = [
  { id: "original", label: "Original" },
  { id: "radio_edit", label: "Radio edit" },
  { id: "instrumental", label: "Instrumental" },
  { id: "live", label: "Live" },
  { id: "remix", label: "Remix" },
  { id: "extended", label: "Extended" },
] as const;

export const TRACK_ORIGINS = [
  { id: "original", label: "Original recording" },
  { id: "cover", label: "Cover of another song" },
  { id: "remix", label: "Remix of another recording" },
] as const;

export const STORE_LANGUAGES = [
  "English",
  "Shona",
  "Ndebele",
  "Instrumental",
  "Other",
] as const;

export type StoreDeliveryTrack = {
  releaseTrackId?: string;
  trackId?: string;
  title: string;
  version: string;
  origin: string;
  recordingYear: string;
  explicit: boolean;
  isrc: string;
  songwriters: string;
  producers: string;
  featuredArtists: string;
};

export type StoreDeliveryPack = {
  version: 1;
  releaseTitle: string;
  releaseType: "single" | "ep" | "album" | "mixtape" | "compilation";
  primaryArtist: string;
  featuredArtists: string;
  genre: string;
  labelName: string;
  language: string;
  explicit: boolean;
  releaseDate: string;
  originalReleaseDate: string;
  upc: string;
  alreadyReleased: boolean;
  territories: "worldwide" | "custom";
  tracks: StoreDeliveryTrack[];
};

export type PackIssue = { field: string; message: string };

const TEXT = (value: unknown, max = 200) => String(value || "").trim().slice(0, max);

export function defaultReleaseDate(daysAhead = 14) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

export function emptyPack(): StoreDeliveryPack {
  return {
    version: 1,
    releaseTitle: "",
    releaseType: "single",
    primaryArtist: "",
    featuredArtists: "",
    genre: "",
    labelName: "BVS",
    language: "English",
    explicit: false,
    releaseDate: defaultReleaseDate(),
    originalReleaseDate: "",
    upc: "",
    alreadyReleased: false,
    territories: "worldwide",
    tracks: [],
  };
}

export function sanitizePack(input: unknown): StoreDeliveryPack {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const releaseType = ["single", "ep", "album", "mixtape", "compilation"].includes(String(raw.releaseType || ""))
    ? (raw.releaseType as StoreDeliveryPack["releaseType"])
    : "single";
  const tracks = Array.isArray(raw.tracks) ? raw.tracks.slice(0, 30) : [];
  return {
    version: 1,
    releaseTitle: TEXT(raw.releaseTitle, 180),
    releaseType,
    primaryArtist: TEXT(raw.primaryArtist, 120),
    featuredArtists: TEXT(raw.featuredArtists, 240),
    genre: TEXT(raw.genre, 80),
    labelName: TEXT(raw.labelName, 80) || "BVS",
    language: TEXT(raw.language, 40) || "English",
    explicit: Boolean(raw.explicit),
    releaseDate: TEXT(raw.releaseDate, 10),
    originalReleaseDate: TEXT(raw.originalReleaseDate, 10),
    upc: TEXT(raw.upc, 20).replace(/\s+/g, ""),
    alreadyReleased: Boolean(raw.alreadyReleased),
    territories: raw.territories === "custom" ? "custom" : "worldwide",
    tracks: tracks.map((row) => {
      const track = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      return {
        releaseTrackId: TEXT(track.releaseTrackId, 80) || undefined,
        trackId: TEXT(track.trackId, 80) || undefined,
        title: TEXT(track.title, 180),
        version: TEXT(track.version, 40) || "original",
        origin: TEXT(track.origin, 40) || "original",
        recordingYear: TEXT(track.recordingYear, 4),
        explicit: Boolean(track.explicit),
        isrc: TEXT(track.isrc, 15).toUpperCase().replace(/[^A-Z0-9]/g, ""),
        songwriters: TEXT(track.songwriters, 240),
        producers: TEXT(track.producers, 240),
        featuredArtists: TEXT(track.featuredArtists, 240),
      };
    }),
  };
}

function daysUntil(dateValue: string) {
  const stamp = Date.parse(`${dateValue}T00:00:00Z`);
  if (!Number.isFinite(stamp)) return -999;
  return Math.floor((stamp - Date.now()) / 86_400_000);
}

export function validateStorePack(pack: StoreDeliveryPack): PackIssue[] {
  const issues: PackIssue[] = [];
  if (pack.releaseTitle.length < 1) issues.push({ field: "releaseTitle", message: "Add the release title exactly as it should appear on stores." });
  if (pack.primaryArtist.length < 1) issues.push({ field: "primaryArtist", message: "Add the main artist name stores should show." });
  if (!pack.genre) issues.push({ field: "genre", message: "Choose a genre." });
  if (!pack.labelName) issues.push({ field: "labelName", message: "Add a release label name." });
  if (!pack.language) issues.push({ field: "language", message: "Choose the main language of the lyrics (or Instrumental)." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pack.releaseDate) || daysUntil(pack.releaseDate) < 7) {
    issues.push({ field: "releaseDate", message: "Pick a store date at least 7 days from today so stores have time to review." });
  }
  if (pack.alreadyReleased && !pack.upc && pack.tracks.every((track) => !track.isrc)) {
    issues.push({ field: "alreadyReleased", message: "If this was already live elsewhere, add the existing UPC or each track’s ISRC so streams stay linked." });
  }
  if (!pack.tracks.length) issues.push({ field: "tracks", message: "This release needs at least one track." });
  pack.tracks.forEach((track, index) => {
    const n = index + 1;
    if (!track.title) issues.push({ field: `tracks.${index}.title`, message: `Track ${n}: add the title stores should show.` });
    if (!track.version) issues.push({ field: `tracks.${index}.version`, message: `Track ${n}: choose a version (original, remix, live…).` });
    if (!track.origin) issues.push({ field: `tracks.${index}.origin`, message: `Track ${n}: say whether this is an original, a cover or a remix.` });
    if (!/^\d{4}$/.test(track.recordingYear)) issues.push({ field: `tracks.${index}.recordingYear`, message: `Track ${n}: add the recording year.` });
    if (!track.songwriters) issues.push({ field: `tracks.${index}.songwriters`, message: `Track ${n}: name the songwriter(s).` });
    if (!track.producers) issues.push({ field: `tracks.${index}.producers`, message: `Track ${n}: name the producer(s).` });
  });
  return issues;
}

export function packIsComplete(pack: StoreDeliveryPack) {
  return validateStorePack(pack).length === 0;
}

export function mapBvsGenre(genre?: string | null) {
  const value = String(genre || "").trim();
  if (!value) return "";
  const aliases: Record<string, string> = {
    "hip-hop": "Hip Hop/Rap",
    hiphop: "Hip Hop/Rap",
    rap: "Hip Hop/Rap",
    "r&b": "R&B/Soul",
    rnb: "R&B/Soul",
    soul: "R&B/Soul",
  };
  const key = value.toLowerCase().replace(/\s+/g, "");
  if (aliases[key]) return aliases[key];
  return STORE_GENRES.find((item) => item.toLowerCase() === value.toLowerCase()) || value;
}

export function formatStoreSendSheet(pack: StoreDeliveryPack) {
  const lines = [
    "BVS store send sheet",
    "Use these values when creating the store release. Leave ISRC/UPC blank for brand-new recordings.",
    "",
    `Release title: ${pack.releaseTitle}`,
    `Release type: ${pack.releaseType}`,
    `Primary artist: ${pack.primaryArtist}`,
    `Featured artists: ${pack.featuredArtists || "—"}`,
    `Genre: ${pack.genre}`,
    `Label: ${pack.labelName}`,
    `Language: ${pack.language}`,
    `Explicit: ${pack.explicit ? "Yes" : "No"}`,
    `Store date: ${pack.releaseDate}`,
    `Original release date: ${pack.originalReleaseDate || "—"}`,
    `Already released elsewhere: ${pack.alreadyReleased ? "Yes" : "No"}`,
    `UPC: ${pack.upc || "(assign new)"}`,
    `Territories: ${pack.territories === "worldwide" ? "Worldwide" : "Custom"}`,
    "",
  ];
  pack.tracks.forEach((track, index) => {
    lines.push(`Track ${index + 1}`);
    lines.push(`  Title: ${track.title}`);
    lines.push(`  Version: ${track.version}`);
    lines.push(`  Origin: ${track.origin}`);
    lines.push(`  Recording year: ${track.recordingYear}`);
    lines.push(`  Explicit: ${track.explicit ? "Yes" : "No"}`);
    lines.push(`  ISRC: ${track.isrc || "(assign new)"}`);
    lines.push(`  Featured: ${track.featuredArtists || "—"}`);
    lines.push(`  Songwriters: ${track.songwriters}`);
    lines.push(`  Producers: ${track.producers}`);
    lines.push("");
  });
  return lines.join("\n").trim();
}
