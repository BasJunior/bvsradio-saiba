/**
 * Public BeatStore moods are free-form text, often several vibes in one field.
 * Index every meaningful term separately so selecting any one of them still
 * finds beats originally uploaded with a combined mood.
 */
export function beatVibeKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/#/g, "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/(?:vibes?|moods?)$/i, "")
    .replace(/[^a-z0-9\u00c0-\u024f]/gi, "");
}

/**
 * Split hashtags, slash-/comma-/ampersand-separated text and plain multiword
 * fields. A compound source ("Dark Chill Vibes", "Dark/Chill", "#Dark #Chill")
 * contributes both "Dark" and "Chill" to that beat's searchable tags.
 */
export function beatVibeTags(value: string | null | undefined): string[] {
  if (!value) return [];
  const normalized = value.normalize("NFKC")
    .replace(/([a-z0-9])#(?=[a-z])/gi, "$1 #")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[,;/|+&_\-]+/g, " ")
    .replace(/#/g, " ")
    .trim();
  const unique = new Map<string, string>();
  for (const part of normalized.split(/\s+/)) {
    const key = beatVibeKey(part);
    if (!key || key === "vibe" || key === "mood" || key === "and" || key === "the") continue;
    if (!unique.has(key)) unique.set(key, key);
  }
  return [...unique.values()];
}

export function beatVibeLabel(value: string): string {
  const key = beatVibeKey(value);
  return key ? key[0].toLocaleUpperCase() + key.slice(1) : "";
}
