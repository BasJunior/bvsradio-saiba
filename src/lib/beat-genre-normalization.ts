/** Search-only BeatStore genre indexing. Never rewrite or relabel producer beat metadata. */
const aliases: Record<string, string> = {
  "hiphop": "hiphop", "hip hop": "hiphop", "hip-hop": "hiphop",
  "rnb": "rnb", "r&b": "rnb", "r and b": "rnb", "r n b": "rnb",
  "r 'n' b": "rnb", "rhythm and blues": "rnb",
  "afrobeats": "afrobeats", "afro beats": "afrobeats",
  "trapsoul": "trapsoul", "trap soul": "trapsoul",
};
const labels: Record<string, string> = {
  hiphop: "Hip-Hop", rnb: "R&B", afrobeats: "Afrobeats",
  trapsoul: "Trap Soul", drill: "Drill", trap: "Trap", rap: "Rap",
  soul: "Soul", amapiano: "Amapiano", underground: "Underground",
  dancehall: "Dancehall",
};
const recognized = [
  "rhythm and blues", "hip-hop", "hip hop", "hiphop", "afro beats",
  "trap soul", "trapsoul", "afrobeats", "dancehall", "underground",
  "amapiano", "r and b", "r 'n' b", "r n b", "r&b", "rnb",
  "drill", "trap", "rap", "soul",
] as const;

function clean(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

/** One genre, with common spellings unified. Preserve legitimate subgenres. */
export function beatGenreKey(value: string): string {
  const normalized = clean(value).replace(/\s*-\s*/g, "-");
  return aliases[normalized] || normalized;
}

function genresInPart(part: string): string[] {
  const exact = beatGenreKey(part);
  if (aliases[part] || labels[exact]) return [exact];

  // Disregard descriptions claiming every genre without actually naming any.
  if (/^(?:every|all)\s+genres?\b/.test(part) || /\byou can imagine\b/.test(part)) return [];

  // Find named genres even without separators: "Hip-Hop TRAP", "Trap Dancehall".
  // Keep "Alternative Trap" as its own genre, rather than splitting out "Trap".
  const matches: { start: number; end: number; key: string }[] = [];
  let cursor = 0;
  while (cursor < part.length) {
    let found: { end: number; key: string } | null = null;
    for (const phrase of recognized) {
      if (!part.startsWith(phrase, cursor)) continue;
      const end = cursor + phrase.length;
      const before = cursor === 0 ? " " : part[cursor - 1];
      const after = end === part.length ? " " : part[end];
      if (!/[\s(/+&,;|]/.test(before) || !/[\s)/+&,;|]/.test(after)) continue;
      found = { end, key: beatGenreKey(phrase) };
      break;
    }
    if (found) {
      matches.push({ start: cursor, end: found.end, key: found.key });
      cursor = found.end;
    } else cursor++;
  }

  if (matches.length >= 2) {
    // Only split fully described known-genre combinations. Unknown filler is
    // ignored; it must not turn into fake dropdown entries.
    const remainder = [...part];
    for (const match of matches) remainder.fill(" ", match.start, match.end);
    if (!remainder.join("").trim()) return [...new Set(matches.map((match) => match.key))];
  }
  // If part contains only a single known genre plus irrelevant prose, index
  // that known genre but never manufacture genres from the prose.
  if (matches.length === 1 && /(?:\bgenre\b|\btype beat\b)/.test(part)) {
    return [matches[0].key];
  }
  return exact ? [exact] : [];
}

/** Each constituent genre gets an independent search entry.
 * "Hip-Hop / Trap / Drill" -> ["hiphop","trap","drill"].
 */
export function beatGenreKeys(raw: string): string[] {
  const normalized = clean(raw || "");
  if (!normalized) return [];
  const sections = normalized.split(/\s*(?:\/|\+|,|\||;|•)\s*|\s+&\s+/g).filter(Boolean);
  const result = new Set<string>();
  for (const section of sections) {
    for (const key of genresInPart(section)) {
      if (key && key !== "all" && key !== "genre" && key !== "genres") result.add(key);
    }
  }
  return [...result];
}

export function beatGenreLabel(key: string): string {
  if (labels[key]) return labels[key];
  return key.replace(/(^|[\s/-])\p{L}/gu, (match) => match.toLocaleUpperCase());
}
