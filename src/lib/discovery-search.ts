/** Match public names and handles, including stylized spellings such as Hill$. */
export function matchesDiscoveryQuery(query: string, values: Array<string | undefined>) {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return true
  const text = values.filter(Boolean).join(' ').toLocaleLowerCase()
  if (text.includes(needle)) return true
  const normalize = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').replace(/\$/g, 's').replace(/[^\p{L}\p{N}]+/gu, '')
  const key = normalize(needle)
  return Boolean(key) && normalize(text).includes(key)
}
