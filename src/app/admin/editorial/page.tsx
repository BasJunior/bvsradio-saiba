'use client'

import { FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { roleLabels, type EditorialPermission, type EditorialRole } from '@/lib/editorial'
import ReleaseEditorialPanel from '@/components/ReleaseEditorialPanel'
import { creatorPublicName } from '@/lib/public-name'
import { mediaUrlForStoredValue } from '@/lib/media-url'
import EditorialAnalytics from '@/components/EditorialAnalytics'
import EditorialSectionCarousel, { matchesEditorialFilter } from '@/components/EditorialSectionCarousel'

type MobileClearance = { id?: string; track_id: string; surface: 'ios' | 'android'; status: 'not_reviewed' | 'cleared' | 'blocked'; rights_basis?: string; evidence_reference?: string; review_notes?: string; reviewed_at?: string }
type Track = { id: string; user_id: string; title: string; artist_name: string; genre: string; file_url: string; artwork_url?: string; editorial_status: string; editorial_notes?: string; is_public: boolean; in_rotation: boolean; is_downloadable: boolean; download_price: number; licence_type: string; licence_summary?: string; created_at: string; mobile_clearances?: MobileClearance[] }
type Profile = { id: string; username: string; display_name?: string; avatar_url?: string; bio?: string; website_url?: string; location?: string; spotify_url?: string; created_at?: string; role: string; is_verified: boolean; is_published: boolean; is_producer?: boolean; creator_public_name?: string; creator_name_request?: string; creator_name_status?: string; creator_name_review_notes?: string; creator_name_reviewed_at?: string; onboarding_artist_name?: string; onboarding_status?: string; onboarding_location?: string; social_links?: { instagram?: string; spotify?: string; website?: string } }
type Programme = { id: string; slug: string; title: string; host: string; day_label: string; start_time?: string; timezone: string; status: string }
type Credit = { id: string; track_id: string; person_name: string; credit_role: string }
type Staff = { user_id: string; role: EditorialRole; active: boolean }
type Audit = { id: number; action: string; entity_type: string; entity_id: string; created_at: string }
type TrackRequest = { id: string; track_id: string; artist_user_id: string; request_type: string; message: string; status: string; staff_notes?: string; created_at: string }
type ArtistWaitlist = { id: string; email: string; artist_name: string; country?: string; city?: string; status: string; source: string; created_at: string }
type ArtistDeposit = { id: string; artist_user_id: string; amount: number | string; currency: string; status: string; source: string; created_at: string }
type ArtistPayoutRequest = { id: string; artist_user_id: string; requested_amount: number | string; currency: string; status: string; requested_at: string }
type Release = { id: string; title: string; artist_name: string; genre?: string; cover_url?: string; release_type?: string; editorial_status: string; editorial_notes?: string; is_public: boolean; in_rotation: boolean; track_count: number; created_at: string; passport_version?: number; preflight_status?: string; preflight_blockers?: string[]; copyright_year?: number; master_owner_name?: string; composition_owner_names?: string[]; territories?: string[]; material_types?: string[] }
type ReleaseTrack = { id: string; release_id: string; position: number; title: string; file_url?: string; in_rotation?: boolean; isrc?: string | null; track_id?: string | null }
type KnownIsrcMapEntry = { isrc: string; title?: string | null; artist_name?: string | null; upc?: string | null; spotify_album_url?: string | null; source?: string | null }
type ReleaseContributor = { id: string; release_id: string; person_name: string; contribution_role: string; rights_confirmed: boolean }
type ReleaseClearanceEvidence = { id: string; release_id: string; material_type: string; evidence_version: number; original_file_name: string; file_url?: string; artist_notes?: string; review_status: string; review_notes?: string }
type MediaProcessingJob = { id: string; release_id: string; release_track_id: string; status: string; codec_name?: string; duration_seconds?: number; sample_rate?: number; channels?: number; loudness_lufs?: number; true_peak_db?: number; malware_status: string; blockers?: string[]; waveform_path?: string; preview_path?: string; error_code?: string }
type DistJob = { id: string; release_id: string; status: string; distributor?: string | null; notes?: string | null }
type BeatLicence = { id?: string; licence_name?: string; price_usd?: number; is_active?: boolean }
type Beat = { id: string; producer_user_id: string; title: string; genre?: string; mood?: string; bpm?: number | null; status: string; is_public: boolean; preview_path?: string | null; artwork_path?: string | null; editorial_notes?: string | null; created_at: string; beat_licence_options?: BeatLicence[] }
type BeatReviewMessage = { id: string; beat_id: string; author_kind: 'producer' | 'editor'; message: string; created_at: string }
type TrackReviewMessage = { id: string; track_id: string; author_kind: 'artist' | 'editor'; message: string; created_at: string }
type RoleApplication = { id: string; user_id: string; requested_role: string; status: string; message?: string; review_notes?: string; updated_at: string }
type EditorialData = { identity: { role: EditorialRole; permissions: EditorialPermission[]; profile?: Profile }; tracks: Track[]; profiles: Profile[]; programmes: Programme[]; credits: Credit[]; staff: Staff[]; auditLog: Audit[]; trackRequests: TrackRequest[]; roleApplications?: RoleApplication[]; beats?: Beat[]; beatReviewMessages?: BeatReviewMessage[]; trackReviewMessages?: TrackReviewMessage[]; releases?: Release[]; releaseTracks?: ReleaseTrack[]; releaseContributors?: ReleaseContributor[]; releaseClearanceEvidence?: ReleaseClearanceEvidence[]; mediaProcessingJobs?: MediaProcessingJob[]; distributionJobs?: DistJob[]; knownIsrcMap?: KnownIsrcMapEntry[]; artistWaitlist: ArtistWaitlist[]; artistDeposits: ArtistDeposit[]; artistPayoutRequests: ArtistPayoutRequest[] }

const statusClass: Record<string, string> = { submitted: 'text-amber-300', pending: 'text-amber-300', in_review: 'text-blue-300', approved: 'text-emerald-300', published: 'text-emerald-300', rejected: 'text-red-300', changes_requested: 'text-orange-300', draft: 'text-text-secondary', not_submitted: 'text-text-secondary' }

export default function EditorialDashboard() {
  const [data, setData] = useState<EditorialData | null>(null)
  const [token, setToken] = useState('')
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null)
  const configured = isSupabaseConfigured()
  const [error, setError] = useState(configured ? '' : 'Supabase is not configured.')
  const [busy, setBusy] = useState('')
  const [loading, setLoading] = useState(configured)

  const emptyData = useCallback((identity: EditorialData['identity']): EditorialData => ({
    identity,
    tracks: [],
    profiles: [],
    programmes: [],
    credits: [],
    staff: [],
    auditLog: [],
    trackRequests: [],
    roleApplications: [],
    beats: [],
    beatReviewMessages: [],
    trackReviewMessages: [],
    releases: [],
    releaseTracks: [],
    releaseContributors: [],
    releaseClearanceEvidence: [],
    mediaProcessingJobs: [],
    distributionJobs: [],
    knownIsrcMap: [],
    artistWaitlist: [],
    artistDeposits: [],
    artistPayoutRequests: [],
  }), [])

  const fetchSection = useCallback(async (accessToken: string, section: string) => {
    const response = await fetch(`/api/admin/editorial?section=${encodeURIComponent(section)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    let payload: { error?: string } & Partial<EditorialData> = {}
    try {
      payload = await response.json()
    } catch {
      throw new Error(`Editorial server error (${response.status}). Try again in a moment.`)
    }
    if (!response.ok) throw new Error(payload.error || 'Could not load editorial dashboard.')
    return payload
  }, [])

  const mergeSection = useCallback((prev: EditorialData | null, payload: Partial<EditorialData>): EditorialData => {
    const base = prev || emptyData(payload.identity as EditorialData['identity'])
    const pick = <K extends keyof EditorialData>(key: K): EditorialData[K] =>
      (Object.prototype.hasOwnProperty.call(payload, key) ? payload[key] : base[key]) as EditorialData[K]
    return {
      identity: payload.identity || base.identity,
      tracks: pick('tracks') || [],
      profiles: pick('profiles') || [],
      programmes: pick('programmes') || [],
      credits: pick('credits') || [],
      staff: pick('staff') || [],
      auditLog: pick('auditLog') || [],
      trackRequests: pick('trackRequests') || [],
      roleApplications: pick('roleApplications') || [],
      beats: pick('beats') || [],
      beatReviewMessages: pick('beatReviewMessages') || [],
      trackReviewMessages: pick('trackReviewMessages') || [],
      releases: pick('releases') || [],
      releaseTracks: pick('releaseTracks') || [],
      releaseContributors: pick('releaseContributors') || [],
      releaseClearanceEvidence: pick('releaseClearanceEvidence') || [],
      mediaProcessingJobs: pick('mediaProcessingJobs') || [],
      distributionJobs: pick('distributionJobs') || [],
      knownIsrcMap: pick('knownIsrcMap') || [],
      artistWaitlist: pick('artistWaitlist') || [],
      artistDeposits: pick('artistDeposits') || [],
      artistPayoutRequests: pick('artistPayoutRequests') || [],
    }
  }, [emptyData])

  const loadSections = useCallback(async (accessToken: string, sections: string[]) => {
    const results = await Promise.all(sections.map((section) => fetchSection(accessToken, section)))
    setData((prev) => {
      let next = prev
      for (const payload of results) {
        next = mergeSection(next, payload)
      }
      return next
    })
    setError('')
  }, [fetchSection, mergeSection])

  const load = useCallback(async (accessToken: string, sections?: string[]) => {
    if (sections?.length) {
      await loadSections(accessToken, sections)
      return
    }
    // Full parallel section load (default after bootstrap)
    const bootstrap = await fetchSection(accessToken, 'bootstrap')
    if (!bootstrap.identity) throw new Error('Could not load editorial identity.')
    setData(mergeSection(null, bootstrap))
    setError('')
    const permissions = bootstrap.identity.permissions || []
    const walletAllowed = permissions.includes('manage_artist_wallet')
    const parallel = ['tracks', 'beats', 'releases', 'profiles', 'programmes', ...(walletAllowed ? ['wallet'] : [])]
    await loadSections(accessToken, parallel)
  }, [fetchSection, loadSections, mergeSection])

  const boot = useCallback(async () => {
    if (!configured) return
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      // Prefer getUser so a stale access token is refreshed when possible
      const { data: userData } = await supabase.auth.getUser()
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      const email = userData.user?.email || sessionData.session?.user?.email || null
      setSignedInEmail(email)
      if (!accessToken || !userData.user) {
        setError('Sign in with your BVS owner or editorial staff account.')
        setLoading(false)
        return
      }
      setToken(accessToken)
      await load(accessToken)
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Editorial access failed.')
    } finally {
      setLoading(false)
    }
  }, [configured, load])

  useEffect(() => {
    const timer = window.setTimeout(() => void boot(), 0)
    return () => window.clearTimeout(timer)
  }, [boot])

  const allowed = (permission: EditorialPermission) => Boolean(data?.identity.permissions.includes(permission))

  const sectionsForAction = (action: string): string[] => {
    if (/track|credit|rotation|licence|reclassif/i.test(action) && !/beat/i.test(action)) return ['tracks', 'bootstrap']
    if (/beat/i.test(action)) return ['beats', 'bootstrap']
    if (/release|clearance|dist|isrc|media_job|passport|preflight/i.test(action)) return ['releases', 'bootstrap']
    if (/profile|publish_artist|verify|creator_name|role_app|staff/i.test(action)) return ['profiles', 'bootstrap']
    if (/programme|schedule/i.test(action)) return ['programmes', 'bootstrap']
    if (/wallet|deposit|payout|waitlist/i.test(action)) return ['wallet', 'bootstrap']
    return ['tracks', 'beats', 'releases', 'profiles', 'programmes', 'bootstrap']
  }

  const act = async (action: string, body: Record<string, unknown>) => {
    setBusy(`${action}-${String(body.trackId || body.beatId || body.profileId || body.slug || body.userId || '')}`)
    setError('')
    try {
      const response = await fetch('/api/admin/editorial', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, ...body }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Editorial action failed.')
      const secs = sectionsForAction(action)
      if (allowed('manage_artist_wallet') && secs.includes('wallet') === false && /wallet|deposit|payout|waitlist/i.test(action)) {
        secs.push('wallet')
      }
      await load(token, secs)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Editorial action failed.') }
    finally { setBusy('') }
  }

  if (error && !data) {
    const alreadySignedIn = Boolean(signedInEmail)
    return (
      <main className="mx-auto min-h-[65vh] max-w-2xl px-6 py-20 text-center">
        <h1 className="text-3xl">Editorial access unavailable</h1>
        <p className="mt-4 text-text-secondary">{error}</p>
        {alreadySignedIn ? (
          <p className="mt-3 text-sm text-text-secondary">
            You are already signed in as <strong className="text-text-primary">{signedInEmail}</strong>.
            Signing in again will not help — this account needs an editorial staff role (or owner bootstrap).
          </p>
        ) : null}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {alreadySignedIn ? (
            <>
              <button
                type="button"
                onClick={() => void boot()}
                className="rounded-full bg-brand px-6 py-3 font-semibold text-black"
              >
                Retry access
              </button>
              <Link href="/" className="rounded-full border border-white/20 px-6 py-3">
                Home
              </Link>
            </>
          ) : (
            <Link
              href="/auth/login?next=/editorial"
              className="rounded-full bg-brand px-6 py-3 font-semibold text-black"
            >
              Sign in
            </Link>
          )}
        </div>
      </main>
    )
  }
  if (loading || !data) return <main className="p-20 text-center text-text-secondary">Loading editorial workflow…</main>

  // — Queue = needs editorial action (submitted / in review / changes requested) —
  // — Processed = decided (approved / rejected) but not yet published —
  const beatNeedsReview = (data.beats || []).filter((b) =>
    ['submitted', 'in_review', 'changes_requested'].includes(b.status),
  ).length
  const beatProcessed = (data.beats || []).filter((b) =>
    ['approved', 'published', 'rejected'].includes(b.status),
  ).length
  const beatQueue = beatNeedsReview  // badge = items needing action

  const trackNeedsReview = data.tracks.filter((t) =>
    ['submitted', 'in_review'].includes(t.editorial_status),
  ).length
  const trackProcessed = data.tracks.filter((t) =>
    ['approved', 'rejected'].includes(t.editorial_status),
  ).length
  const trackQueue = trackNeedsReview  // only badge items needing action

  const requestQueue = data.trackRequests.filter((r) => ['open', 'reviewing'].includes(r.status)).length
  const roleQueue = (data.roleApplications || []).filter((application) =>
    ['submitted', 'information_requested'].includes(application.status),
  ).length
  const identityQueue = data.profiles.filter((profile) =>
    ['pending', 'changes_requested'].includes(profile.creator_name_status || ''),
  ).length

  const releaseNeedsReview = (data.releases || []).filter((r) =>
    ['submitted', 'in_review'].includes(r.editorial_status),
  ).length
  const releaseProcessed = (data.releases || []).filter((r) =>
    ['approved', 'published', 'rejected'].includes(r.editorial_status),
  ).length
  const releaseQueue = releaseNeedsReview  // only badge items needing action

  const jump = [
    { id: 'ed-overview', label: 'Overview' },
    { id: 'ed-analytics', label: 'Analytics' },
    { id: 'ed-releases', label: `Albums/EPs${releaseQueue ? ` (${releaseQueue})` : ''}` },
    { id: 'ed-beats', label: `BeatStore${beatQueue ? ` (${beatQueue})` : ''}` },
    { id: 'ed-tracks', label: `Singles${trackQueue ? ` (${trackQueue})` : ''}` },
    { id: 'ed-requests', label: `Requests${requestQueue ? ` (${requestQueue})` : ''}` },
    { id: 'ed-role-applications', label: `Role applications${roleQueue ? ` (${roleQueue})` : ''}` },
    { id: 'ed-identities', label: `Public names${identityQueue ? ` (${identityQueue})` : ''}` },
    { id: 'ed-artists', label: 'Artists' },
    { id: 'ed-programmes', label: 'Programmes' },
    ...(allowed('manage_staff') ? [{ id: 'ed-staff', label: 'Staff' }] : []),
    ...(allowed('manage_artist_wallet') ? [{ id: 'ed-wallet', label: 'Wallet' }] : []),
    { id: 'ed-audit', label: 'Audit' },
  ]

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs uppercase tracking-[.22em] text-brand">BVS operations</p>
          <h1 className="mt-2 text-4xl font-semibold">Editorial workflow</h1>
          <p className="mt-3 text-text-secondary">
            Signed in as {roleLabels[data.identity.role]}. Every action is recorded.
          </p>
        </div>
        <button onClick={() => load(token)} className="rounded-full border border-white/20 px-5 py-2 text-sm">
          Refresh
        </button>
      </div>
      {error && (
        <p className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">{error}</p>
      )}

      <Link
        href="/admin/creator-workflows"
        className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand/25 bg-brand/[.06] p-5 transition hover:border-brand/60"
      >
        <div>
          <p className="font-semibold">Writing &amp; Research Review</p>
          <p className="mt-1 text-sm text-text-secondary">Approve research briefs for drafting and review articles returned by the BVS Editorial Desk.</p>
        </div>
        <span className="text-sm font-semibold text-brand">Open queue →</span>
      </Link>

      <nav
        aria-label="Editorial sections"
        className="sticky top-16 z-30 -mx-2 mt-8 overflow-x-auto rounded-2xl border border-white/10 bg-bg-primary/90 px-2 py-2 backdrop-blur-md"
      >
        <div className="flex min-w-max gap-2">
          {jump.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-text-secondary transition hover:border-brand hover:text-brand"
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      <section id="ed-overview" className="mt-8 scroll-mt-36 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {[
          ['Tracks needing review', trackNeedsReview],
          ['Tracks processed', trackProcessed],
          ['Beats needing review', beatNeedsReview],
          ['Beats processed', beatProcessed],
          ['Releases needing review', releaseNeedsReview],
          ['Releases processed', releaseProcessed],
          ['Published', data.tracks.filter((t) => t.is_public).length],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
            <p className="text-sm text-text-secondary">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-brand">{value}</p>
          </div>
        ))}
      </section>

      <Link
          href="/editorial/finance"
          className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand/25 bg-brand/[.06] p-5 transition hover:border-brand/60"
        >
          <span>
            <span className="block text-xs uppercase tracking-[.18em] text-brand">Accounting & performance</span>
            <span className="mt-1 block text-lg font-semibold">Quarterly goals versus live BVS statistics</span>
            <span className="mt-1 block text-sm text-text-secondary">Open the separate finance workspace for GMV, MRR, artist liabilities, controls and target charts.</span>
          </span>
          <span className="rounded-full border border-brand/40 px-4 py-2 text-sm text-brand">Open finance dashboard →</span>
        </Link>

      <Link
          href="/editorial/marketplace"
          className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[.03] p-5 transition hover:border-brand/50"
        >
          <span>
            <span className="block text-xs uppercase tracking-[.18em] text-brand">Creator Marketplace</span>
            <span className="mt-1 block text-lg font-semibold">Review creator profiles, accomplishments and listings</span>
            <span className="mt-1 block text-sm text-text-secondary">Approval is evidence-based. Premium never buys publication, ranking or verified claims.</span>
          </span>
          <span className="rounded-full border border-white/20 px-4 py-2 text-sm text-brand">Open marketplace review →</span>
        </Link>

      <EditorialAnalytics token={token} />

      <EditorialDropDown id="ed-releases" label="Albums and EPs" count={releaseQueue} defaultOpen={releaseQueue > 0}>
        <ReleaseEditorialPanel
          releases={data.releases || []}
          releaseTracks={data.releaseTracks || []}
          releaseContributors={data.releaseContributors || []}
          releaseClearanceEvidence={data.releaseClearanceEvidence || []}
          mediaProcessingJobs={data.mediaProcessingJobs || []}
          distributionJobs={data.distributionJobs || []}
          knownIsrcMap={data.knownIsrcMap || []}
          canApprove={allowed('approve_submissions')}
          canRotate={allowed('manage_rotation')}
          canDistro={allowed('manage_artist_wallet')}
          act={act}
          busy={busy}
        />
      </EditorialDropDown>

      <EditorialDropDown id="ed-beats" label="Producer BeatStore" count={beatQueue} defaultOpen={beatQueue > 0}>
        <BeatStoreEditorialPanel
          beats={data.beats || []}
          messages={data.beatReviewMessages || []}
          profiles={data.profiles}
          enabled={allowed('approve_submissions')}
          act={act}
          busy={busy}
        />
      </EditorialDropDown>

      <EditorialDropDown id="ed-tracks" label="Single-track submissions" count={trackQueue} defaultOpen={trackQueue > 0}>
        <h2 className="text-2xl font-semibold">Single-track submission queue</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Legacy single uploads. Prefer Album/EP for multi-track. Approval does not automatically publish or
          add a track to rotation.
        </p>
        {data.tracks.length === 0 ? (
          <Empty text="No submissions yet." />
        ) : (
          <TracksCarousel
            tracks={data.tracks}
            credits={data.credits}
            messages={data.trackReviewMessages || []}
            profiles={data.profiles}
            allowed={allowed}
            act={act}
            busy={busy}
          />
        )}
      </EditorialDropDown>

      <EditorialDropDown id="ed-requests" label="Artist requests" count={requestQueue} defaultOpen={requestQueue > 0}>
        <ArtistRequestPanel
          requests={data.trackRequests}
          tracks={data.tracks}
          profiles={data.profiles}
          enabled={allowed('approve_submissions')}
          act={act}
          busy={busy}
        />
      </EditorialDropDown>

      <EditorialDropDown id="ed-role-applications" label="Role applications" count={roleQueue} defaultOpen={roleQueue > 0}>
        <RoleApplicationPanel
          applications={data.roleApplications || []}
          profiles={data.profiles}
          enabled={allowed('publish_artists')}
          act={act}
          busy={busy}
        />
      </EditorialDropDown>

      <EditorialDropDown id="ed-identities" label="Creator public names" count={identityQueue} defaultOpen={identityQueue > 0}>
        <IdentityReviewPanel
          profiles={data.profiles}
          enabled={allowed('publish_artists')}
          act={act}
          busy={busy}
        />
      </EditorialDropDown>

      <EditorialDropDown id="ed-artists" label="Creator publishing and programmes">
        <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold">Creator publishing and BeatStore access</h2>
          <p className="mt-2 text-sm text-text-secondary">Publishing controls public discovery. Producer access separately controls beat uploads and catalogue ownership.</p>
          <CreatorsCarousel
            profiles={data.profiles}
            allowed={allowed}
            act={act}
            busy={busy}
          />
        </div>
        <div id="ed-programmes" className="scroll-mt-36">
          <ProgrammePanel programmes={data.programmes} enabled={allowed('schedule_programmes')} act={act} />
        </div>
        </div>
      </EditorialDropDown>

      {allowed('manage_staff') && (
        <EditorialDropDown id="ed-staff" label="Staff and permissions">
          <StaffPanel profiles={data.profiles} staff={data.staff} act={act} />
        </EditorialDropDown>
      )}
      {allowed('manage_artist_wallet') && (
        <EditorialDropDown id="ed-wallet" label="Artist wallet operations">
          <ArtistWalletPanel
            waitlist={data.artistWaitlist}
            deposits={data.artistDeposits}
            payoutRequests={data.artistPayoutRequests}
            profiles={data.profiles}
          />
        </EditorialDropDown>
      )}
      <EditorialDropDown id="ed-audit" label="Recent audit trail" count={data.auditLog.length}>
        <h2 className="text-2xl font-semibold">Recent audit trail</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-white/5 text-text-secondary">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity</th>
                <th className="p-3">ID</th>
              </tr>
            </thead>
            <tbody>
              {data.auditLog.map((entry) => (
                <tr key={entry.id} className="border-t border-white/10">
                  <td className="p-3 text-text-secondary">{new Date(entry.created_at).toLocaleString()}</td>
                  <td className="p-3">{entry.action.replaceAll('_', ' ')}</td>
                  <td className="p-3">{entry.entity_type}</td>
                  <td className="max-w-64 truncate p-3 font-mono text-xs">{entry.entity_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EditorialDropDown>
    </main>
  )
}

function EditorialDropDown({
  id,
  label,
  count,
  defaultOpen = false,
  children,
}: {
  id: string
  label: string
  count?: number
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = `${id}-panel`

  return (
    <section id={id} className="mt-10 scroll-mt-36 rounded-2xl border border-white/10 bg-white/[.015]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left transition hover:bg-white/[.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="font-semibold">{label}</span>
          {typeof count === 'number' && (
            <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-text-secondary">
              {count}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-text-secondary">
          {open ? 'Hide section' : 'Show section'}
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && <div id={panelId} className="border-t border-white/10 px-5 pb-6 pt-1">{children}</div>}
    </section>
  )
}

function IdentityReviewPanel({
  profiles,
  enabled,
  act,
  busy,
}: {
  profiles: Profile[]
  enabled: boolean
  act: (action: string, body: Record<string, unknown>) => Promise<void>
  busy: string
}) {
  const creators = profiles.filter((profile) =>
    ['artist', 'admin'].includes(profile.role) || profile.is_producer,
  )
  return (
    <div>
      <h2 className="text-2xl font-semibold">Creator public-name review</h2>
      <p className="mt-2 text-sm text-text-secondary">
        Legal names stay private. Public creator pages use only an approved artist/producer name, otherwise the permanent @username.
      </p>
      {creators.length === 0 ? (
        <Empty text="No creator identities are available yet." />
      ) : (
        <IdentityNamesCarousel creators={creators} enabled={enabled} act={act} busy={busy} />
      )}
    </div>
  )
}

function IdentityReviewCard({
  profile,
  enabled,
  act,
  busy,
}: {
  profile: Profile
  enabled: boolean
  act: (action: string, body: Record<string, unknown>) => Promise<void>
  busy: string
}) {
  const [publicName, setPublicName] = useState(profile.creator_name_request || profile.creator_public_name || '')
  const [notes, setNotes] = useState(profile.creator_name_review_notes || '')
  const decide = (decision: 'approved' | 'changes_requested' | 'rejected') =>
    act('review_creator_name', { profileId: profile.id, decision, publicName, notes })
  const status = profile.creator_name_status || 'not_submitted'
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[.025] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider ${statusClass[status] || 'text-text-secondary'}`}>
            {status.replaceAll('_', ' ')}
          </p>
          <h3 className="mt-1 text-xl font-semibold">@{profile.username}</h3>
          <p className="text-sm text-text-secondary">Member display name: {profile.display_name || 'not set'}</p>
          <p className="mt-1 text-sm text-text-secondary">
            Current public output: {creatorPublicName({ publicName: profile.creator_public_name, publicNameStatus: profile.creator_name_status, username: profile.username })}
          </p>
        </div>
        {profile.creator_name_reviewed_at && <p className="text-xs text-text-secondary">{new Date(profile.creator_name_reviewed_at).toLocaleString()}</p>}
      </div>
      <label className="mt-4 block text-sm font-medium">
        Artist / producer public name
        <input
          value={publicName}
          onChange={(event) => setPublicName(event.target.value)}
          maxLength={120}
          placeholder={`@${profile.username}`}
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 p-3 outline-none focus:border-brand"
        />
      </label>
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Editorial note or information request…"
        className="mt-3 min-h-20 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none focus:border-brand"
      />
      {enabled && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button disabled={Boolean(busy) || !publicName.trim()} onClick={() => decide('approved')} className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-black disabled:opacity-40">Approve public name</button>
          <button disabled={Boolean(busy) || notes.trim().length < 3} onClick={() => decide('changes_requested')} className="rounded-full border border-amber-300 px-4 py-2 text-xs text-amber-200 disabled:opacity-40">Request changes</button>
          <button disabled={Boolean(busy) || notes.trim().length < 3} onClick={() => decide('rejected')} className="rounded-full bg-red-400 px-4 py-2 text-xs font-semibold text-black disabled:opacity-40">Reject</button>
        </div>
      )}
    </article>
  )
}

