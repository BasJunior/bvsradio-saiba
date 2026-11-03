/** Canonical BeatStore genres. Uploaded free-text labels can contain mixed casing,
 * spelling variants and composite genres written with spaces or slashes.
 * Never collapse a distinct subtype (e.g. Alternative Trap) into Trap.
 */
const aliases: Record<string, string> = {
  hiphop: "hiphop",
  "hip hop": "hiphop",
  "hip-hop": "hiphop",
  rnb: "rnb",
  "r&b": "rnb",
  "r and b": "rnb",
  "r n b": "rnb",
  "r 'n' b": "rnb",
  "rhythm and blues": "rnb",
  afrobeats: "afrobeats",
  "afro beats": "afrobeats",
  trapsoul: "trapsoul",
  "trap soul": "trapsoul",
};

const labels: Record<string, string> = {
  hiphop: "Hip-Hop",
  rnb: "R&B",
  afrobeats: "Afrobeats",
  trapsoul: "Trap Soul",
  drill: "Drill",
  trap: "Trap",
  rap: "Rap",
  soul: "Soul",
  amapiano: "Amapiano",
  underground: "Underground",
  dancehall: "Dancehall",
};

function clean(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function single(value: string) {
  const normalized = clean(value).replace(/\s*-\s*/g, "-");
  return aliases[normalized] || normalized;
}

const simpleComponents = new Set([
  "hiphop", "rnb", "afrobeats", "trapsoul", "drill", "trap",
  "rap", "soul", "amapiano", "underground", "dancehall",
]);

/** Stable key for comparing labels and filtering all their variants. */
export function beatGenreKey(raw: string) {
  const normalized = clean(raw || "");
  if (!normalized) return "";
  // Any Hip-Hop combination belongs under the single Hip-Hop filter.
  // Includes Hip-Hop/Trap, Hip Hop + Drill, Hiphop R&B, etc.
  if (/(^|[^a-z0-9])hip[\s-]*hop(?=$|[^a-z0-9])/.test(normalized) ||
      /(^|[^a-z0-9])hiphop(?=$|[^a-z0-9])/.test(normalized)) {
    return "hiphop";
  }
  // Composite genres written with a separator: Hip-Hop/Trap, Hip Hop + Trap.
  const explicit = normalized.split(/\s*(?:\/|\+)\s*/);
  if (explicit.length > 1) {
    const parts = explicit.map(single);
    if (parts.every((part) => simpleComponents.has(part))) {
      return [...new Set(parts)].sort().join("/");
    }
  }
  // Also recognize the common two-genre space-only variants.
  const commonPairs: Array<[RegExp, string[]]> = [
    [/^hip[\s-]*hop\s+trap$/, ["hiphop", "trap"]],
    [/^trap\s+hip[\s-]*hop$/, ["hiphop", "trap"]],
    [/^hip[\s-]*hop\s+(?:rnb|r&b|r\s*n\s*b)$/, ["hiphop", "rnb"]],
    [/^(?:rnb|r&b|r\s*n\s*b)\s+hip[\s-]*hop$/, ["hiphop", "rnb"]],
    [/^trap\s+dancehall$/, ["trap", "dancehall"]],
    [/^dancehall\s+trap$/, ["trap", "dancehall"]],
  ];
  for (const [pattern, parts] of commonPairs) {
    if (pattern.test(normalized)) return parts.sort().join("/");
  }
  return single(normalized);
}

/** Display one consistent user-facing label per canonical genre. */
export function beatGenreLabel(key: string) {
  if (key.includes("/") && key.split("/").every((part) => simpleComponents.has(part))) {
    return key.split("/").map((part) => labels[part] || part).join(" / ");
  }
  if (labels[key]) return labels[key];
  return key.replace(/(^|[\s/-])\p{L}/gu, (match) => match.toLocaleUpperCase());
}
