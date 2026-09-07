import { NextResponse } from 'next/server'
import {
  createSongWorkspace,
  createFreeSongWorkspace,
  findBeatEntitlement,
  listOwnSongWorkspaces,
  presentSongWorkspace,
  songWorkspaceUser,
  songWorkspacesConfigured,
} from '@/lib/song-workspaces-server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  if (!songWorkspacesConfigured()) {
    return NextResponse.json({ error: 'Song Workspace is not configured yet.', workspaces: [] }, { status: 503 })
  }
  const user = await songWorkspaceUser(request)
  if (!user?.id) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

  const rows = await listOwnSongWorkspaces(user.id)
  const workspaces = await Promise.all(rows.map((row) => presentSongWorkspace(row)))
  return NextResponse.json({ workspaces })
}

export async function POST(request: Request) {
  try {
    if (!songWorkspacesConfigured()) {
      return NextResponse.json({ error: 'Song Workspace is not configured yet.' }, { status: 503 })
    }
    const user = await songWorkspaceUser(request)
    if (!user?.id) return NextResponse.json({ error: 'Sign in before opening Lyrics Pad.' }, { status: 401 })

    const body = await request.json().catch(() => ({})) as { orderReference?: string; beatId?: string }
    const orderReference = String(body.orderReference || '').trim().slice(0, 100)
    const beatId = String(body.beatId || '').trim()
    if (!orderReference && !beatId) {
      const created = await createFreeSongWorkspace(user)
      if (!created.row) return NextResponse.json({ error: 'Could not open Lyrics Pad.' }, { status: 500 })
      return NextResponse.json({ workspace: await presentSongWorkspace(created.row, created.entitlement, false) })
    }
    if (!orderReference || !/^[0-9a-f-]{36}$/i.test(beatId)) {
      return NextResponse.json({ error: 'Choose a purchased beat licence.' }, { status: 400 })
    }

    const entitlement = await findBeatEntitlement(user.id, orderReference, beatId)
    if (!entitlement) {
      return NextResponse.json({ error: 'A paid BVS beat licence for this account is required.' }, { status: 403 })
    }

    const row = await createSongWorkspace(user.id, entitlement)
    if (!row) return NextResponse.json({ error: 'Could not open Song Workspace.' }, { status: 500 })
    return NextResponse.json({ workspace: await presentSongWorkspace(row, entitlement, true) })
  } catch (error) {
    console.error('song workspace create', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not open Song Workspace.' }, { status: 500 })
  }
}
