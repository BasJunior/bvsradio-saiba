export const SOCIETY_STATUSES = ["none", "member", "unsure"] as const;
export type SocietyStatus = (typeof SOCIETY_STATUSES)[number];
export type SocietyDeclarationInput = { societyStatus?: unknown; societyName?: unknown; grantAccepted?: unknown };
export type CleanSocietyDeclaration = { societyStatus: SocietyStatus; societyName: string | null; grantAccepted: boolean };
export type RightsDeclarationRow = {
  id?: string;
  release_id?: string | null;
  track_id?: string | null;
  society_status?: string | null;
  society_name?: string | null;
  grant_accepted_at?: string | null;
  spot_check_result?: string | null;
  spot_check_note?: string | null;
  spot_checked_at?: string | null;
  clearance_basis?: string | null;
  clearance_reference?: string | null;
};

export const RIGHTS_GRANT_VERSION = "BVS-ARTIST-GRANT-2026-11-09";
export const RIGHTS_GRANT_TEXT =
  "I give BVS permission to stream, list and promote this music on BVS platforms, including in rotation and on-demand listening. BVS will only use it in podcasts or live shows that feature me or promote my music, not in other artists’ shows. I control the rights to give this permission, and I will tell BVS if I or anyone who wrote this music joins a collecting society.";

/** Only what the versioned attestation on the release Confirm step doesn't already say. */
export const RELEASE_GRANT_VERSION = "BVS-ARTIST-GRANT-RELEASE-2026-11-09";
export const RELEASE_GRANT_TEXT =
  "BVS can play this release in rotation and on demand. BVS will only use it in podcasts or live shows that feature me or promote my music, not in other artists’ shows. I will tell BVS if I or anyone who wrote this music joins a collecting society.";

export function cleanSocietyDeclaration(input: SocietyDeclarationInput): CleanSocietyDeclaration | null {
  const societyStatus = String(input.societyStatus || "") as SocietyStatus;
  if (!SOCIETY_STATUSES.includes(societyStatus)) return null;
  const societyName = societyStatus === "none" ? "" : String(input.societyName || "").trim().slice(0, 120);
  return { societyStatus, societyName: societyName || null, grantAccepted: input.grantAccepted === true };
}

export const CLEARANCE_BASES = [
  ["society_consent", "Society’s written consent"],
  ["bvs_licence", "Covered by a BVS licence"],
] as const;

/** Streaming on BVS only. The artist's grant is always needed; a society's consent or a BVS licence covers the song rights. */
export function isRotationCleared(row?: RightsDeclarationRow | null) {
  if (!row?.grant_accepted_at) return false;
  if (row.clearance_basis) return true;
  return row.society_status === "none" && row.spot_check_result !== "found";
}

export function societySearchLinks(title: string) {
  const query = encodeURIComponent(title.trim());
  return [
    { label: "GEMA", href: "https://portal.gema.de/app/repertoiresuche/werksuche", copyFirst: true },
    { label: "BMI", href: `https://repertoire.bmi.com/Search/Search?Main_Search=Title&Main_Search_Text=${query}&Search_Type=all&View_Count=20&Page_Number=0`, copyFirst: false },
    { label: "Songview", href: "https://songview.com/", copyFirst: true },
  ];
}
