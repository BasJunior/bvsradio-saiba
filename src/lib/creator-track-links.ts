import 'server-only'

export type LinkedCredit = { track_id: string; person_name: string; credit_role: string; profile_url?: string }

// Editorial links a credit to a public profile explicitly. Names alone can be
// ambiguous and must never transfer ownership, earnings, or mobile clearance.
export async function getLinkedCreatorCredits(): Promise<LinkedCredit[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return []
  const result: LinkedCredit[] = []
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(`${url}/rest/v1/track_credits?is_verified=eq.true&profile_url=not.is.null&select=track_id,person_name,credit_role,profile_url&order=id&offset=${offset}&limit=1000`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 60 },
    })
    if (!response.ok) return result
    const rows = await response.json() as LinkedCredit[]
    result.push(...rows)
    if (rows.length < 1000) return result
  }
}

export function creditLinksToCreator(credit: LinkedCredit, username: string) {
  try {
    const url = new URL(credit.profile_url || '', 'https://bvsradio.com')
    if (!['bvsradio.com', 'www.bvsradio.com'].includes(url.hostname)) return false
    return decodeURIComponent(url.pathname).replace(/\/$/, '').toLowerCase() === `/artist/${username.toLowerCase()}`
  } catch { return false }
}

export async function creatorTrackFilter(id: string, username: string) {
  const credits = await getLinkedCreatorCredits()
  const ids = [...new Set(credits.filter(credit => creditLinksToCreator(credit, username)).map(credit => credit.track_id))]
    .filter(trackId => /^[0-9a-f-]{36}$/i.test(trackId))
  return ids.length ? `or=(user_id.eq.${id},id.in.(${ids.join(',')}))` : `user_id=eq.${id}`
}
