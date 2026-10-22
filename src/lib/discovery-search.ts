/** Shared by Discover, native Explore and header suggestions. */
export function discoveryWords(value: string) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase()
    .replace(/\$/g, 's').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean)
}

/** A single edit (including transposition), only for words long enough to be useful. */
function nearWord(a: string, b: string) {
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false
  if (a.length === b.length) {
    const differences = [...a].map((c, i) => c === b[i] ? -1 : i).filter(i => i >= 0)
    return differences.length === 1 || (differences.length === 2 && differences[1] === differences[0] + 1 && a[differences[0]] === b[differences[1]] && a[differences[1]] === b[differences[0]])
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a]
  let i = 0
  while (i < short.length && short[i] === long[i]) i++
  return short.slice(i) === long.slice(i + 1)
}

/** Exact title > title prefix > phrase > all words in any order > conservative typo. */
export function discoveryQueryScore(query: string, values: Array<string | undefined>): number {
  const words = discoveryWords(query.slice(0, 160))
  if (!words.length) return query.trim() ? 0 : 1
  const fields = values.filter((v): v is string => Boolean(v)).map(value => discoveryWords(value).join(' '))
  const phrase = words.join(' '), compact = words.join('')
  if (fields[0] === phrase || fields[0]?.replaceAll(' ', '') === compact) return 1000
  if (fields[0]?.startsWith(phrase)) return 900
  if (fields.some(field => field.includes(phrase))) return 800
  if (fields.some(field => field.replaceAll(' ', '').includes(compact))) return 700
  const tokens = fields.join(' ').split(' ')
  let fuzzy = false
  for (const word of words) {
    if (tokens.some(token => token.includes(word))) continue
    if (!tokens.some(token => nearWord(word, token))) return 0
    fuzzy = true
  }
  return fuzzy ? 100 : 500
}

export function matchesDiscoveryQuery(query: string, values: Array<string | undefined>) {
  return discoveryQueryScore(query, values) > 0
}
