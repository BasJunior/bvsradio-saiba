/**
 * BeatStore's published mood field is free text. Some producers submit
 * comma-separated mood lists, others use prose, genres or names instead.
 * Only recognized mood descriptors are offered as filter options.
 *
 * A single beat may index into several moods. Multi-word descriptors such as
 * "Laid Back" and "Night Drive" stay intact.
 */
const MOODS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "Laid Back", pattern: /\blaid[\s-]*back\b/gi },
  { label: "Night Drive", pattern: /\bnight[\s-]*drive\b/gi },
  { label: "Boss Energy", pattern: /\bboss[\s-]*energy\b/gi },
  { label: "Raw Energy", pattern: /\braw[\s-]*energy\b/gi },
  { label: "Turn Up", pattern: /\bturn[\s-]*up\b/gi },
  { label: "Ambient", pattern: /\bambient\b/gi },
  { label: "Aggressive", pattern: /\baggressive\b/gi },
  { label: "Chill", pattern: /\bchill(?:\s*[- ]?\s*vibes?)?\b|\bchillvibes?\b/gi },
  { label: "Dark", pattern: /\bdark\b/gi },
  { label: "Dance", pattern: /\bdance\b/gi },
  { label: "Energetic", pattern: /\benergetic\b|\bhigh[\s-]*energy\b/gi },
  { label: "Hype", pattern: /\bhyp(?:e|ed)\b|\blit\b/gi },
  { label: "Melodic", pattern: /\bmelodic\b/gi },
  { label: "Hard", pattern: /\bhard\b/gi },
  { label: "Heavy", pattern: /\bheavy\b/gi },
  { label: "Soulful", pattern: /\bsoulful\b/gi },
  { label: "Smooth", pattern: /\bsmooth\b/gi },
  { label: "Emotional", pattern: /\bemotional\b/gi },
  { label: "Cinematic", pattern: /\bcinematic\b/gi },
  { label: "Gritty", pattern: /\bgritty\b/gi },
  { label: "Intense", pattern: /\bintense\b/gi },
  { label: "Sinister", pattern: /\bsinister\b/gi },
  { label: "Haunting", pattern: /\bhaunting\b/gi },
  { label: "Mysterious", pattern: /\bmysterious\b/gi },
  { label: "Menacing", pattern: /\bmenacing\b/gi },
  { label: "Cold", pattern: /\bcold\b/gi },
  { label: "Raw", pattern: /\braw\b/gi },
  { label: "Powerful", pattern: /\bpowerful\b/gi },
  { label: "Confident", pattern: /\bconfident\b/gi },
  { label: "Cool", pattern: /\bcool\b/gi },
  { label: "Romantic", pattern: /\bromantic\b/gi },
  { label: "Sexy", pattern: /\bsexy\b/gi },
  { label: "Flirty", pattern: /\bflirty\b/gi },
  { label: "Summer", pattern: /\bsummer\b/gi },
  { label: "Street", pattern: /\bstreet\b/gi },
  { label: "Savage", pattern: /\bsavage\b/gi },
  { label: "Hustler", pattern: /\bhustler\b/gi },
  { label: "Euphoric", pattern: /\beuphoric\b/gi },
  { label: "Futuristic", pattern: /\bfuturistic\b/gi },
  { label: "Experimental", pattern: /\bexperimental\b/gi },
  { label: "Nostalgic", pattern: /\bnostalgic\b/gi },
  { label: "Mystic", pattern: /\bmystic\b/gi },
  { label: "Spacey", pattern: /\bspacey\b/gi },
  { label: "Uplifting", pattern: /\buplifting\b/gi },
  { label: "Happy", pattern: /\bhappy\b/gi },
  { label: "Sad", pattern: /\bsad\b/gi },
  { label: "Slow", pattern: /\bslow\b/gi },
];

// These are legitimate two-word mood phrases, not two independent tags.
// The regex list is evaluated longest-phrase-first; consumed spans are removed
// before single-word matching to avoid accidentally manufacturing extra moods.
const COMPOUND = new Set(["Laid Back", "Night Drive", "Boss Energy", "Raw Energy", "Turn Up"]);

/** A stable, case-insensitive key for filter values. */
export function beatVibeKey(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase()
    .replace(/#/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*vibes?$/i, "");
}

/** Return the vetted moods associated with this beat's original free text. */
export function beatVibeTags(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  // Separators, hashtags and descriptive labels must not become selectable tags.
  let remaining = value.normalize("NFKC").replace(/#/g, " ");
  const found = new Set<string>();
  for (const entry of MOODS) {
    if (entry.pattern.test(remaining)) {
      found.add(entry.label);
      if (COMPOUND.has(entry.label)) remaining = remaining.replace(entry.pattern, " ");
    }
    entry.pattern.lastIndex = 0;
  }
  return [...found];
}

/** Standard dropdown label, including intentionally multiword moods. */
export function beatVibeLabel(value: string): string {
  const key = beatVibeKey(value);
  return MOODS.find((entry) => beatVibeKey(entry.label) === key)?.label || "";
}

/** One catalogue for filter recognition and upload suggestions. */
export const beatVibeSuggestions = MOODS.map(mood => mood.label);
