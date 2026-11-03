/** Search-only BeatStore genre normalization. Never alter a beat's saved/displayed genre. */
const aliases: Record<string, string> = {
  hiphop: "hiphop", "hip hop": "hiphop", "hip-hop": "hiphop",
  rnb: "rnb", "r&b": "rnb", "r and b": "rnb", "r n b": "rnb",
  "r 'n' b": "rnb", "rhythm and blues": "rnb",
  afrobeats: "afrobeats", "afro beats": "afrobeats",
  trapsoul: "trapsoul", "trap soul": "trapsoul",
};
const labels: Record<string, string> = {
  hiphop: "Hip-Hop", rnb: "R&B", afrobeats: "Afrobeats",
  trapsoul: "Trap Soul", drill: "Drill", trap: "Trap",
  rap: "Rap", soul: "Soul", amapiano: "Amapiano",
  underground: "Underground", dancehall: "Dancehall",
};
function clean(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}
/** Normalize one individual genre, preserving distinct subgenres. */
export function beatGenreKey(value: string) {
  const normalized = clean(value).replace(/\s*-\s*/g, "-");
  return aliases[normalized] || normalized;
}
/** All searchable genres represented by an uploaded producer label.
 * Example: "Hip-Hop / Drill" -> ["hiphop", "drill"], without changing the label.
 */
export function beatGenreKeys(raw: string): string[] {
  const normalized = clean(raw || "");
  if (!normalized) return [];
  // Explicit multi-genre delimiters, including "&" surrounded by spaces.
  const parts = normalized.split(/\s*(?:\/|\+|,|\||;)\s*|\s+&\s+/g).filter(Boolean);
  const keys: string[] = [];
  const add = (value: string) => {
    const key = beatGenreKey(value);
    if (key && !keys.includes(key)) keys.push(key);
  };
  for (const part of parts) {
    const atomic = beatGenreKey(part);
    if (aliases[part] || labels[atomic]) {
      add(part);
      continue;
    }
    // Some uploads omit separators: "Hip Hop Drill" or "Trap Hip Hop".
    const hipHop = /(?:^|\s)(?:hip[\s-]*hop|hiphop)(?=$|\s)/;
    if (hipHop.test(part)) {
      add("hiphop");
      const remainder = part.replace(hipHop, " ").trim();
      if (remainder) add(remainder);
    } else {
      add(part);
    }
  }
  return keys;
}
export function beatGenreLabel(key: string) {
  if (labels[key]) return labels[key];
  return key.replace(/(^|[\s/-])\p{L}/gu, (match) => match.toLocaleUpperCase());
}
