'use client'

import StoreDeliveryPackForm from '@/components/StoreDeliveryPackForm'
import { publicDistributionStatusLabel } from '@/lib/distribution-path'

type DistJob = {
  id: string
  release_id?: string | null
  track_id?: string | null
  artist_user_id?: string
  status: string
  distributor?: string | null
  notes?: string | null
  pack_complete?: boolean
  store_pack?: Record<string, unknown> | null
}

type Release = {
  id: string
  title: string
  artist_name: string
  editorial_status: string
  is_public: boolean
  user_id?: string
}

export default function EditorialStoreDeliveryQueue({
  token,
  jobs,
  releases,
  canDistro,
  busy,
  act,
}: {
  token: string
  jobs: DistJob[]
  releases: Release[]
  canDistro: boolean
  busy?: string
  act: (action: string, body: Record<string, unknown>) => Promise<void>
}) {
  const releaseById = new Map(releases.map((release) => [release.id, release]))
  const jobReleaseIds = new Set(jobs.map((job) => job.release_id).filter(Boolean))
  const publishedPremiumMissing = releases.filter(
    (release) => release.is_public && release.editorial_status === 'approved' && !jobReleaseIds.has(release.id),
  )
  const activeJobs = jobs.filter((job) =>
    ['eligible', 'queued', 'submitted', 'failed'].includes(String(job.status || '')),
  )
  const items = [
    ...activeJobs.map((job) => ({ job, release: job.release_id ? releaseById.get(job.release_id) : undefined })),
    ...publishedPremiumMissing.map((release) => ({ job: null as DistJob | null, release })),
  ]

  return (
    <section id="ed-store-delivery" className="mt-8 scroll-mt-36 rounded-2xl border border-brand/25 bg-brand/[.04] p-5">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Store delivery</p>
      <h2 className="mt-2 text-2xl font-semibold">Send approved Premium releases to stores</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
        This is the working queue after BVS publish. Complete the store details, copy the send sheet, then mark the
        release sent once it is actually with stores. Do not tell the artist it is on Spotify until stores are live.
      </p>
      <div className="mt-5 space-y-4">
        {items.map(({ job, release }) => {
          const releaseId = release?.id || job?.release_id
          if (!releaseId) return null
          return (
            <article key={job?.id || releaseId} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{release?.title || 'Release'}</h3>
                  <p className="mt-1 text-xs text-text-secondary">
                    {release?.artist_name || 'Artist'} · {publicDistributionStatusLabel(job?.status)}
                    {job?.pack_complete ? ' · store details complete' : ' · store details still needed'}
                  </p>
                </div>
                {canDistro && job?.id && (
                  <div className="flex flex-wrap gap-2">
                    {[
                      ['queued', 'Ready to send'],
                      ['submitted', 'Sent for store review'],
                      ['live_on_dsp', 'Live on stores'],
                      ['failed', 'Needs a fix'],
                    ].map(([status, label]) => (
                      <button
                        key={status}
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => void act('update_distribution_job', { jobId: job.id, status })}
                        className="rounded-full border border-white/15 px-3 py-1 text-xs hover:border-brand disabled:opacity-40"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-4">
                <StoreDeliveryPackForm token={token} releaseId={releaseId} staff />
              </div>
            </article>
          )
        })}
        {!items.length && (
          <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-text-secondary">
            No Premium store-delivery work right now. After you publish a Premium artist’s release it will appear here.
          </p>
        )}
      </div>
    </section>
  )
}