function RoleApplicationPanel({
  applications,
  profiles,
  enabled,
  act,
  busy,
}: {
  applications: RoleApplication[]
  profiles: Profile[]
  enabled: boolean
  act: (action: string, body: Record<string, unknown>) => Promise<void>
  busy: string
}) {
  return (
    <div>
      <h2 className="text-2xl font-semibold">Account role applications</h2>
      <p className="mt-2 text-sm text-text-secondary">
        Members apply from Account Centre. Approval changes server-side access; editable signup metadata is never trusted.
      </p>
      {applications.length === 0 ? (
        <Empty text="No account role applications yet." />
      ) : (
        <RoleApplicationsCarousel applications={applications} profiles={profiles} enabled={enabled} act={act} busy={busy} />
      )}
    </div>
  )
}

function RoleApplicationCard({
  application,
  profile,
  enabled,
  act,
  busy,
}: {
  application: RoleApplication
  profile?: Profile
  enabled: boolean
  act: (action: string, body: Record<string, unknown>) => Promise<void>
  busy: string
}) {
  const [notes, setNotes] = useState(application.review_notes || '')
  const decide = (decision: 'approved' | 'rejected' | 'information_requested') =>
    act('review_role_application', { applicationId: application.id, decision, notes })
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[.025] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider ${statusClass[application.status] || 'text-text-secondary'}`}>
            {application.status.replaceAll('_', ' ')}
          </p>
          <h3 className="mt-1 text-xl font-semibold">{profile?.display_name || profile?.username || 'BVS member'}</h3>
          <p className="text-sm text-text-secondary">
            @{profile?.username || application.user_id.slice(0, 8)} · requests {application.requested_role.replaceAll('_', ' ')}
          </p>
        </div>
        <p className="text-xs text-text-secondary">{new Date(application.updated_at).toLocaleString()}</p>
      </div>
      {application.message && <p className="mt-4 whitespace-pre-wrap rounded-xl bg-black/20 p-4 text-sm">{application.message}</p>}
      {enabled && application.status !== 'approved' && (
        <div className="mt-4">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Reply with requested information or a reason for rejection…"
            className="min-h-20 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none focus:border-brand"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={Boolean(busy)} onClick={() => decide('approved')} className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-black">Approve</button>
            <button disabled={Boolean(busy) || notes.trim().length < 3} onClick={() => decide('information_requested')} className="rounded-full border border-amber-300 px-4 py-2 text-xs text-amber-200 disabled:opacity-40">Request information</button>
            <button disabled={Boolean(busy) || notes.trim().length < 3} onClick={() => decide('rejected')} className="rounded-full bg-red-400 px-4 py-2 text-xs font-semibold text-black disabled:opacity-40">Reject</button>
          </div>
        </div>
      )}
      {application.review_notes && application.status === 'approved' && (
        <p className="mt-3 text-sm text-text-secondary">Editorial note: {application.review_notes}</p>
      )}
    </article>
  )
}

function BeatStoreEditorialPanel({
  beats,
  messages,
  profiles,
  enabled,
  act,
  busy,
}: {
  beats: Beat[]
  messages: BeatReviewMessage[]
  profiles: Profile[]
  enabled: boolean
  act: (action: string, body: Record<string, unknown>) => Promise<void>
  busy: string
}) {
  const nameFor = (id: string) =>
    profiles.find((p) => p.id === id)?.display_name ||
    profiles.find((p) => p.id === id)?.username ||
    id.slice(0, 8)
  const publicUrl = (path?: string | null) => mediaUrlForStoredValue(path) || ''
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-semibold">Producer BeatStore queue</h2>
      <p className="mt-2 text-sm text-text-secondary">
        Approve and publish producer beat listings. Publishing makes them visible in Beats / BeatStore.
      </p>
      {beats.length === 0 ? (
        <Empty text="No producer beats in queue yet." />
      ) : (
        <BeatsCarousel beats={beats} messages={messages} profiles={profiles} enabled={enabled} act={act} busy={busy} nameFor={nameFor} publicUrl={publicUrl} />
      )}
    </section>
  )
}

function BeatReviewThread({ beat, messages, profiles, act, busy }: { beat: Beat; messages: BeatReviewMessage[]; profiles: Profile[]; act: (action: string, body: Record<string, unknown>) => Promise<void>; busy: string }) {
  const [message, setMessage] = useState('')
  const producerProfiles = profiles.filter((profile) => profile.is_producer || profile.role === 'admin')
  return <div className="rounded-xl border border-white/10 bg-black/20 p-3">
    <p className="text-xs font-semibold uppercase tracking-wider text-brand">Review conversation</p>
    <div className="mt-2 max-h-44 space-y-2 overflow-y-auto">
      {messages.map(item => <p key={item.id} className="rounded-lg bg-white/5 p-2 text-xs"><span className="font-semibold capitalize">{item.author_kind}:</span> {item.message}<span className="ml-2 text-text-secondary">{new Date(item.created_at).toLocaleString()}</span></p>)}
      {!messages.length && <p className="text-xs text-text-secondary">No messages yet.</p>}
    </div>
    <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
      <textarea value={message} onChange={event => setMessage(event.target.value)} placeholder="Message the producer about rights, files, artwork, pricing or changes…" className="min-h-20 rounded-lg border border-white/10 bg-black/20 p-2 text-sm" />
      <button disabled={Boolean(busy) || !message.trim()} onClick={async () => { await act('message_beat', { beatId: beat.id, message }); setMessage('') }} className="rounded-full border border-brand px-4 py-2 text-xs text-brand disabled:opacity-40">Send note</button>
    </div>
    <label className="mt-3 block text-xs text-text-secondary">Assign/claim producer
      <select value={beat.producer_user_id} onChange={event => act('assign_beat_producer', { beatId: beat.id, producerUserId: event.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-bg-primary p-2">
        {producerProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.display_name || profile.username}</option>)}
      </select>
    </label>
  </div>
}

function TrackCard({ track, profile, credits, messages, allowed, act, busy }: { track: Track; profile?: Profile; credits: Credit[]; messages: TrackReviewMessage[]; allowed: (p: EditorialPermission) => boolean; act: (action: string, body: Record<string, unknown>) => Promise<void>; busy: string }) {
  const [notes, setNotes] = useState(track.editorial_notes || '')
  const [message, setMessage] = useState('')
  const [messageOpen, setMessageOpen] = useState(false)
  const [price, setPrice] = useState(String(track.download_price || 0))
  const [licenceType, setLicenceType] = useState(track.licence_type || 'not_for_sale')
  const [licenceSummary, setLicenceSummary] = useState(track.licence_summary || '')
  const [personName, setPersonName] = useState('')
  const [creditRole, setCreditRole] = useState('')
  const iosClearance = track.mobile_clearances?.find((item) => item.surface === 'ios')
  const [iosStatus, setIosStatus] = useState(iosClearance?.status || 'not_reviewed')
  const [iosRightsBasis, setIosRightsBasis] = useState(iosClearance?.rights_basis || '')
  const [iosEvidence, setIosEvidence] = useState(iosClearance?.evidence_reference || '')
  const [iosNotes, setIosNotes] = useState(iosClearance?.review_notes || '')
  const disabled = Boolean(busy)
  return <article className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><div className="flex flex-wrap justify-between gap-4"><div className="flex min-w-0 gap-4">{track.artwork_url?<div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5"><Image src={track.artwork_url} alt={`${track.title} submitted artwork`} fill unoptimized={/^https?:\/\//i.test(track.artwork_url)} className="object-cover" /></div>:<div className="grid h-24 w-24 shrink-0 place-items-center rounded-xl border border-dashed border-white/15 text-center text-[10px] text-text-secondary">No artwork submitted</div>}<div className="min-w-0"><p className={`text-xs font-semibold uppercase tracking-wider ${statusClass[track.editorial_status] || 'text-text-secondary'}`}>{track.editorial_status.replace('_', ' ')}</p><h3 className="mt-1 text-xl font-semibold">{track.title}</h3><p className="text-sm text-text-secondary">{profile ? <ArtistReviewLink profile={profile} label={track.artist_name} /> : track.artist_name} · {track.genre} · {new Date(track.created_at).toLocaleDateString()}</p><p className="mt-2 text-xs text-text-secondary">{track.artwork_url?'Submitted artwork attached':'Request artwork before publishing if required.'}</p></div></div><audio controls preload="none" src={track.file_url} className="h-10 max-w-full" /></div>
    {allowed('approve_submissions') && <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]"><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Private review notes" className="min-h-20 rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none focus:border-brand"/><div className="flex flex-wrap items-start gap-2"><button disabled={disabled} onClick={() => act('review_track', { trackId: track.id, status: 'in_review', notes })} className="rounded-full border border-white/20 px-4 py-2 text-xs">Review</button><button disabled={disabled} onClick={() => setMessageOpen(open => !open)} className="rounded-full border border-brand px-4 py-2 text-xs text-brand">{messageOpen ? 'Close message' : 'Send message'}</button><button disabled={disabled} onClick={() => act('review_track', { trackId: track.id, status: 'approved', notes })} className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-black">Approve</button><button disabled={disabled} onClick={() => act('review_track', { trackId: track.id, status: 'rejected', notes })} className="rounded-full bg-red-400 px-4 py-2 text-xs font-semibold text-black">Reject</button><button disabled={disabled} onClick={async () => { if (!window.confirm(`Move “${track.title}” from Singles to the BeatStore review queue?`)) return; await act('reclassify_track_as_beat', { trackId: track.id }) }} className="rounded-full border border-amber-300/60 px-4 py-2 text-xs text-amber-200">Move to BeatStore</button>{track.editorial_status === 'approved' && <button disabled={disabled} onClick={() => act('publish_track', { trackId: track.id, publish: !track.is_public })} className="rounded-full border border-brand px-4 py-2 text-xs text-brand">{track.is_public ? 'Unpublish track' : 'Publish track'}</button>}</div></div>}
    {messageOpen && <div className="mt-4 rounded-xl border border-brand/20 bg-black/20 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-brand">Review conversation</p>{messages.length > 0 && <div className="mt-3 max-h-44 space-y-2 overflow-y-auto">{messages.map(item => <p key={item.id} className="rounded-lg bg-white/5 p-2 text-xs"><span className="font-semibold capitalize">{item.author_kind}:</span> {item.message}<span className="ml-2 text-text-secondary">{new Date(item.created_at).toLocaleString()}</span></p>)}</div>}<div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]"><textarea autoFocus value={message} onChange={e => setMessage(e.target.value)} maxLength={2000} placeholder="Message the uploader about classification, rights, artwork or requested changes…" className="min-h-24 rounded-lg border border-white/10 bg-black/20 p-3 text-sm"/><button disabled={disabled || !message.trim()} onClick={async () => { await act('message_track', { trackId: track.id, message }); setMessage('') }} className="self-start rounded-full bg-brand px-4 py-2 text-xs font-semibold text-black disabled:opacity-40">Post message</button></div></div>}
    <div className="mt-5 grid gap-5 border-t border-white/10 pt-5 lg:grid-cols-3">
      <div><h4 className="text-sm font-semibold">Rotation</h4><p className="mt-1 text-xs text-text-secondary">{track.in_rotation ? 'Included in the station player' : 'Not in rotation'}</p>{allowed('manage_rotation') && <button disabled={disabled} onClick={() => act('set_rotation', { trackId: track.id, enabled: !track.in_rotation })} className="mt-3 rounded-full border border-white/20 px-4 py-2 text-xs">{track.in_rotation ? 'Remove' : 'Add to rotation'}</button>}</div>
      <div><h4 className="text-sm font-semibold">Licensing &amp; price</h4>{allowed('manage_licensing') ? <div className="mt-2 space-y-2"><select value={licenceType} onChange={e => setLicenceType(e.target.value)} className="w-full rounded-lg border border-white/10 bg-bg-primary p-2 text-xs"><option value="not_for_sale">Not for sale</option><option value="personal_download">Personal download</option><option value="standard_lease">Standard lease</option><option value="exclusive">Exclusive</option><option value="custom">Custom</option></select><input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="w-full rounded-lg border border-white/10 bg-black/20 p-2 text-xs" placeholder="USD price"/><input value={licenceSummary} onChange={e => setLicenceSummary(e.target.value)} className="w-full rounded-lg border border-white/10 bg-black/20 p-2 text-xs" placeholder="Rights summary"/><button disabled={disabled} onClick={() => act('manage_license', { trackId: track.id, licenceType, price, summary: licenceSummary })} className="rounded-full border border-brand px-4 py-2 text-xs text-brand">Save terms</button></div> : <p className="mt-1 text-xs text-text-secondary">{track.licence_type} · ${track.download_price}</p>}</div>
      <div><h4 className="text-sm font-semibold">Verified credits</h4><ul className="mt-2 space-y-1 text-xs text-text-secondary">{credits.map(c => <li key={c.id}>{c.person_name} — {c.credit_role}</li>)}</ul>{allowed('verify_credits') && <div className="mt-2 space-y-2"><input value={personName} onChange={e => setPersonName(e.target.value)} className="w-full rounded-lg border border-white/10 bg-black/20 p-2 text-xs" placeholder="Person / artist"/><input value={creditRole} onChange={e => setCreditRole(e.target.value)} className="w-full rounded-lg border border-white/10 bg-black/20 p-2 text-xs" placeholder="Producer, writer, engineer…"/><button disabled={disabled || !personName || !creditRole} onClick={() => act('add_credit', { trackId: track.id, personName, creditRole })} className="rounded-full border border-brand px-4 py-2 text-xs text-brand">Verify credit</button></div>}</div>
    </div>
    <div className="mt-5 border-t border-white/10 pt-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-sm font-semibold">Mobile distribution</h4><p className="mt-1 text-xs text-text-secondary">iOS is active now. Android uses the same evidence gate later.</p></div><span className={`rounded-full px-3 py-1 text-xs ${iosStatus === 'cleared' ? 'bg-emerald-400/10 text-emerald-200' : iosStatus === 'blocked' ? 'bg-red-400/10 text-red-200' : 'bg-white/5 text-text-secondary'}`}>iOS · {iosStatus.replaceAll('_', ' ')}</span></div>
      {allowed('approve_submissions') && <div className="mt-3 grid gap-2 md:grid-cols-2"><select value={iosStatus} onChange={e => setIosStatus(e.target.value as MobileClearance['status'])} className="rounded-lg border border-white/10 bg-bg-primary p-2 text-xs"><option value="not_reviewed">Not reviewed</option><option value="cleared">Cleared for iOS</option><option value="blocked">Blocked from iOS</option></select><input value={iosRightsBasis} onChange={e => setIosRightsBasis(e.target.value)} placeholder="Rights basis: founder-owned / direct licence" className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs"/><input value={iosEvidence} onChange={e => setIosEvidence(e.target.value)} placeholder="Evidence reference / agreement ID" className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs"/><input value={iosNotes} onChange={e => setIosNotes(e.target.value)} placeholder="Private review notes" className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs"/><button disabled={disabled || (iosStatus === 'cleared' && (!iosRightsBasis.trim() || !iosEvidence.trim()))} onClick={() => act('set_mobile_clearance', { trackId: track.id, surface: 'ios', status: iosStatus, rightsBasis: iosRightsBasis, evidenceReference: iosEvidence, notes: iosNotes })} className="rounded-full border border-brand px-4 py-2 text-xs text-brand disabled:opacity-40 md:col-span-2">Save iOS clearance</button></div>}
    </div>
  </article>
}

function ArtistRequestPanel({ requests, tracks, profiles, enabled, act, busy }: { requests: TrackRequest[]; tracks: Track[]; profiles: Profile[]; enabled: boolean; act: (action: string, body: Record<string, unknown>) => Promise<void>; busy: string }) {
  const [notesById, setNotesById] = useState<Record<string, string>>({})
  const nameFor = (id: string) => profiles.find(profile => profile.id === id)?.display_name || profiles.find(profile => profile.id === id)?.username || id.slice(0, 8)
  return <section className="mt-14"><h2 className="text-2xl font-semibold">Artist requests</h2><p className="mt-2 text-sm text-text-secondary">Takedown, metadata, artwork, rights and payout questions from uploaded artists.</p>{requests.length === 0 ? <Empty text="No artist requests yet." /> : <ArtistRequestsCarousel requests={requests} tracks={tracks} nameFor={nameFor} notesById={notesById} setNotesById={setNotesById} enabled={enabled} act={act} busy={busy} />}</section>
}

function ProgrammePanel({ programmes, enabled, act }: { programmes: Programme[]; enabled: boolean; act: (action: string, body: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({ title: '', slug: '', host: 'BVS Radio', dayLabel: '', startTime: '', timezone: 'Africa/Harare', status: 'draft', tagline: '', description: '', imageUrl: '' })
  const submit = (event: FormEvent) => { event.preventDefault(); void act('save_programme', form) }
  return <div><h2 className="text-2xl font-semibold">Programme schedule</h2><div className="mt-5 space-y-2">{programmes.map(p => <div key={p.id} className="rounded-xl border border-white/10 p-4"><p className="font-medium">{p.title}</p><p className="text-xs text-text-secondary">{p.day_label} {p.start_time?.slice(0,5)} · {p.timezone} · {p.status}</p></div>)}</div>{enabled && <form onSubmit={submit} className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/[.025] p-5 sm:grid-cols-2"><input required value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="Programme title" className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm"/><input value={form.slug} onChange={e => setForm({...form,slug:e.target.value})} placeholder="Slug (automatic if blank)" className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm"/><input required value={form.dayLabel} onChange={e => setForm({...form,dayLabel:e.target.value})} placeholder="Friday / Daily" className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm"/><input type="time" value={form.startTime} onChange={e => setForm({...form,startTime:e.target.value})} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm"/><input value={form.host} onChange={e => setForm({...form,host:e.target.value})} placeholder="Host" className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm"/><select value={form.status} onChange={e => setForm({...form,status:e.target.value})} className="rounded-xl border border-white/10 bg-bg-primary p-3 text-sm"><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="active">Active</option><option value="archived">Archived</option></select><textarea value={form.description} onChange={e => setForm({...form,description:e.target.value})} placeholder="Programme description" className="sm:col-span-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm"/><button className="rounded-full bg-brand px-5 py-3 font-semibold text-black sm:col-span-2">Save programme</button></form>}</div>
}


function TracksCarousel({
  tracks,
  credits,
  messages,
  profiles,
  allowed,
  act,
  busy,
}: {
  tracks: Track[]
  credits: Credit[]
  messages: TrackReviewMessage[]
  profiles: Profile[]
  allowed: (permission: EditorialPermission) => boolean
  act: (action: string, body: Record<string, unknown>) => Promise<void>
  busy: string
}) {
  const [filter, setFilter] = useState('')
  const filtered = tracks.filter((track) => {
    const profile = profiles.find((p) => p.id === track.user_id)
    return matchesEditorialFilter(
      filter,
      track.title,
      track.artist_name,
      track.genre,
      track.editorial_status,
      track.id,
      profile?.username,
      profile?.display_name,
      profile?.creator_public_name,
      profile?.creator_name_request,
    )
  })
  return (
    <EditorialSectionCarousel
      label="Tracks"
      count={filtered.length}
      filterValue={filter}
      onFilterChange={setFilter}
      filterPlaceholder="Direktzugriff: artist, title, genre, status…"
      filterHint="Filter this queue only — type an artist, title, genre or status."
    >
      {filtered.length === 0 ? (
        <Empty text={filter.trim() ? 'No tracks match this Direktzugriff filter.' : 'No submissions yet.'} />
      ) : (
        filtered.map((track) => (
          <TrackCard
            key={track.id}
            track={track}
            credits={credits.filter((c) => c.track_id === track.id)}
            messages={messages.filter((message) => message.track_id === track.id)}
            profile={profiles.find((profile) => profile.id === track.user_id)}
            allowed={allowed}
            act={act}
            busy={busy}
          />
        ))
      )}
    </EditorialSectionCarousel>
  )
}

function CreatorsCarousel({
  profiles,
  allowed,
  act,
  busy,
}: {
  profiles: Profile[]
  allowed: (permission: EditorialPermission) => boolean
  act: (action: string, body: Record<string, unknown>) => Promise<void>
  busy: string
}) {
  const [filter, setFilter] = useState('')
  const creators = profiles.filter((profile) => ['artist', 'admin'].includes(profile.role) || profile.is_producer)
  const filtered = creators.filter((profile) =>
    matchesEditorialFilter(
      filter,
      profile.username,
      profile.display_name,
      profile.creator_public_name,
      profile.creator_name_request,
      profile.role,
      profile.is_producer ? 'producer' : '',
      profile.is_published ? 'published' : 'unpublished',
      profile.location,
    ),
  )
  return (
    <EditorialSectionCarousel
      label="Creators"
      count={filtered.length}
      itemClassName="min-w-[min(100%,20rem)] max-w-[26rem] shrink-0 snap-start sm:min-w-[22rem]"
      filterValue={filter}
      onFilterChange={setFilter}
      filterPlaceholder="Direktzugriff: creator, @username, producer…"
      filterHint="Jump straight to a creator / producer in this section."
    >
      {filtered.length === 0 ? (
        <Empty text={filter.trim() ? 'No creators match this filter.' : 'No creators yet.'} />
      ) : (
        filtered.map((profile) => (
          <div key={profile.id} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 p-4">
            <div>
              <ArtistReviewLink profile={profile} className="font-medium" />
              <p className="text-xs text-text-secondary">
                @{profile.username} · member name: {profile.display_name || 'not set'} · {profile.is_published ? 'Published and verified' : 'Not published'}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              {profile.is_published && (
                <Link href={`/artist/${profile.username}`} target="_blank" rel="noreferrer" className="rounded-full border border-white/20 px-4 py-2 text-xs hover:border-brand">
                  Open profile ↗
                </Link>
              )}
              {allowed('publish_artists') && (
                <button disabled={Boolean(busy)} onClick={() => act('set_producer', { profileId: profile.id, enabled: !profile.is_producer })} className="rounded-full border border-white/20 px-4 py-2 text-xs hover:border-brand">
                  {profile.is_producer ? 'Disable BeatStore' : 'Enable producer'}
                </button>
              )}
              {allowed('publish_artists') && (
                <button disabled={Boolean(busy)} onClick={() => act('publish_artist', { profileId: profile.id, publish: !profile.is_published })} className="rounded-full border border-white/20 px-4 py-2 text-xs hover:border-brand">
                  {profile.is_published ? 'Unpublish' : 'Publish'}
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </EditorialSectionCarousel>
  )
}

function IdentityNamesCarousel({
  creators,
  enabled,
  act,
  busy,
}: {
  creators: Profile[]
  enabled: boolean
  act: (action: string, body: Record<string, unknown>) => Promise<void>
  busy: string
}) {
  const [filter, setFilter] = useState('')
  const filtered = creators.filter((profile) =>
    matchesEditorialFilter(
      filter,
      profile.username,
      profile.display_name,
      profile.creator_public_name,
      profile.creator_name_request,
      profile.creator_name_status,
    ),
  )
  return (
    <EditorialSectionCarousel
      label="Creator names"
      count={filtered.length}
      filterValue={filter}
      onFilterChange={setFilter}
      filterPlaceholder="Direktzugriff: name, @username, status…"
      filterHint="Filter public-name reviews by creator or status."
    >
      {filtered.length === 0 ? (
        <Empty text={filter.trim() ? 'No identity cards match this filter.' : 'No creator identities are available yet.'} />
      ) : (
        filtered.map((profile) => (
          <IdentityReviewCard key={profile.id} profile={profile} enabled={enabled} act={act} busy={busy} />
        ))
      )}
    </EditorialSectionCarousel>
  )
}

function RoleApplicationsCarousel({
  applications,
  profiles,
  enabled,
  act,
  busy,
}: {
  applications: RoleApplication[]
  profiles: Profile[]
  enabled: boolean
  act: (action: string, body: Record<string, unknown>) => Promise<void>
  busy: string
}) {
  const [filter, setFilter] = useState('')
  const filtered = applications.filter((application) => {
    const profile = profiles.find((p) => p.id === application.user_id)
    return matchesEditorialFilter(
      filter,
      application.requested_role,
      application.status,
      application.message,
      profile?.username,
      profile?.display_name,
      profile?.creator_public_name,
    )
  })
  return (
    <EditorialSectionCarousel
      label="Role applications"
      count={filtered.length}
      filterValue={filter}
      onFilterChange={setFilter}
      filterPlaceholder="Direktzugriff: member, role, status…"
      filterHint="Filter role applications by person, requested role or status."
    >
      {filtered.length === 0 ? (
        <Empty text={filter.trim() ? 'No role applications match this filter.' : 'No account role applications yet.'} />
      ) : (
        filtered.map((application) => (
          <RoleApplicationCard
            key={application.id}
            application={application}
            profile={profiles.find((profile) => profile.id === application.user_id)}
            enabled={enabled}
            act={act}
            busy={busy}
          />
        ))
      )}
    </EditorialSectionCarousel>
  )
}

function BeatsCarousel({
  beats,
  messages,
  profiles,
  enabled,
  act,
  busy,
  nameFor,
  publicUrl,
}: {
  beats: Beat[]
  messages: BeatReviewMessage[]
  profiles: Profile[]
  enabled: boolean
  act: (action: string, body: Record<string, unknown>) => Promise<void>
  busy: string
  nameFor: (id: string) => string
  publicUrl: (path?: string | null) => string
}) {
  const [filter, setFilter] = useState('')
  const filtered = beats.filter((beat) =>
    matchesEditorialFilter(
      filter,
      beat.title,
      beat.genre,
      beat.mood,
      beat.status,
      beat.bpm,
      nameFor(beat.producer_user_id),
      beat.is_public ? 'public' : 'not public',
      beat.editorial_notes,
    ),
  )
  return (
    <EditorialSectionCarousel
      label="Beats"
      count={filtered.length}
      itemClassName="min-w-[min(100%,26rem)] max-w-[32rem] shrink-0 snap-start sm:min-w-[28rem]"
      filterValue={filter}
      onFilterChange={setFilter}
      filterPlaceholder="Direktzugriff: producer, title, genre, status…"
      filterHint="Filter BeatStore queue by producer, title, genre or status."
    >
      {filtered.length === 0 ? (
        <Empty text={filter.trim() ? 'No beats match this filter.' : 'No producer beats in queue yet.'} />
      ) : (
        filtered.map((beat) => {
          const price = beat.beat_licence_options?.[0]?.price_usd
          const audioSrc = publicUrl(beat.preview_path)
          const artSrc = publicUrl(beat.artwork_path)
          return (
            <article key={beat.id} className="rounded-2xl border border-white/10 bg-white/[.025] p-5">
              <div className="flex flex-wrap justify-between gap-4">
                <div className="flex min-w-0 flex-1 gap-4">
                  {artSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={artSrc}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
                      onError={(e) => {
                        ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-white/5 text-[10px] text-text-secondary">
                      No art
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold uppercase tracking-wider ${statusClass[beat.status] || 'text-text-secondary'}`}>
                      {beat.status.replaceAll('_', ' ')}
                    </p>
                    <h3 className="mt-1 text-xl font-semibold">{beat.title}</h3>
                    <p className="text-sm text-text-secondary">
                      {nameFor(beat.producer_user_id)} · {beat.genre || 'Beat'}
                      {beat.bpm ? ` · ${beat.bpm} BPM` : ''}
                      {price != null ? ` · $${Number(price).toFixed(2)} standard lease` : ''}
                      {beat.is_public ? ' · public' : ' · not public'}
                    </p>
                    {beat.editorial_notes && <p className="mt-2 text-sm text-text-secondary">Notes: {beat.editorial_notes}</p>}
                  </div>
                </div>
                {audioSrc ? <audio controls preload="none" src={audioSrc} className="h-10 max-w-full" /> : null}
              </div>
              {enabled && (
                <div className="mt-4">
                  <BeatReviewThread beat={beat} messages={messages.filter((message) => message.beat_id === beat.id)} profiles={profiles} act={act} busy={busy} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button disabled={Boolean(busy)} onClick={() => act('review_beat', { beatId: beat.id, status: 'approved', notes: '' })} className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-black">Approve</button>
                    <button disabled={Boolean(busy)} onClick={() => act('review_beat', { beatId: beat.id, status: 'changes_requested', notes: 'Please review the editorial conversation and revise before resubmitting.' })} className="rounded-full border border-white/20 px-4 py-2 text-xs">Request changes</button>
                    <button disabled={Boolean(busy)} onClick={() => act('review_beat', { beatId: beat.id, status: 'rejected', notes: beat.editorial_notes || '' })} className="rounded-full bg-red-400 px-4 py-2 text-xs font-semibold text-black">Reject</button>
                    {['approved', 'published'].includes(beat.status) && (
                      <button disabled={Boolean(busy)} onClick={() => act('publish_beat', { beatId: beat.id, publish: !beat.is_public })} className="rounded-full border border-brand px-4 py-2 text-xs text-brand">
                        {beat.is_public ? 'Unpublish' : 'Publish to BeatStore'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </article>
          )
        })
      )}
    </EditorialSectionCarousel>
  )
}

