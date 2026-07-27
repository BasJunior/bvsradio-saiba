export function publicHandle(username?: string | null) {
  const clean = String(username || '').trim().replace(/^@+/, '')
  return clean ? `@${clean}` : 'BVS creator'
}

export function creatorPublicName(input: {
  publicName?: string | null
  publicNameStatus?: string | null
  username?: string | null
}) {
  // creator_public_name is written only by Editorial (or the trusted migration).
  // Keep the last approved name visible while a replacement request is pending.
  const approved = String(input.publicName || '').trim()
  return approved || publicHandle(input.username)
}
