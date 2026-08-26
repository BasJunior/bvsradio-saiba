import { NextResponse } from 'next/server'
import { editorialUrl, serviceHeaders } from '@/lib/editorial-server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const SOURCE_CATEGORIES = new Set([
  'streaming_master',
  'publishing',
  'neighbouring_rights',
  'direct_fan',
  'beat_licence',
  'performance',
  'sync',
  'studio_service',
  'other',
])
const STATUSES = new Set(['expected', 'reported', 'received', 'paid'])

type SupabaseUser = { id: string; email?: string }
type IncomeEntry = {
  id?: string
  artist_user_id?: string
  release_id?: string | null
  track_id?: string | null
  source_category?: string
  provider_name?: string
  territory?: string | null
  period_start?: string | null
  period_end?: string | null
  gross_amount?: number | string
  fees_amount?: number | string
  net_amount?: number | string
  currency?: string
  status?: string
  external_reference?: string | null
  statement_name?: string | null
  occurred_at?: string
  created_at?: string
}

type RightsRelease = {
  id: string
  title?: string
  release_type?: string
  preflight_status?: string
  preflight_blockers?: unknown
  label_name?: string | null
  master_owner_name?: string | null
  composition_owner_names?: string[] | null
  rights_confirmed?: boolean
  passport_version?: number
}

type Contributor = {
  release_id: string
  contribution_role?: string
  rights_confirmed?: boolean
  share_percent?: number | string | null
}

async function currentUser(request: Request): Promise<SupabaseUser | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY || !serviceHeaders.apikey) return null
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!response.ok) return null
  return response.json()
}

async function getJson<T>(path: string): Promise<{ ok: boolean; data: T }> {
  const response = await fetch(editorialUrl(path), { headers: serviceHeaders, cache: 'no-store' })
  if (!response.ok) return { ok: false, data: [] as T }
  return { ok: true, data: await response.json() }
}

function cleanMoney(value: unknown, max = 100000000) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0 || amount > max) return null
  return Math.round(amount * 10000) / 10000
}

function cleanDate(value: unknown) {
  const text = String(value || '').trim()
  if (!text) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null
}