function ArtistRequestsCarousel({
  requests,
  tracks,
  nameFor,
  notesById,
  setNotesById,
  enabled,
  act,
  busy,
}: {
  requests: TrackRequest[]
  tracks: Track[]
  nameFor: (id: string) => string
  notesById: Record<string, string>
  setNotesById: (value: Record<string, string>) => void
  enabled: boolean
  act: (action: string, body: Record<string, unknown>) => Promise<void>
  busy: string
}) {
  const [filter, setFilter] = useState('')
  const filtered = requests.filter((request) => {
    const track = tracks.find((item) => item.id === request.track_id)
    return matchesEditorialFilter(
      filter,
      request.request_type,
      request.status,
      request.message,
      request.staff_notes,
      track?.title,
      track?.artist_name,
      nameFor(request.artist_user_id),
    )
  })
  return (
    <EditorialSectionCarousel
      label="Artist requests"
      count={filtered.length}
      itemClassName="min-w-[min(100%,22rem)] max-w-[28rem] shrink-0 snap-start sm:min-w-[24rem]"
      filterValue={filter}
      onFilterChange={setFilter}
      filterPlaceholder="Direktzugriff: artist, track, type, status…"
      filterHint="Filter requests by artist, track title, type or status."
    >
      {filtered.length === 0 ? (
        <Empty text={filter.trim() ? 'No artist requests match this filter.' : 'No artist requests yet.'} />
      ) : (
        filtered.map((request) => {
          const track = tracks.find((item) => item.id === request.track_id)
          return (
            <article key={request.id} className="rounded-xl border border-white/10 p-4">
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-brand">{request.request_type.replaceAll('_', ' ')} · {request.status}</p>
                  <h3 className="mt-1 font-medium">{track?.title || 'Track request'}</h3>
                  <p className="text-xs text-text-secondary">{nameFor(request.artist_user_id)} · {new Date(request.created_at).toLocaleString()}</p>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-text-secondary">{request.message}</p>
              {request.staff_notes && <p className="mt-3 text-sm text-brand">Staff: {request.staff_notes}</p>}
              {enabled && (
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                  <textarea value={notesById[request.id] || ''} onChange={(e) => setNotesById({ ...notesById, [request.id]: e.target.value })} placeholder="Staff notes" className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm" />
                  <div className="flex flex-wrap gap-2">
                    <button disabled={Boolean(busy)} onClick={() => act('review_track_request', { requestId: request.id, status: 'reviewing', notes: notesById[request.id] || '' })} className="rounded-full border border-white/20 px-4 py-2 text-xs">Reviewing</button>
                    <button disabled={Boolean(busy)} onClick={() => act('review_track_request', { requestId: request.id, status: 'resolved', notes: notesById[request.id] || '' })} className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-black">Resolved</button>
                    <button disabled={Boolean(busy)} onClick={() => act('review_track_request', { requestId: request.id, status: 'rejected', notes: notesById[request.id] || '' })} className="rounded-full bg-red-400 px-4 py-2 text-xs font-semibold text-black">Reject</button>
                  </div>
                </div>
              )}
            </article>
          )
        })
      )}
    </EditorialSectionCarousel>
  )
}


