import { NextResponse } from 'next/server'
import {
  findBeatEntitlement,
  getOwnSongWorkspace,
  presentSongWorkspace,
  songWorkspaceUser,
  songWorkspacesConfigured,
  updateOwnSongWorkspace,
} from '@/lib/song-workspaces-server'

export const runtime = 'nodejs'

async function loadActive(request: Request, id: string) {
  if (!songWorkspacesConfigured()) return { error: 'Song Workspace is not configured yet.', status: 503 as const }
  const user = await songWorkspaceUser(request)
  if (!user?.id) return { error: 'Sign in required.', status: 401 as const }
  const row = await getOwnSongWorkspace(user.id, id)
  if (!row) return { error: 'Song Workspace not found.', status: 404 as const }
  const entitlement = await findBeatEntitlement(user.id, row.order_reference, row.beat_id)
  if (!entitlement) {
    return { error: 'This workspace is not available to this account. Your writing is preserved; contact BVS if this is unexpected.', status: 403 as const }
  }
  return { user, row, entitlement }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = (await params).id
  const loaded = await loadActive(request, id)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  return NextResponse.json({ workspace: await presentSongWorkspace(loaded.row, loaded.entitlement, true) })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = (await params).id
  const loaded = await loadActive(request, id)
  if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status })

  const body = await request.json().catch(() => ({})) as {
    songTitle?: string
    lyrics?: string
    notes?: string
    status?: string
  }
  const patch: {
    song_title?: string
    lyrics?: string
    notes?: string
    status?: 'draft' | 'ready_to_release'
  } = {}
  if (body.songTitle !== undefined) patch.song_title = String(body.songTitle || '').slice(0, 160)
  if (body.lyrics !== undefined) patch.lyrics = String(body.lyrics || '').slice(0, 60000)
  if (body.notes !== undefined) patch.notes = String(body.notes || '').slice(0, 20000)
  if (body.status !== undefined) {
    if (!['draft', 'ready_to_release'].includes(String(body.status))) {
      return NextResponse.json({ error: 'Invalid workspace status.' }, { status: 400 })
    }
    patch.status = String(body.status) as 'draft' | 'ready_to_release'
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 })

  const updated = await updateOwnSongWorkspace(loaded.user.id, id, patch)
  if (!updated) return NextResponse.json({ error: 'Could not save Song Workspace.' }, { status: 500 })
  return NextResponse.json({ workspace: await presentSongWorkspace(updated, loaded.entitlement, false) })
}