function cleanTimestamp(value: unknown) {
  const text = String(value || '').trim()
  if (!text) return new Date().toISOString()
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function sourceTotals(entries: IncomeEntry[]) {
  const bySource: Record<string, number> = {}
  const byCurrency: Record<string, number> = {}
  const byStatus: Record<string, number> = {}
  for (const entry of entries) {
    const amount = Number(entry.net_amount) || 0
    const source = String(entry.source_category || 'other')
    const currency = String(entry.currency || 'USD').toUpperCase()
    const status = String(entry.status || 'received')
    bySource[source] = Math.round(((bySource[source] || 0) + amount) * 10000) / 10000
    byCurrency[currency] = Math.round(((byCurrency[currency] || 0) + amount) * 10000) / 10000
    byStatus[status] = Math.round(((byStatus[status] || 0) + amount) * 10000) / 10000
  }
  return { bySource, byCurrency, byStatus, usdTotal: byCurrency.USD || 0 }
}

function rightsSummary(releases: RightsRelease[], contributors: Contributor[]) {
  const releaseRows = releases.map((release) => {
    const people = contributors.filter((item) => item.release_id === release.id)
    const primaryArtistConfirmed = people.some((item) => item.contribution_role === 'primary_artist' && item.rights_confirmed)
    const songwriterConfirmed = people.some((item) => ['songwriter', 'composer'].includes(String(item.contribution_role)) && item.rights_confirmed)
    const producerConfirmed = people.some((item) => item.contribution_role === 'producer' && item.rights_confirmed)
    const masterOwnerRecorded = Boolean(String(release.master_owner_name || '').trim())
    const compositionOwnersRecorded = Array.isArray(release.composition_owner_names) && release.composition_owner_names.length > 0
    const passportReady = ['ready', 'legacy_approved'].includes(String(release.preflight_status || ''))
    const scoreParts = [
      Boolean(release.rights_confirmed),
      masterOwnerRecorded,
      compositionOwnersRecorded,
      primaryArtistConfirmed,
      songwriterConfirmed,
      producerConfirmed,
    ]
    const completed = scoreParts.filter(Boolean).length
    return {
      id: release.id,
      title: release.title || 'Untitled release',
      releaseType: release.release_type || 'release',
      preflightStatus: release.preflight_status || 'not_checked',
      passportReady,
      rightsConfirmed: Boolean(release.rights_confirmed),
      masterOwnerRecorded,
      compositionOwnersRecorded,
      primaryArtistConfirmed,
      songwriterConfirmed,
      producerConfirmed,
      completionPercent: Math.round((completed / scoreParts.length) * 100),
    }
  })
  return {
    releases: releaseRows,
    totalReleases: releaseRows.length,
    passportReady: releaseRows.filter((item) => item.passportReady).length,
    fullyDocumented: releaseRows.filter((item) => item.completionPercent === 100).length,
  }
}

export async function GET(request: Request) {
  const user = await currentUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in to view Rights + Money.' }, { status: 401 })
  if (!serviceHeaders.apikey) return NextResponse.json({ error: 'Rights + Money is not configured.' }, { status: 503 })

  const userId = encodeURIComponent(user.id)
  const [incomeResult, rightsResult] = await Promise.all([
    getJson<IncomeEntry[]>(`artist_income_entries?artist_user_id=eq.${userId}&select=id,release_id,track_id,source_category,provider_name,territory,period_start,period_end,gross_amount,fees_amount,net_amount,currency,status,external_reference,statement_name,occurred_at,created_at&order=occurred_at.desc&limit=500`),
    getJson<RightsRelease[]>(`releases?user_id=eq.${userId}&select=id,title,release_type,preflight_status,preflight_blockers,label_name,master_owner_name,composition_owner_names,rights_confirmed,passport_version&order=created_at.desc&limit=100`),
  ])

  let releases = rightsResult.data
  if (!rightsResult.ok) {
    const fallback = await getJson<RightsRelease[]>(`releases?user_id=eq.${userId}&select=id,title,release_type,rights_confirmed&order=created_at.desc&limit=100`)
    releases = fallback.data
  }

  const releaseIds = releases.map((release) => release.id).filter(Boolean)
  const contributorResult = releaseIds.length
    ? await getJson<Contributor[]>(`release_contributors?release_id=in.(${releaseIds.join(',')})&select=release_id,contribution_role,rights_confirmed,share_percent&limit=1000`)
    : { ok: true, data: [] as Contributor[] }

  return NextResponse.json({
    schemaReady: incomeResult.ok,
    entries: incomeResult.ok ? incomeResult.data : [],
    totals: sourceTotals(incomeResult.ok ? incomeResult.data : []),
    rights: rightsSummary(releases, contributorResult.ok ? contributorResult.data : []),
    import: {
      mode: 'provider_agnostic',
      supportedCurrencyForCombinedBvsTotal: 'USD',
      note: 'External income is recorded by economic source. The distributor/provider remains replaceable.',
    },
  })
}

function normaliseEntry(raw: Record<string, unknown>, userId: string) {
  const sourceCategory = String(raw.sourceCategory || raw.source_category || '').trim()
  const status = String(raw.status || 'received').trim()
  const providerName = String(raw.providerName || raw.provider_name || 'manual').trim().slice(0, 120)
  const currency = String(raw.currency || 'USD').trim().toUpperCase()
  const netAmount = cleanMoney(raw.netAmount ?? raw.net_amount ?? raw.amount)
  const grossAmount = cleanMoney(raw.grossAmount ?? raw.gross_amount ?? netAmount)
  const feesAmount = cleanMoney(raw.feesAmount ?? raw.fees_amount ?? 0)
  const occurredAt = cleanTimestamp(raw.occurredAt ?? raw.occurred_at)

  if (!SOURCE_CATEGORIES.has(sourceCategory)) throw new Error('Choose a valid income source.')
  if (!STATUSES.has(status)) throw new Error('Choose a valid income status.')
  if (!providerName) throw new Error('Provider / payer name is required.')
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Currency must be a three-letter code such as USD.')
  if (netAmount == null || grossAmount == null || feesAmount == null) throw new Error('Income amounts must be valid non-negative numbers.')
  if (!occurredAt) throw new Error('Income date is invalid.')

  const periodStart = cleanDate(raw.periodStart ?? raw.period_start)
  const periodEnd = cleanDate(raw.periodEnd ?? raw.period_end)
  if ((raw.periodStart || raw.period_start) && !periodStart) throw new Error('Period start must use YYYY-MM-DD.')
  if ((raw.periodEnd || raw.period_end) && !periodEnd) throw new Error('Period end must use YYYY-MM-DD.')

  return {
    artist_user_id: userId,
    release_id: String(raw.releaseId || raw.release_id || '').trim() || null,
    track_id: String(raw.trackId || raw.track_id || '').trim() || null,
    source_category: sourceCategory,
    provider_name: providerName,
    territory: String(raw.territory || '').trim().slice(0, 80) || null,
    period_start: periodStart,
    period_end: periodEnd,
    gross_amount: grossAmount,
    fees_amount: feesAmount,
    net_amount: netAmount,
    currency,
    status,
    external_reference: String(raw.externalReference || raw.external_reference || '').trim().slice(0, 240) || null,
    statement_name: String(raw.statementName || raw.statement_name || '').trim().slice(0, 240) || null,
    occurred_at: occurredAt,
    metadata: {
      recorded_via: 'bvs_rights_money',
      importer_version: 1,
    },
  }
}

export async function POST(request: Request) {
  const user = await currentUser(request)
  if (!user) return NextResponse.json({ error: 'Sign in to record music income.' }, { status: 401 })
  if (!serviceHeaders.apikey) return NextResponse.json({ error: 'Rights + Money is not configured.' }, { status: 503 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const rawEntries = Array.isArray(body.entries) ? body.entries : [body]
  if (!rawEntries.length || rawEntries.length > 250) {
    return NextResponse.json({ error: 'Import between 1 and 250 income rows at a time.' }, { status: 400 })
  }

  let rows: ReturnType<typeof normaliseEntry>[]
  try {
    rows = rawEntries.map((entry) => normaliseEntry((entry || {}) as Record<string, unknown>, user.id))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Income row is invalid.' }, { status: 400 })
  }

  const response = await fetch(editorialUrl('artist_income_entries?on_conflict=artist_user_id,provider_name,external_reference'), {
    method: 'POST',
    headers: { ...serviceHeaders, Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify(rows),
  })

  if (!response.ok) {
    const detail = await response.text()
    const schemaMissing = response.status === 404 || detail.includes('artist_income_entries') || detail.includes('schema cache')
    return NextResponse.json({
      error: schemaMissing
        ? 'Rights + Money storage is not ready. Apply supabase-creator-income-ledger.sql first.'
        : 'Could not record this income.',
    }, { status: schemaMissing ? 503 : 400 })
  }

  const saved = await response.json()
  return NextResponse.json({ saved, imported: saved.length })
}
