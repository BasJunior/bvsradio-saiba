import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: Request) {
  try {
    // Verify authentication from Authorization header
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Authentication required. Please sign in first.' }, { status: 401 })
    }

    // Verify token with Supabase
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!userRes.ok) {
      return NextResponse.json({ error: 'Invalid session. Please sign in again.' }, { status: 401 })
    }

    const userData = await userRes.json()
    const userId = userData.id

    const formData = await req.formData()
    const title = formData.get('title') as string
    const genre = formData.get('genre') as string
    const description = (formData.get('description') as string) || ''
    const audioFile = formData.get('audio') as File
    const artworkFile = formData.get('artwork') as File | null

    if (!title || !genre || !audioFile) {
      return NextResponse.json({ error: 'Title, genre, and audio file are required' }, { status: 400 })
    }

    // Upload audio file to Supabase Storage
    const audioBuffer = await audioFile.arrayBuffer()
    const audioExt = audioFile.name.split('.').pop() || 'mp3'
    const audioPath = `tracks/${userId}/${Date.now()}-audio.${audioExt}`

    const audioUploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/bvsradio-audio/${audioPath}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': audioFile.type,
        'x-upsert': 'true',
      },
      body: audioBuffer,
    })

    if (!audioUploadRes.ok) {
      const errText = await audioUploadRes.text()
      return NextResponse.json({ error: `Audio upload failed: ${errText}` }, { status: 500 })
    }

    const audioUrl = `${SUPABASE_URL}/storage/v1/object/public/bvsradio-audio/${audioPath}`

    // Upload artwork if provided
    let artworkUrl = '/assets/images/default-artwork.jpg'
    if (artworkFile) {
      const artBuffer = await artworkFile.arrayBuffer()
      const artExt = artworkFile.name.split('.').pop() || 'jpg'
      const artPath = `tracks/${userId}/${Date.now()}-artwork.${artExt}`

      const artUploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/bvsradio-audio/${artPath}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': artworkFile.type,
          'x-upsert': 'true',
        },
        body: artBuffer,
      })

      if (artUploadRes.ok) {
        artworkUrl = `${SUPABASE_URL}/storage/v1/object/public/bvsradio-audio/${artPath}`
      }
    }

    // Get user profile for display name
    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=username,display_name`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    })
    const profiles = await profileRes.json()
    const profile = profiles?.[0] || {}
    const artistName = profile.display_name || profile.username || 'Unknown Artist'

    // Insert track record
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/tracks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        user_id: userId,
        title,
        genre,
        description,
        artist_name: artistName,
        file_url: audioUrl,
        artwork_url: artworkUrl,
        is_public: false,
        is_featured: false,
        play_count: 0,
        like_count: 0,
      }),
    })

    if (!insertRes.ok) {
      const errText = await insertRes.text()
      return NextResponse.json({ error: `Database insert failed: ${errText}` }, { status: 500 })
    }

    const track = await insertRes.json()

    return NextResponse.json({
      message: 'Track uploaded successfully. Pending review.',
      track: Array.isArray(track) ? track[0] : track,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 })
  }
}