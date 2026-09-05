import { authUserId, serviceHeaders } from '@/lib/storage-upload'
import { creatorPublicName } from '@/lib/public-name'
import { publicStorageUrl } from '@/lib/beatstore-server'
import { r2KeyFromMediaUrl, safeR2Key, signedR2DownloadUrl } from '@/lib/r2-storage'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export type SongWorkspaceRow = {
  id: string
  user_id: string
  order_id: string
  order_reference: string
  beat_id: string
  licence_option_id?: string | null
  beat_title_snapshot: string
  producer_name_snapshot?: string | null
  licence_code_snapshot?: string | null
  licence_summary_snapshot?: string | null
  licence_terms_version_snapshot?: string | null
  song_title: string
  lyrics: string
  notes: string
  status: 'draft' | 'ready_to_release' | 'released'
  release_id?: string | null
  created_at: string
  updated_at: string
}

type PurchasedBeatItem = {
  id?: string
  sourceId?: string
  type?: string
  productType?: string
  title?: string
  artist?: string
  licence_option_id?: string
  licenceOptionId?: string
  licenceCode?: string
  licenceSummary?: string
  licenceTermsVersion?: string
  workspaceKind?: 'blank' | 'licensed'
  price?: number
}

type OrderRow = {
  id: string
  reference: string
  customer_user_id: string
  status: string
  items: PurchasedBeatItem[]
}

type BeatRow = {
  id: string
  title: string
  producer_user_id: string
  artwork_path?: string | null
  preview_path?: string | null
  master_path?: string | null
  bpm?: number | null
  musical_key?: string | null
  genre?: string | null
  mood?: string | null
}

type ProfileRow = {
  username?: string
  creator_public_name?: string
  creator_name_status?: string
}

export type BeatEntitlement = {
  order: OrderRow
  item: PurchasedBeatItem
  beat: BeatRow
  producerName: string
  licenceOptionId: string | null
  licenceCode: string
  licenceSummary: string
  licenceTermsVersion: string | null
  workspaceKind: 'blank' | 'licensed'
}

export function songWorkspacesConfigured() {
  return Boolean(url && service)
}

export async function songWorkspaceUser(request: Request) {
  if (!songWorkspacesConfigured()) return null
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  return authUserId(url, service, token)
}

async function rows<T>(path: string): Promise<T[]> {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: serviceHeaders(service),
    cache: 'no-store',
  })
  if (!response.ok) return []
  const data = await response.json()
  return Array.isArray(data) ? data as T[] : []
}

function beatIdFromItem(item: PurchasedBeatItem) {
  return String(item.sourceId || item.id || '')
}

function isBeatItem(item: PurchasedBeatItem) {
  return item.type === 'beat' || item.productType === 'beat'
}

export async function findBeatEntitlement(
  userId: string,
  orderReference: string,
  requestedBeatId?: string,
): Promise<BeatEntitlement | null> {
  const reference = String(orderReference || '').trim().slice(0, 100)
  if (!reference) return null
  const order = (await rows<OrderRow>(
    `orders?reference=eq.${encodeURIComponent(reference)}&customer_user_id=eq.${encodeURIComponent(userId)}&select=id,reference,customer_user_id,status,items&limit=1`,
  ))[0]
  if (!order) return null

  const beatItems = (Array.isArray(order.items) ? order.items : []).filter(isBeatItem)
  const item = requestedBeatId
    ? beatItems.find((candidate) => beatIdFromItem(candidate) === requestedBeatId)
    : beatItems.length === 1 ? beatItems[0] : undefined
  if (!item) return null

  const workspaceKind = item.workspaceKind === 'blank' ? 'blank' : 'licensed'
  const isPaidLicence = ['paid', 'fulfilled'].includes(String(order.status))
  const isFreeWorkspace = order.status === 'free_workspace'
    && workspaceKind === 'blank'
    && item.licenceCode === 'writing_pad_free'
    && Number(item.price || 0) === 0
  if (!isPaidLicence && !isFreeWorkspace) return null

  const beatId = beatIdFromItem(item)
  if (!/^[0-9a-f-]{36}$/i.test(beatId)) return null
  const beat = (await rows<BeatRow>(
    `beats?id=eq.${encodeURIComponent(beatId)}&select=id,title,producer_user_id,artwork_path,preview_path,master_path,bpm,musical_key,genre,mood&limit=1`,
  ))[0]
  if (!beat) return null

  const profile = (await rows<ProfileRow>(
    `profiles?id=eq.${encodeURIComponent(beat.producer_user_id)}&select=username,creator_public_name,creator_name_status&limit=1`,
  ))[0]
  const producerName = creatorPublicName({
    publicName: profile?.creator_public_name,
    publicNameStatus: profile?.creator_name_status,
    username: profile?.username,
  }) || item.artist || 'BVS producer'

  return {
    order,
    item,
    beat,
    producerName: workspaceKind === 'blank' ? 'No beat attached' : producerName,
    licenceOptionId: item.licenceOptionId || item.licence_option_id || null,
    licenceCode: item.licenceCode || 'standard_lease',
    licenceSummary: item.licenceSummary || 'BVS beat licence recorded at purchase',
    licenceTermsVersion: item.licenceTermsVersion || null,
    workspaceKind,
  }
}

