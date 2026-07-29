'use client'

import { useState } from 'react'

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
}

type ReleaseTrack = {
  id: string
  release_id: string
  position: number
  title: string
  file_url?: string
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
  mediaProcessingJobs,
  distributionJobs,
  canApprove,
  canRotate,
  canDistro,
  act,
  busy,
}: {
  releases: Release[]
  releaseTracks: ReleaseTrack[]
  releaseContributors: ReleaseContributor[]
  mediaProcessingJobs: MediaProcessingJob[]
  distributionJobs: DistJob[]
  canApprove: boolean
  canRotate: boolean
  canDistro: boolean
  act: (action: string, body: Record<string, unknown>) => Promise<void>
  busy: string
}) {
  const [notes, setNotes] = useState<Record<string, string>>({})

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
      <div className="mt-5 space-y-4">
        {releases.map((release) => {
          const members = releaseTracks.filter((t) => t.release_id === release.id)
          const contributors = releaseContributors.filter((item) => item.release_id === release.id)
          const mediaJobs = mediaProcessingJobs.filter((item) => item.release_id === release.id)
          const job = distributionJobs.find((j) => j.release_id === release.id)
          const rightsReady = ['ready', 'legacy_approved'].includes(release.preflight_status || '')
          const mediaReady = release.passport_version === 0 ||
            (members.length > 0 && mediaJobs.length === members.length && mediaJobs.every((item) => item.status === 'ready'))
          const publishable = rightsReady && mediaReady
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
                  <ol className="mt-3 space-y-1 text-sm text-text-secondary">
                    {members.map((m) => (
                      <li key={m.id}>
                        {m.position}. {m.title}
                        {m.file_url && (
                          <audio controls preload="none" src={m.file_url} className="mt-1 h-8 max-w-full" />
                        )}
                      </li>
                    ))}
                  </ol>
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
                          inRotation: true,
                          notes: notes[release.id] || '',
                        })
                      }
                      className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Publish + rotation
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busy) || !publishable}
                      onClick={() =>
                        void act('publish_release', {
                          releaseId: release.id,
                          inRotation: false,
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
                    {canRotate && release.is_public && (
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          void act('set_release_rotation', {
                            releaseId: release.id,
                            enabled: !release.in_rotation,
                          })
                        }
                        className="rounded-full border border-white/20 px-4 py-2 text-xs"
                      >
                        {release.in_rotation ? 'Remove from rotation' : 'Add to rotation'}
                      </button>
                    )}
                  </div>
                </div>
              )}
              {job && (
                <div className="mt-4 rounded-xl border border-white/10 p-3 text-xs text-text-secondary">
                  Distribution job: <strong className="text-text-primary">{job.status}</strong>
                  {job.distributor ? ` · ${job.distributor}` : ' · partner TBD'}
                  {canDistro && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {['eligible', 'queued', 'submitted', 'live_on_dsp', 'not_eligible'].map((status) => (
                        <button
                          key={status}
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() => void act('update_distribution_job', { jobId: job.id, status })}
                          className="rounded-full border border-white/15 px-3 py-1 hover:border-brand"
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