function StaffPanel({ profiles, staff, act }: { profiles: Profile[]; staff: Staff[]; act: (action: string, body: Record<string, unknown>) => Promise<void> }) {
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState<EditorialRole>('editor')
  const save = (member: Staff, nextRole: EditorialRole, active: boolean) =>
    act('assign_staff', { userId: member.user_id, role: nextRole, active })
  const assignableRoles = Object.entries(roleLabels).filter(([value]) => value !== 'founder')
  return <section className="mt-14"><h2 className="text-2xl font-semibold">Staff roles</h2><p className="mt-2 text-sm text-text-secondary">The Founder is the protected highest authority. Administrators can manage all other staff roles, while at least one active administrator must remain.</p><div className="mt-5 grid gap-3 md:grid-cols-2">{staff.map(member => { const p=profiles.find(profile=>profile.id===member.user_id); return <StaffRoleCard key={member.user_id} member={member} name={p?.display_name || p?.username || member.user_id} save={save} />})}</div><div className="mt-4 flex flex-wrap gap-3 rounded-xl border border-white/10 p-4"><select value={userId} onChange={e=>setUserId(e.target.value)} className="min-w-56 rounded-lg border border-white/10 bg-bg-primary p-2 text-sm"><option value="">Select account</option>{profiles.filter(p=>!staff.some(member=>member.user_id===p.id)).map(p=><option key={p.id} value={p.id}>{p.display_name || p.username}</option>)}</select><select value={role} onChange={e=>setRole(e.target.value as EditorialRole)} className="rounded-lg border border-white/10 bg-bg-primary p-2 text-sm">{assignableRoles.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button disabled={!userId} onClick={()=>act('assign_staff',{userId,role,active:true})} className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-black">Add staff member</button></div></section>
}

function socialUrl(kind: 'instagram' | 'spotify' | 'website', value?: string) {
  const clean = String(value || '').trim()
  if (!clean) return ''
  if (/^https?:\/\//i.test(clean)) return clean
  if (kind === 'instagram') return `https://instagram.com/${clean.replace(/^@/, '')}`
  return `https://${clean.replace(/^\/+/, '')}`
}

function ArtistReviewLink({ profile, label, className = '' }: { profile: Profile; label?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const publicName = creatorPublicName({ publicName: profile.creator_public_name, publicNameStatus: profile.creator_name_status, username: profile.username })
  const links = {
    instagram: socialUrl('instagram', profile.social_links?.instagram),
    spotify: socialUrl('spotify', profile.social_links?.spotify || profile.spotify_url),
    website: socialUrl('website', profile.social_links?.website || profile.website_url),
  }
  const avatar = mediaUrlForStoredValue(profile.avatar_url) || ''
  return <>
    <button type="button" onClick={() => setOpen(true)} className={`text-left text-brand underline decoration-brand/40 underline-offset-4 hover:text-white ${className}`}>{label || publicName}</button>
    {open && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label={`Review ${publicName}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
      <article className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/15 bg-bg-primary p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-4">{avatar ? <Image src={avatar} alt={`${publicName} profile`} width={88} height={88} unoptimized={/^https?:\/\//i.test(avatar)} className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-1 ring-white/15" /> : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-white/5 text-2xl text-brand">{publicName.slice(0,1).toUpperCase()}</div>}<div className="min-w-0"><p className="text-xs uppercase tracking-[.2em] text-brand">Artist credibility review</p><h2 className="mt-1 truncate text-3xl font-semibold">{publicName}</h2><p className="text-sm text-text-secondary">@{profile.username}{profile.onboarding_artist_name && profile.onboarding_artist_name !== publicName ? ` · applied as ${profile.onboarding_artist_name}` : ''}</p></div></div><button type="button" onClick={() => setOpen(false)} className="rounded-full border border-white/20 px-3 py-1.5 text-sm">Close</button></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3"><ReviewFact label="Account" value={profile.is_verified ? 'Verified' : 'Not verified'} /><ReviewFact label="Publishing" value={profile.is_published ? 'Published' : 'Not published'} /><ReviewFact label="Joined" value={profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'} /></div>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.025] p-5"><h3 className="font-semibold">Profile and location</h3><p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">{profile.bio || 'No artist biography supplied.'}</p><p className="mt-3 text-sm text-brand">{profile.onboarding_location || profile.location || 'No location supplied'}</p></div>
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.025] p-5"><h3 className="font-semibold">Social presence</h3><p className="mt-1 text-xs text-text-secondary">Open each submitted account and check identity consistency, audience history, releases and engagement quality.</p><div className="mt-4 flex flex-wrap gap-3">{links.instagram && <ExternalReviewLink href={links.instagram} label="Instagram ↗" />}{links.spotify && <ExternalReviewLink href={links.spotify} label="Spotify / DSP ↗" />}{links.website && <ExternalReviewLink href={links.website} label="Website / link hub ↗" />}{!links.instagram && !links.spotify && !links.website && <p className="text-sm text-amber-200">No social or DSP links were submitted.</p>}</div></div>
        {profile.is_published && <Link href={`/artist/${profile.username}`} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black">Open public BVS profile ↗</Link>}
      </article>
    </div>}
  </>
}

function ReviewFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 p-3"><p className="text-[11px] uppercase tracking-wider text-text-secondary">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>
}

function ExternalReviewLink({ href, label }: { href: string; label: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="rounded-full border border-brand/50 px-4 py-2 text-sm text-brand hover:bg-brand hover:text-black">{label}</a>
}

function StaffRoleCard({ member, name, save }: { member: Staff; name: string; save: (member: Staff, role: EditorialRole, active: boolean) => Promise<void> }) {
  const [role, setRole] = useState<EditorialRole>(member.role)
  const changed = role !== member.role
  if (member.role === 'founder') return <div className="rounded-xl border border-brand/40 bg-brand/[.04] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{name}</p><p className="text-xs text-text-secondary">Full platform authority · protected from staff-role changes</p></div><span className="rounded-full bg-brand/15 px-2.5 py-1 text-[11px] font-semibold text-brand">Founder</span></div></div>
  return <div className="rounded-xl border border-white/10 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{name}</p><p className="text-xs text-text-secondary">{member.active ? 'Active staff access' : 'Access disabled'}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${member.active ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/5 text-text-secondary'}`}>{member.active ? 'Active' : 'Disabled'}</span></div><div className="mt-4 flex flex-wrap gap-2"><select value={role} onChange={e=>setRole(e.target.value as EditorialRole)} className="min-w-44 rounded-lg border border-white/10 bg-bg-primary p-2 text-sm">{Object.entries(roleLabels).filter(([value])=>value!=='founder').map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button disabled={!changed} onClick={()=>save(member,role,member.active)} className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">Save role</button><button onClick={()=>save(member,role,!member.active)} className={`rounded-full px-4 py-2 text-xs font-semibold ${member.active ? 'border border-red-300/40 text-red-200' : 'border border-emerald-300/40 text-emerald-200'}`}>{member.active ? 'Disable access' : 'Restore access'}</button></div></div>
}

function ArtistWalletPanel({ waitlist, deposits, payoutRequests, profiles }: { waitlist: ArtistWaitlist[]; deposits: ArtistDeposit[]; payoutRequests: ArtistPayoutRequest[]; profiles: Profile[] }) {
  const nameFor = (id: string) => {
    const profile = profiles.find(p => p.id === id)
    return profile?.display_name || profile?.username || id.slice(0, 8)
  }
  return <section className="mt-14"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-2xl font-semibold">Artist wallet queue</h2><p className="mt-2 text-sm text-text-secondary">Creditable deposits and payout data appear after the artist wallet SQL is applied.</p></div><div className="grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-xl border border-white/10 p-3"><p className="text-text-secondary">Queued</p><p className="mt-1 text-xl text-brand">{waitlist.length}</p></div><div className="rounded-xl border border-white/10 p-3"><p className="text-text-secondary">Deposits</p><p className="mt-1 text-xl text-brand">{deposits.length}</p></div><div className="rounded-xl border border-white/10 p-3"><p className="text-text-secondary">Payouts</p><p className="mt-1 text-xl text-brand">{payoutRequests.length}</p></div></div></div><div className="mt-5 grid gap-5 lg:grid-cols-3"><AdminList title="Waitlist" rows={waitlist.map(item => [item.artist_name, item.status, item.country || item.email, new Date(item.created_at).toLocaleDateString()])} /><AdminList title="Deposits" rows={deposits.map(item => [nameFor(item.artist_user_id), item.status, `${item.currency} ${Number(item.amount).toFixed(2)}`, item.source])} /><AdminList title="Payout requests" rows={payoutRequests.map(item => [nameFor(item.artist_user_id), item.status, `${item.currency} ${Number(item.requested_amount).toFixed(2)}`, new Date(item.requested_at).toLocaleDateString()])} /></div></section>
}

function AdminList({ title, rows }: { title: string; rows: string[][] }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><h3 className="font-semibold">{title}</h3>{rows.length ? <div className="mt-3 space-y-3">{rows.slice(0, 8).map((row, index) => <div key={`${title}-${index}`} className="border-t border-white/10 pt-3 first:border-t-0 first:pt-0"><p className="truncate text-sm font-medium">{row[0]}</p><p className="truncate text-xs capitalize text-text-secondary">{row.slice(1).join(' · ')}</p></div>)}</div> : <p className="mt-3 text-sm text-text-secondary">No records yet.</p>}</div>
}

function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-text-secondary">{text}</div> }