export async function listOwnSongWorkspaces(userId: string) {
  return rows<SongWorkspaceRow>(
    `song_workspaces?user_id=eq.${encodeURIComponent(userId)}&select=*&order=updated_at.desc&limit=50`,
  )
}

export async function getOwnSongWorkspace(userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  return (await rows<SongWorkspaceRow>(
    `song_workspaces?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
  ))[0] || null
}

export async function createSongWorkspace(userId: string, entitlement: BeatEntitlement) {
  const existing = (await rows<SongWorkspaceRow>(
    `song_workspaces?user_id=eq.${encodeURIComponent(userId)}&order_id=eq.${encodeURIComponent(entitlement.order.id)}&beat_id=eq.${encodeURIComponent(entitlement.beat.id)}&select=*&limit=1`,
  ))[0]
  if (existing) return existing

  const response = await fetch(`${url}/rest/v1/song_workspaces`, {
    method: 'POST',
    headers: { ...serviceHeaders(service), Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      order_id: entitlement.order.id,
      order_reference: entitlement.order.reference,
      beat_id: entitlement.beat.id,
      licence_option_id: entitlement.licenceOptionId,
      beat_title_snapshot: entitlement.item.title || entitlement.beat.title,
      producer_name_snapshot: entitlement.producerName,
      licence_code_snapshot: entitlement.licenceCode,
      licence_summary_snapshot: entitlement.licenceSummary,
      licence_terms_version_snapshot: entitlement.licenceTermsVersion,
      song_title: '',
      lyrics: '',
      notes: '',
      status: 'draft',
    }),
  })
  if (!response.ok) throw new Error('Could not create Song Workspace.')
  const data = await response.json()
  return (Array.isArray(data) ? data[0] : null) as SongWorkspaceRow | null
}

export async function createFreeSongWorkspace(user: { id: string; email?: string }) {
  const marker = 'BVS_FREE_LYRICS_PAD_V1'
  let beat: BeatRow | undefined = (await rows<BeatRow>(
    `beats?producer_user_id=eq.${encodeURIComponent(user.id)}&description=eq.${encodeURIComponent(marker)}&select=id,title,producer_user_id,artwork_path,preview_path,master_path,bpm,musical_key,genre,mood&limit=1`,
  ))[0]

  if (!beat) {
    const beatResponse = await fetch(`${url}/rest/v1/beats`, {
      method: 'POST',
      headers: { ...serviceHeaders(service), Prefer: 'return=representation' },
      body: JSON.stringify({
        producer_user_id: user.id,
        title: 'Private Lyrics Pad',
        description: marker,
        genre: '',
        mood: '',
        rights_confirmed: false,
        status: 'draft',
        is_public: false,
      }),
    })
    if (!beatResponse.ok) throw new Error('Could not prepare a private Lyrics Pad.')
    const created = await beatResponse.json()
    beat = Array.isArray(created) ? created[0] as BeatRow : undefined
  }
  if (!beat?.id) throw new Error('Could not prepare a private Lyrics Pad.')

  const profile = (await rows<ProfileRow & { display_name?: string }>(
    `profiles?id=eq.${encodeURIComponent(user.id)}&select=username,display_name,creator_public_name,creator_name_status&limit=1`,
  ))[0]
  const customerName = profile?.display_name || profile?.username || 'BVS member'
  const reference = `BVS-PAD-${crypto.randomUUID().replaceAll('-', '').slice(0, 24)}`
  const item: PurchasedBeatItem = {
    id: beat.id,
    sourceId: beat.id,
    type: 'beat',
    productType: 'beat',
    title: 'Untitled song',
    artist: 'No beat attached',
    licenceCode: 'writing_pad_free',
    licenceSummary: 'Free private Lyrics Pad. No purchase or beat licence is attached.',
    licenceTermsVersion: 'free-writing-v1',
    workspaceKind: 'blank',
    price: 0,
  }
  const orderResponse = await fetch(`${url}/rest/v1/orders`, {
    method: 'POST',
    headers: { ...serviceHeaders(service), Prefer: 'return=representation' },
    body: JSON.stringify({
      reference,
      customer_user_id: user.id,
      customer_name: customerName,
      customer_email: user.email || `lyrics-${user.id}@bvs.invalid`,
      payment_method: 'not_required',
      project_notes: 'Free in-app Lyrics Pad workspace. No payment, purchase or licence.',
      items: [item],
      subtotal: 0,
      tax_amount: 0,
      tax_rate: 0,
      tax_mode: 'none',
      total: 0,
      currency: 'usd',
      status: 'free_workspace',
      delivery_status: 'workspace_ready',
    }),
  })
  if (!orderResponse.ok) throw new Error('Could not create a private Lyrics Pad.')

  const entitlement = await findBeatEntitlement(user.id, reference, beat.id)
  if (!entitlement) throw new Error('Could not verify the private Lyrics Pad.')
  const row = await createSongWorkspace(user.id, entitlement)
  return { row, entitlement }
}

export async function updateOwnSongWorkspace(
  userId: string,
  id: string,
  patch: Partial<Pick<SongWorkspaceRow, 'song_title' | 'lyrics' | 'notes' | 'status' | 'release_id'>>,
) {
  const response = await fetch(
    `${url}/rest/v1/song_workspaces?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: { ...serviceHeaders(service), Prefer: 'return=representation' },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    },
  )
  if (!response.ok) return null
  const data = await response.json()
  return (Array.isArray(data) ? data[0] : null) as SongWorkspaceRow | null
}

