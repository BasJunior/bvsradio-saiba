/**
 * Shared creator name/capability entitlements.
 * Account UI and /api/account PATCH must use the same rules.
 */

export type CreatorNameProfile = {
  role?: string | null
  is_producer?: boolean | null
}

export type CreatorAccessFlags = {
  artist?: boolean
  producer?: boolean
  admin?: boolean
  editorial?: boolean
}

/** Matches /api/auth/access artist flag: profile role artist, or admin/owner staff. */
export function isArtistNameCapable(
  profile?: CreatorNameProfile | null,
  access?: CreatorAccessFlags | null,
) {
  if (access?.artist || access?.admin) return true
  const role = String(profile?.role || '').toLowerCase()
  return role === 'artist' || role === 'admin'
}

/** Matches /api/auth/access producer flag: is_producer, or admin/owner staff. */
export function isProducerNameCapable(
  profile?: CreatorNameProfile | null,
  access?: CreatorAccessFlags | null,
) {
  if (access?.producer || access?.admin) return true
  if (profile?.is_producer === true) return true
  const role = String(profile?.role || '').toLowerCase()
  return role === 'admin'
}

/** Sentinel request value: clear approved producer public name after editorial approval. */
export const PRODUCER_NAME_USE_ARTIST = '__use_artist_name__'
