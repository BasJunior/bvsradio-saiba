/**
 * Published BeatStore vibes are free text. Treat lists of vibes as independent
 * tags, but keep compound terms such as "Laid-back" and "High Energy" intact.
 */
export function beatVibeKey(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-");
}

export function beatVibeTags(value: string | null | undefined): string[] {
  if (!value) return [];
  const unique = new Map<string, string>();
  const chunks = value
    .split(/\s*(?:[,;/|+]|(?:\s+&\s+)|(?:\s+and\s+))\s*/i)
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  for (const chunk of chunks) {
    const key = beatVibeKey(chunk);
    if (key && !unique.has(key)) unique.set(key, chunk);
  }
  return [...unique.values()];
}

export function beatVibeLabel(value: string): string {
  return beatVibeKey(value).replace(/(^|[\s/-])\p{L}/gu, (part) => part.toLocaleUpperCase());
}