async function signedAudio(value?: string | null) {
  if (!value) return null
  const key = r2KeyFromMediaUrl(value) || (safeR2Key(value) && !/^https?:/i.test(value) ? value : null)
  return key ? signedR2DownloadUrl(key, 1800) : value
}

export async function presentSongWorkspace(
  row: SongWorkspaceRow,
  entitlement?: BeatEntitlement | null,
  includeAudio = false,
) {
  const beat = entitlement?.beat
  const workspaceKind = entitlement?.workspaceKind || (row.licence_code_snapshot === 'writing_pad_free' ? 'blank' : 'licensed')
  const hasAttachedBeat = workspaceKind === 'licensed'
  return {
    id: row.id,
    songTitle: row.song_title,
    lyrics: row.lyrics,
    notes: row.notes,
    status: row.status,
    releaseId: row.release_id || null,
    orderReference: row.order_reference,
    beatId: row.beat_id,
    beatTitle: row.beat_title_snapshot,
    workspaceKind,
    hasAttachedBeat,
    producerName: hasAttachedBeat ? row.producer_name_snapshot || entitlement?.producerName || 'BVS producer' : 'No beat attached',
    licenceOptionId: row.licence_option_id || null,
    licenceCode: row.licence_code_snapshot || entitlement?.licenceCode || 'standard_lease',
    licenceSummary: row.licence_summary_snapshot || entitlement?.licenceSummary || 'BVS beat licence',
    licenceTermsVersion: row.licence_terms_version_snapshot || entitlement?.licenceTermsVersion || null,
    artworkUrl: hasAttachedBeat && beat?.artwork_path ? publicStorageUrl(beat.artwork_path) : null,
    bpm: hasAttachedBeat ? beat?.bpm ?? null : null,
    musicalKey: hasAttachedBeat ? beat?.musical_key ?? null : null,
    genre: hasAttachedBeat ? beat?.genre || null : null,
    mood: hasAttachedBeat ? beat?.mood || null : null,
    // The writing surface only needs playback. Keep private masters/stems behind the
    // licence-aware download fulfilment path instead of exposing them in Lyrics Pad.
    audioUrl: includeAudio && hasAttachedBeat && beat ? await signedAudio(beat.preview_path) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
