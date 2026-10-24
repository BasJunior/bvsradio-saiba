export const CRATE_LIMIT = 25;
export const CRATE_CHALLENGE = "25-beat-crate-2026";
// Archived campaign. Keep uploads independent; see docs/archive/beat-crate-challenge.md.
export const CRATE_CHALLENGE_ACTIVE = false;
export function currentCratePayload(payload: CratePayload): CratePayload {
  return { ...payload, challenge: CRATE_CHALLENGE_ACTIVE && payload.challenge };
}
export type CrateItem = {
  id: string;
  title: string;
  mood: string;
  bpm: string;
  musicalKey: string;
  price: string;
  previewPath: string | null;
  masterPath: string | null;
  artworkPath: string | null;
  previewName?: string;
  masterName?: string;
  artworkName?: string;
  audioHash?: string;
};
export type CratePayload = {
  title: string;
  description: string;
  genre: string;
  rights: boolean;
  challenge: boolean;
  artworkPath: string | null;
  artworkName?: string;
  items: CrateItem[];
};
export type CrateDraft = {
  id: string;
  payload: CratePayload;
  updated_at: string;
  state: string;
  result?: { count: number; beatIds: string[]; packId: string | null };
};
export type CrateProgress = {
  approved: number;
  pending: number;
  changes: number;
  drafts: number;
  hasPhoto: boolean;
  producer: boolean;
  instagram: string;
  submittedAt: string | null;
  readyForVerification: boolean;
};
export const newCrateItem = (): CrateItem => ({
  id: crypto.randomUUID(),
  title: "",
  mood: "",
  bpm: "",
  musicalKey: "",
  price: "29",
  previewPath: null,
  masterPath: null,
  artworkPath: null,
});
export const newCratePayload = (): CratePayload => ({
  title: "",
  description: "",
  genre: "Hip-Hop",
  rights: false,
  challenge: false,
  artworkPath: null,
  items: [newCrateItem()],
});
export function instagramHandle(value: string) {
  return value.trim().replace(/^@/, "");
}
export function validInstagram(value: string) {
  return /^[A-Za-z0-9._]{1,30}$/.test(instagramHandle(value));
}
export function titleFromFile(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_]+/g, " ")
    .trim()
    .slice(0, 160);
}
export function crateValidation(
  payload: CratePayload,
  submit: boolean,
): string | null {
  if (
    !Array.isArray(payload.items) ||
    payload.items.length < 1 ||
    payload.items.length > CRATE_LIMIT
  )
    return "Choose 1–25 beats per submission.";
  if (
    new Set(payload.items.map((item) => item.id)).size !== payload.items.length
  )
    return "Each beat needs its own row.";
  if (!submit) return null;
  if (!payload.rights)
    return "Confirm that you control the rights to every beat.";
  for (let i = 0; i < payload.items.length; i++) {
    const item = payload.items[i];
    const label = `Beat ${i + 1}`;
    if (!item.title.trim()) return `${label}: add a title.`;
    if (
      !Number.isFinite(Number(item.price)) ||
      Number(item.price) < 1 ||
      Number(item.price) > 9999
    )
      return `${label}: set a lease price from US$1 to US$9,999.`;
    if (
      item.bpm &&
      (!Number.isFinite(Number(item.bpm)) ||
        Number(item.bpm) < 1 ||
        Number(item.bpm) > 999)
    )
      return `${label}: BPM must be between 1 and 999.`;
    if (!item.previewPath) return `${label}: upload a tagged preview.`;
    if (CRATE_CHALLENGE_ACTIVE && payload.challenge && !(item.artworkPath || payload.artworkPath))
      return `${label}: add cover art for your challenge entry.`;
  }
  const hashes = payload.items.map((i) => i.audioHash).filter(Boolean);
  if (new Set(hashes).size !== hashes.length)
    return "The same audio appears more than once. Remove duplicate beats.";
  return null;
}
export function crateProgress(
  beats: Array<{
    status: string;
    preview_path?: string | null;
    submitted_at?: string | null;
    created_at?: string;
  }>,
  profile: { avatar_url?: string; is_producer?: boolean },
  instagram = "",
): CrateProgress {
  // Editorial remains responsible for originality, quality and disguised duplicates.
  const seen = new Set<string>();
  const approved = beats.filter(
    (b) =>
      ["approved", "published"].includes(b.status) &&
      b.preview_path &&
      !seen.has(b.preview_path) &&
      Boolean(seen.add(b.preview_path)),
  );
  const dates = approved
    .map((b) => b.submitted_at || b.created_at || "")
    .filter(Boolean)
    .sort();
  const hasPhoto = Boolean(
    profile.avatar_url &&
    !/default-avatar|placeholder/i.test(profile.avatar_url),
  );
  return {
    approved: approved.length,
    pending: beats.filter((b) => ["submitted", "in_review"].includes(b.status))
      .length,
    changes: beats.filter((b) =>
      ["changes_requested", "rejected"].includes(b.status),
    ).length,
    drafts: beats.filter((b) => b.status === "draft").length,
    hasPhoto,
    producer: profile.is_producer === true,
    instagram,
    submittedAt: dates.length >= 25 ? dates[24] : null,
    readyForVerification:
      approved.length >= 25 &&
      hasPhoto &&
      profile.is_producer === true &&
      validInstagram(instagram),
  };
}
