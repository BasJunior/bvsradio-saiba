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
  bvsadmin: 'BasJunior',
  admin: 'BasJunior',
  wolfbrx: 'wolf-bridges',
  wolfbridges: 'wolf-bridges',
}

export function resolvePublicHandle(value?: string | null) {
  const raw = String(value || '').trim().replace(/^@+/, '')
  if (!raw) return ''
  const alias = LEGACY_HANDLE_ALIASES[normalizeCreatorKey(raw)]
  return alias || raw
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

export function producerKeysMatch(filter?: string | null, ...candidates: Array<string | null | undefined>) {
  const wanted = normalizeCreatorKey(resolvePublicHandle(filter) || filter)
  if (!wanted) return true
  return candidates.some((candidate) => {
    const resolved = normalizeCreatorKey(resolvePublicHandle(candidate) || candidate)
    return Boolean(resolved) && resolved === wanted
  })
}
