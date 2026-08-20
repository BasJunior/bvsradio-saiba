export function publicHandle(username?: string | null) {
  const clean = String(username || '').trim().replace(/^@+/, '')
  return clean ? `@${clean}` : 'BVS creator'
}

/** Normalize producer/artist slugs for URL and filter matching. */
export function normalizeCreatorKey(value?: string | null) {
  return String(value || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

/**
 * Legacy account handles that must never appear as customer-facing creator names.
 * Keys are normalized; values are preferred public handles.
 */
const LEGACY_HANDLE_ALIASES: Record<string, string> = {
  bvsadmin: 'basjunior',
  admin: 'basjunior',
  basjunior: 'basjunior',
  'bas-junior': 'basjunior',
  wolfbrx: 'wolf-bridges',
  wolfbridges: 'wolf-bridges',
}

/** Account usernames that may back a public creator handle (profile lookup). */
const PUBLIC_HANDLE_ACCOUNT_CANDIDATES: Record<string, string[]> = {
  basjunior: ['basjunior', 'BasJunior', 'admin', 'bvsadmin', 'bvs-admin'],
  'wolf-bridges': ['wolf-bridges', 'wolfbridges', 'wolfbrx'],
}

export function resolvePublicHandle(value?: string | null) {
  const raw = String(value || '').trim().replace(/^@+/, '')
  if (!raw) return ''
  const alias = LEGACY_HANDLE_ALIASES[normalizeCreatorKey(raw)]
  return alias || raw
}

/** Usernames to try when loading a public artist page by slug. */
export function publicHandleAccountCandidates(value?: string | null): string[] {
  const resolved = resolvePublicHandle(value)
  if (!resolved) return []
  const key = normalizeCreatorKey(resolved)
  const extras = PUBLIC_HANDLE_ACCOUNT_CANDIDATES[key] || PUBLIC_HANDLE_ACCOUNT_CANDIDATES[resolved.toLowerCase()] || []
  const ordered = [resolved, ...extras, String(value || '').trim().replace(/^@+/, '')]
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of ordered) {
    const clean = String(item || '').trim()
    if (!clean) continue
    const token = clean.toLowerCase()
    if (seen.has(token)) continue
    seen.add(token)
    out.push(clean)
  }
  return out
}

export function creatorPublicName(input: {
  publicName?: string | null
  publicNameStatus?: string | null
  username?: string | null
}) {
  // creator_public_name is written only by Editorial (or the trusted migration).
  // Keep the last approved name visible while a replacement request is pending.
  const approved = String(input.publicName || '').trim()
  if (approved) return approved
  return publicHandle(resolvePublicHandle(input.username) || input.username)
}

/** Artist-facing public name (tracks, artist profile, search artist cards). */
export function artistPublicName(input: {
  publicName?: string | null
  publicNameStatus?: string | null
  username?: string | null
}) {
  return creatorPublicName(input)
}

/**
 * Producer-facing public name (BeatStore, producer profile, beat cards).
 * Falls back to the artist/creator public name when a separate producer name
 * has not been approved yet, then to @username.
 */
export function producerPublicName(input: {
  producerPublicName?: string | null
  producerNameStatus?: string | null
  publicName?: string | null
  publicNameStatus?: string | null
  username?: string | null
}) {
  const approvedProducer = String(input.producerPublicName || '').trim()
  if (approvedProducer) return approvedProducer
  return creatorPublicName({
    publicName: input.publicName,
    publicNameStatus: input.publicNameStatus,
    username: input.username,
  })
}

export function producerKeysMatch(filter?: string | null, ...candidates: Array<string | null | undefined>) {
  const wanted = normalizeCreatorKey(resolvePublicHandle(filter) || filter)
  if (!wanted) return true
  return candidates.some((candidate) => {
    const resolved = normalizeCreatorKey(resolvePublicHandle(candidate) || candidate)
    return Boolean(resolved) && resolved === wanted
  })
}
