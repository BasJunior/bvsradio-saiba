import 'server-only'

export type PublicArtist = { id: string; username: string; name: string; role: string; bio: string; image: string; tracks: Array<{ id: string; title: string; genre?: string; artwork_url?: string; credits: Array<{ person_name: string; credit_role: string }> }> }

const fallback: Record<string, PublicArtist> = {
  'bvs-radio': { id: 'bvs-radio', username: 'bvs-radio', name: 'BVS Radio', role: 'Station artist', bio: 'Original recordings and restored cuts from the BVS archive. Credits and release details will be expanded as the archive is documented.', image: '/music/Bvs-3000x3000%202.png', tracks: [] },
  wolfbrx: { id: 'wolfbrx', username: 'wolfbrx', name: 'WolfBrx', role: 'Producer', bio: 'Producer behind beats currently available in the BVS catalogue. This profile will grow with verified credits, releases and artist-provided links.', image: '/images/musicians.jpg', tracks: [] },
  wolfbridges: { id: 'wolfbridges', username: 'wolfbridges', name: 'Wolfbridges', role: 'Artist', bio: 'Artist behind STRAIGHTENIN, HOWLING IN THE HILLS 2, WOLF BEEN BAD and related BVSRadio playlist features now surfaced in catalogue discovery.', image: '/images/albums/straightenin.jpg', tracks: [] },
  whills: { id: 'whills', username: 'whills', name: 'W.Hills', role: 'Artist', bio: 'Collaborator on Wolfbridges projects featured in the BVS catalogue, including HOWLING IN THE HILLS 2.', image: '/images/albums/howling-in-the-hills-2.jpg', tracks: [] },
  'i-ratty': { id: 'i-ratty', username: 'i-ratty', name: 'I Ratty', role: 'Artist', bio: 'Collaborator on Wolfbridges releases featured through BVS catalogue discovery, including WOLF BEEN BAD.', image: '/images/albums/wolf-been-bad.jpg', tracks: [] },
}

export async function getPublicArtist(slug: string): Promise<PublicArtist | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return fallback[slug] || null
  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  try {
    const profileResponse = await fetch(`${url}/rest/v1/profiles?username=ilike.${encodeURIComponent(slug)}&is_published=eq.true&select=id,username,display_name,bio,avatar_url,role&limit=1`, { headers, next: { revalidate: 60 } })
    if (!profileResponse.ok) return fallback[slug] || null
    const profiles = await profileResponse.json()
    const profile = profiles[0]
    if (!profile) return fallback[slug] || null
    const tracksResponse = await fetch(`${url}/rest/v1/tracks?user_id=eq.${profile.id}&is_public=eq.true&editorial_status=eq.approved&select=id,title,genre,artwork_url&order=created_at.desc`, { headers, next: { revalidate: 60 } })
    const tracks = tracksResponse.ok ? await tracksResponse.json() : []
    const ids = tracks.map((track: { id: string }) => track.id)
    let credits: Array<{ track_id: string; person_name: string; credit_role: string }> = []
    if (ids.length) {
      const creditsResponse = await fetch(`${url}/rest/v1/track_credits?track_id=in.(${ids.join(',')})&is_verified=eq.true&select=track_id,person_name,credit_role`, { headers, next: { revalidate: 60 } })
      if (creditsResponse.ok) credits = await creditsResponse.json()
    }
    return { id: profile.id, username: profile.username, name: profile.display_name || profile.username, role: profile.role === 'artist' ? 'BVS artist' : profile.role, bio: profile.bio || 'Verified artist on BVS Radio.', image: profile.avatar_url || '/assets/images/default-avatar.png', tracks: tracks.map((track: { id: string; title: string; genre?: string; artwork_url?: string }) => ({ ...track, credits: credits.filter(credit => credit.track_id === track.id) })) }
  } catch { return fallback[slug] || null }
}
