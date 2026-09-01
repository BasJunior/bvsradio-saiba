'use client'

import { useState } from 'react'
import EditorialSectionCarousel, { matchesEditorialFilter } from '@/components/EditorialSectionCarousel'
import {
  PRIVATE_DSP_PARTNER_CODE,
  editorialDistributionStatusLabel,
} from '@/lib/distribution-path'
import {
  bestIsrcMatch,
  normalizeIsrc,
  suggestIsrcs,
  type KnownIsrcEntry,
} from '@/lib/known-isrc'

type Release = {
  id: string
  title: string
  artist_name: string
  genre?: string
  cover_url?: string
  release_type?: string
  editorial_status: string
  editorial_notes?: string
  is_public: boolean
  in_rotation: boolean
  track_count: number
  created_at: string
  passport_version?: number
  preflight_status?: string
  preflight_blockers?: string[]
  copyright_year?: number
  master_owner_name?: string
  composition_owner_names?: string[]
  territories?: string[]
  material_types?: string[]
}

type ReleaseTrack = {
  id: string
  release_id: string
  position: number
  title: string
  file_url?: string
  in_rotation?: boolean
  isrc?: string | null
  track_id?: string | null
}
type ReleaseContributor = {
  id: string
  release_id: string
  person_name: string
  contribution_role: string
  rights_confirmed: boolean
}
type MediaProcessingJob = {
  id: string
  release_id: string
  release_track_id: string
  status: string
  codec_name?: string
  duration_seconds?: number
  sample_rate?: number
  channels?: number
  loudness_lufs?: number
  true_peak_db?: number
  malware_status: string
  blockers?: string[]
  waveform_path?: string
  preview_path?: string
  error_code?: string
}
type ReleaseClearanceEvidence = {
  id: string
  release_id: string
  material_type: string
  evidence_version: number
  original_file_name: string
  file_url?: string
  artist_notes?: string
  review_status: string
  review_notes?: string
}

type DistJob = {
  id: string
  release_id: string
  status: string
  distributor?: string | null
  notes?: string | null
}

export default function ReleaseEditorialPanel({
  releases,
  releaseTracks,
  releaseContributors,
  releaseClearanceEvidence,
  mediaProcessingJobs,
  distributionJobs,
  knownIsrcMap = [],
  canApprove,
  canRotate,
  canDistro,
  act,
  busy,
}: {
  releases: Release[]
  releaseTracks: ReleaseTrack[]
  releaseContributors: ReleaseContributor[]
  releaseClearanceEvidence: ReleaseClearanceEvidence[]
  mediaProcessingJobs: MediaProcessingJob[]
  distributionJobs: DistJob[]
  knownIsrcMap?: KnownIsrcEntry[]
  canApprove: boolean
  canRotate: boolean
  canDistro: boolean
  act: (action: string, body: Record<string, unknown>) => Promise<void>
  busy: string
}) {
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [rotationSelections, setRotationSelections] = useState<Record<string, string[]>>({})
  const [sectionFilter, setSectionFilter] = useState('')
  const [isrcValues, setIsrcValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const track of releaseTracks) {
      if (track.isrc) initial[track.id] = String(track.isrc)
    }
    return initial
  })
  const [isrcQuery, setIsrcQuery] = useState<Record<string, string>>({})
  const [openIsrcMenu, setOpenIsrcMenu] = useState<string | null>(null)

  const trackIsrcsPayload = (members: ReleaseTrack[]) =>
    members
      .map((member) => ({
        releaseTrackId: member.id,
        isrc: normalizeIsrc(isrcValues[member.id] ?? member.isrc ?? ''),
      }))
      .filter((row) => row.isrc)

  if (!releases?.length) {
    return (
      <section className="mt-14">
        <h2 className="text-2xl font-semibold">Album / EP submissions</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Multi-track releases from artists appear here after they use Upload → Album / EP. If empty after submits,
          run <code className="text-brand">supabase-releases-pipeline.sql</code> in Supabase.
        </p>
        <div className="mt-5 rounded-2xl border border-dashed border-white/15 p-10 text-center text-text-secondary">
          No release submissions yet.
        </div>
      </section>
    )
  }

  return (
    <section className="mt-14">
      <h2 className="text-2xl font-semibold">Album / EP submissions</h2>
      <p className="mt-2 text-sm text-text-secondary">
        Approve &amp; publish creates catalogue tracks and can add them to continuous rotation. Distribution jobs are
        a queue for when a partner is configured (Premium artists).
      </p>
      {releases.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-text-secondary">No album or EP submissions yet.</p>
      ) : (
        (() => {
          const filteredReleases = releases.filter((release) =>
            matchesEditorialFilter(
              sectionFilter,
              release.title,
              release.artist_name,
              release.genre,
              release.editorial_status,
              release.release_type,
              release.preflight_status,
              release.id,
              release.master_owner_name,
              ...(release.composition_owner_names || []),
              ...(release.preflight_blockers || []),
            ),
          )
          return (
        <EditorialSectionCarousel
          label="Releases"
          count={filteredReleases.length}
          itemClassName="min-w-[min(100%,28rem)] max-w-[36rem] shrink-0 snap-start sm:min-w-[30rem]"
          filterValue={sectionFilter}
          onFilterChange={setSectionFilter}
          filterPlaceholder="Direktzugriff: artist, title, status, genre…"
          filterHint="Filter this album/EP queue only — artist, title, status, genre or passport flags."
        >
        {filteredReleases.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-text-secondary">No releases match this Direktzugriff filter.</p>
        ) : filteredReleases.map((release) => {
          const members = releaseTracks.filter((t) => t.release_id === release.id)
          const contributors = releaseContributors.filter((item) => item.release_id === release.id)
          const clearanceEvidence = releaseClearanceEvidence.filter((item) => item.release_id === release.id)
          const mediaJobs = mediaProcessingJobs.filter((item) => item.release_id === release.id)
          const job = distributionJobs.find((j) => j.release_id === release.id)
          const rightsReady = ['ready', 'legacy_approved'].includes(release.preflight_status || '')
          const mediaReady = release.passport_version === 0 ||
            (members.length > 0 && mediaJobs.length === members.length && mediaJobs.every((item) => item.status === 'ready'))
          const publishable = rightsReady && mediaReady
          const selectedRotationIds = rotationSelections[release.id] ?? members.filter((member) => member.in_rotation).map((member) => member.id)
          const toggleRotationTrack = (trackId: string) => {
            const current = rotationSelections[release.id] ?? members.filter((member) => member.in_rotation).map((member) => member.id)
            setRotationSelections({
              ...rotationSelections,
              [release.id]: current.includes(trackId)
                ? current.filter((id) => id !== trackId)
                : [...current, trackId],
            })
          }
          return (
            <article key={release.id} className="rounded-2xl border border-white/10 bg-white/[.025] p-5">
              <div className="flex flex-wrap gap-4">
                {release.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={release.cover_url} alt="" className="h-24 w-24 rounded-xl object-cover border border-white/10" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-wider text-brand">
                    {release.release_type || 'album'} · {release.editorial_status.replace('_', ' ')}
                    {release.is_public ? ' · public' : ''}
                    {release.in_rotation ? ' · in rotation' : ''}
                  </p>
                  <h3 className="mt-1 text-xl font-semibold">{release.title}</h3>
                  <p className="text-sm text-text-secondary">
                    {release.artist_name} · {release.genre || '—'} · {release.track_count || members.length} tracks ·{' '}
                    {new Date(release.created_at).toLocaleString()}
                  </p>
                  <ol className="mt-3 space-y-2 text-sm text-text-secondary">
                    {members.map((m) => {
                      const currentIsrc = isrcValues[m.id] ?? m.isrc ?? ''
                      const query = isrcQuery[m.id] ?? ''
                      const auto = !currentIsrc
                        ? bestIsrcMatch(m.title, knownIsrcMap, { artistName: release.artist_name })
                        : null
                      const suggestions = suggestIsrcs(m.title, knownIsrcMap, {
                        artistName: release.artist_name,
                        query: query || undefined,
                        limit: 6,
                        minScore: query ? 0.2 : 0.35,
                      })
                      const menuOpen = openIsrcMenu === m.id
                      return (
                      <li key={m.id} className="rounded-lg border border-white/10 p-2">
                        <div className="flex flex-wrap items-center gap-3">
                          {canRotate && (
                            <input
                              type="checkbox"
                              checked={selectedRotationIds.includes(m.id)}
                              onChange={() => toggleRotationTrack(m.id)}
                              aria-label={`Select ${m.title} for rotation`}
                              className="h-4 w-4 accent-emerald-400"
                            />
                          )}
                          <span className="min-w-0 flex-1">{m.position}. {m.title}</span>
                        </div>
                        {m.file_url && (
                          <audio controls preload="none" src={m.file_url} className="mt-1 h-8 max-w-full" />
                        )}
                        <div className="relative mt-2">
                          <label className="mb-1 block text-[11px] uppercase tracking-wide text-text-secondary">
                            ISRC
                            {auto && !currentIsrc ? (
                              <button
                                type="button"
                                className="ml-2 normal-case tracking-normal text-brand underline"
                                onClick={() => {
                                  setIsrcValues((prev) => ({ ...prev, [m.id]: auto.isrc }))
                                  setIsrcQuery((prev) => ({ ...prev, [m.id]: '' }))
                                  setOpenIsrcMenu(null)
                                }}
                              >
                                Use suggestion {auto.isrc}
                              </button>
                            ) : null}
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <input
                              type="text"
                              value={currentIsrc}
                              onChange={(e) => {
                                const next = e.target.value.toUpperCase()
                                setIsrcValues((prev) => ({ ...prev, [m.id]: next }))
                                setIsrcQuery((prev) => ({ ...prev, [m.id]: next }))
                                setOpenIsrcMenu(m.id)
                              }}
                              onFocus={() => setOpenIsrcMenu(m.id)}
                              onBlur={() => {
                                // Delay so suggestion click registers.
                                window.setTimeout(() => {
                                  setOpenIsrcMenu((open) => (open === m.id ? null : open))
                                }, 150)
                              }}
                              placeholder="e.g. SE6XY2585728"
                              spellCheck={false}
                              className="min-w-[12rem] flex-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-xs text-text-primary"
                              aria-label={`ISRC for ${m.title}`}
                              autoComplete="off"
                            />
                            {currentIsrc && (
                              <button
                                type="button"
                                className="rounded-full border border-white/15 px-2 py-1 text-[11px]"
                                onClick={() => {
                                  setIsrcValues((prev) => ({ ...prev, [m.id]: '' }))
                                  setIsrcQuery((prev) => ({ ...prev, [m.id]: '' }))
                                }}
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          {menuOpen && suggestions.length > 0 && (
                            <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-white/15 bg-[#0f141c] shadow-xl">
                              {suggestions.map((suggestion) => (
                                <li key={`${m.id}-${suggestion.isrc}`}>
                                  <button
                                    type="button"
                                    className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-xs hover:bg-white/10"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                      setIsrcValues((prev) => ({ ...prev, [m.id]: suggestion.isrc }))
                                      setIsrcQuery((prev) => ({ ...prev, [m.id]: '' }))
                                      setOpenIsrcMenu(null)
                                    }}
                                  >
                                    <span className="font-mono text-brand">{suggestion.isrc}</span>
                                    <span className="text-text-secondary">
                                      {suggestion.title || 'Untitled'}
                                      {suggestion.artist_name ? ` · ${suggestion.artist_name}` : ''}
                                      {suggestion.source ? ` · ${suggestion.source}` : ''}
                                      {' · '}
                                      {Math.round(suggestion.score * 100)}% match
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                          {!currentIsrc && auto && (
                            <p className="mt-1 text-[11px] text-emerald-200/90">
                              Suggested from known catalogue: {auto.title} ({Math.round(auto.score * 100)}%)
                            </p>
                          )}
                        </div>
                      </li>
                      )
                    })}
                  </ol>
                  {canRotate && (
                    <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs text-text-secondary">
                      <p className="font-semibold text-text-primary">Rotation selection</p>
                      <p className="mt-1">Choose only the songs you want in continuous rotation. You can edit this selection after the complete album is published.</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setRotationSelections({ ...rotationSelections, [release.id]: members.map((m) => m.id) })} className="rounded-full border border-white/15 px-3 py-1">Select all</button>
                        <button type="button" onClick={() => setRotationSelections({ ...rotationSelections, [release.id]: [] })} className="rounded-full border border-white/15 px-3 py-1">Clear</button>
                        <span className="px-2 py-1">{selectedRotationIds.length} of {members.length} selected</span>
                      </div>
                      {release.is_public && (
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() => void act('update_release_rotation', {
                            releaseId: release.id,
                            rotationReleaseTrackIds: selectedRotationIds,
                          })}
                          className="mt-3 rounded-full bg-emerald-400 px-4 py-2 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Save rotation changes
                        </button>
                      )}
                    </div>
                  )}
                  <div className={`mt-4 rounded-xl border p-3 text-xs ${publishable ? 'border-emerald-400/30 bg-emerald-400/5' : 'border-amber-300/30 bg-amber-300/5'}`}>
                    <p className="font-semibold uppercase tracking-wider">
                      Rights Passport · {(release.preflight_status || 'not checked').replaceAll('_', ' ')}
                    </p>
                    {release.passport_version ? (
                      <>
                        <p className="mt-1 text-text-secondary">
                          © {release.copyright_year || '—'} · Master: {release.master_owner_name || 'missing'} ·
                          Composition: {release.composition_owner_names?.join(', ') || 'missing'} ·
                          Territory: {release.territories?.join(', ') || 'missing'}
                        </p>
                        <p className="mt-1 text-text-secondary">
                          {contributors.map((item) => `${item.person_name} (${item.contribution_role.replaceAll('_', ' ')})`).join(' · ') || 'No contributors recorded'}
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-text-secondary">Legacy approved release; recorded before Rights Passport v1.</p>
                    )}
                    {!publishable && Boolean(release.preflight_blockers?.length) && (
                      <ul className="mt-2 list-disc pl-5 text-amber-100">
                        {release.preflight_blockers?.map((blocker) => (
                          <li key={blocker}>{blocker.toLowerCase().replaceAll('_', ' ')}</li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-2 text-text-secondary">Material: {release.material_types?.map((item) => item.replaceAll('_', ' ')).join(', ') || 'legacy / undeclared'}</p>
                    {clearanceEvidence.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {clearanceEvidence.map((evidence) => (
                          <div key={evidence.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                            <p className="font-semibold">{evidence.material_type.replaceAll('_', ' ')} · v{evidence.evidence_version} · {evidence.review_status}</p>
                            <p className="mt-1 text-text-secondary">{evidence.original_file_name}{evidence.artist_notes ? ` · ${evidence.artist_notes}` : ''}</p>
                            {evidence.file_url && <a href={evidence.file_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-brand underline">Open private evidence</a>}
                            {evidence.review_notes && <p className="mt-2 text-text-secondary">Reviewer: {evidence.review_notes}</p>}
                            {canApprove && evidence.review_status === 'submitted' && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button type="button" disabled={Boolean(busy)} onClick={() => void act('review_release_clearance_evidence', { evidenceId: evidence.id, status: 'approved', notes: notes[release.id] || '' })} className="rounded-full bg-emerald-400 px-3 py-1 font-semibold text-black">Approve evidence</button>
                                <button type="button" disabled={Boolean(busy)} onClick={() => void act('review_release_clearance_evidence', { evidenceId: evidence.id, status: 'rejected', notes: notes[release.id] || '' })} className="rounded-full bg-red-400 px-3 py-1 font-semibold text-black">Reject evidence</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {release.passport_version ? (
                    <div className={`mt-3 rounded-xl border p-3 text-xs ${mediaReady ? 'border-emerald-400/30 bg-emerald-400/5' : 'border-blue-300/30 bg-blue-300/5'}`}>
                      <p className="font-semibold uppercase tracking-wider">Media preflight · {mediaReady ? 'ready' : 'processing / blocked'}</p>
                      <div className="mt-2 space-y-2">
                        {members.map((member) => {
                          const media = mediaJobs.find((item) => item.release_track_id === member.id)
                          return <div key={member.id} className="rounded-lg bg-black/20 p-2">
                            <p>{member.position}. {member.title} · <strong>{media?.status || 'not queued'}</strong></p>
                            {media?.codec_name && <p className="mt-1 text-text-secondary">{media.codec_name} · {Number(media.duration_seconds || 0).toFixed(1)}s · {media.sample_rate || 0} Hz · {media.channels || 0} ch · {media.loudness_lufs ?? '—'} LUFS · peak {media.true_peak_db ?? '—'} dB</p>}
                            <p className="mt-1 text-text-secondary">Malware scan: {media?.malware_status || 'pending'}{media?.error_code ? ` · ${media.error_code}` : ''}</p>
                            {Boolean(media?.blockers?.length) && <p className="mt-1 text-red-200">{media?.blockers?.join(' · ')}</p>}
                            {media?.waveform_path && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={media.waveform_path} alt={`Waveform for ${member.title}`} className="mt-2 h-16 w-full rounded object-cover" />
                            )}
                            {media?.preview_path && <audio controls preload="none" src={media.preview_path} className="mt-2 h-8 max-w-full" />}
                          </div>
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              {canApprove && (
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                  <textarea
                    value={notes[release.id] || release.editorial_notes || ''}
                    onChange={(e) => setNotes({ ...notes, [release.id]: e.target.value })}
                    placeholder="Editorial notes"
                    className="min-h-16 rounded-xl border border-white/10 bg-black/20 p-3 text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={Boolean(busy) || !publishable}
                      onClick={() =>
                        void act('publish_release', {
                          releaseId: release.id,
                          inRotation: selectedRotationIds.length > 0,
                          rotationReleaseTrackIds: selectedRotationIds,
                          trackIsrcs: trackIsrcsPayload(members),
                          notes: notes[release.id] || '',
                        })
                      }
                      className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Publish + selected rotation ({selectedRotationIds.length})
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busy) || !publishable}
                      onClick={() =>
                        void act('publish_release', {
                          releaseId: release.id,
                          inRotation: false,
                          trackIsrcs: trackIsrcsPayload(members),
                          notes: notes[release.id] || '',
                        })
                      }
                      className="rounded-full border border-brand px-4 py-2 text-xs text-brand disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Publish only
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void act('reject_release', {
                          releaseId: release.id,
                          notes: notes[release.id] || '',
                        })
                      }
                      className="rounded-full bg-red-400 px-4 py-2 text-xs font-semibold text-black"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}
              {job && (
                <div className="mt-4 rounded-xl border border-white/10 p-3 text-xs text-text-secondary">
                  <p className="text-[11px] uppercase tracking-wide text-brand">Multi-platform path</p>
                  <p className="mt-1">
                    Distribution job:{' '}
                    <strong className="text-text-primary">{editorialDistributionStatusLabel(job.status)}</strong>
                    {job.distributor ? ` · internal: ${job.distributor}` : ' · internal partner unset'}
                  </p>
                  {job.notes && <p className="mt-2 opacity-90">{job.notes}</p>}
                  <p className="mt-2 text-[11px] opacity-80">
                    Flow: eligible → queued (ops) → submitted (private partner) → live_on_dsp (stores live).
                    Do not name aggregator brands in artist-facing copy.
                  </p>
                  {canDistro && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[
                        ['eligible', 'Eligible'],
                        ['queued', 'Queue partner hand-off'],
                        ['submitted', 'Submitted to partner'],
                        ['live_on_dsp', 'Live on DSPs'],
                        ['failed', 'Failed'],
                        ['not_eligible', 'Not eligible'],
                      ].map(([status, label]) => (
                        <button
                          key={status}
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() =>
                            void act('update_distribution_job', {
                              jobId: job.id,
                              status,
                              distributor:
                                status === 'not_eligible' ? null : PRIVATE_DSP_PARTNER_CODE,
                              notes:
                                status === 'queued'
                                  ? 'Queued for private DSP partner hand-off after BVS publish.'
                                  : status === 'submitted'
                                    ? 'Delivered to private DSP partner — awaiting store approval.'
                                    : status === 'live_on_dsp'
                                      ? 'Live on major platforms. Link ISRC / Spotify URLs on tracks.'
                                      : undefined,
                            })
                          }
                          className="rounded-full border border-white/15 px-3 py-1 hover:border-brand"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </article>
          )
        })}
        </EditorialSectionCarousel>
          )
        })()
      )}
    </section>
  )
}
