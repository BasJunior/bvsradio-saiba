'use client'

import {
  AMUSE_PILOT_HANDOFF_CHECKLIST,
  PRIVATE_DSP_PARTNER_AMUSE,
  editorialDistributionStatusLabel,
  partnerHandoffNotes,
} from '@/lib/distribution-path'

export type EditorialDistJob = {
  id?: string
  status?: string
  distributor?: string | null
  notes?: string | null
}

export default function EditorialAmuseQueue({
  premium,
  job,
  canDistro,
  busy,
  onEnsure,
  onUpdate,
}: {
  premium: boolean
  job?: EditorialDistJob | null
  canDistro: boolean
  busy?: boolean
  onEnsure: () => void | Promise<void>
  onUpdate: (status: string) => void | Promise<void>
}) {
  if (!premium) return null
  return (
    <div className="mt-4 rounded-xl border border-white/10 p-3 text-xs text-text-secondary">
      <p className="text-[11px] uppercase tracking-wide text-brand">Multi-platform path · Amuse pilot (staff only)</p>
      <p className="mt-1">
        This artist has active Premium.
        {job?.id ? (
          <>
            {' '}
            Job: <strong className="text-text-primary">{editorialDistributionStatusLabel(job.status)}</strong>
            {job.distributor ? ` · internal: ${job.distributor}` : ''}
          </>
        ) : (
          ' No Amuse job yet — create the queue when packaging is ready.'
        )}
      </p>
      {job?.notes ? <p className="mt-2 opacity-90">{job.notes}</p> : null}
      <p className="mt-2 text-[11px] opacity-80">
        Flow: eligible → queued → submitted (Amuse) → live_on_dsp. Public/artist UI stays partner-anonymous.
      </p>
      <details className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
        <summary className="cursor-pointer font-medium text-text-primary">Amuse hand-off checklist</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] text-text-secondary">
          {AMUSE_PILOT_HANDOFF_CHECKLIST.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </details>
      {canDistro && (
        <div className="mt-2 flex flex-wrap gap-2">
          {!job?.id ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onEnsure()}
              className="rounded-full bg-brand px-3 py-1 font-semibold text-black disabled:opacity-40"
            >
              Create Amuse queue
            </button>
          ) : (
            ([
              ['eligible', 'Eligible'],
              ['queued', 'Queue Amuse hand-off'],
              ['submitted', 'Submitted to Amuse'],
              ['live_on_dsp', 'Live on DSPs'],
              ['failed', 'Failed'],
              ['not_eligible', 'Not eligible'],
            ] as const).map(([status, label]) => (
              <button
                key={status}
                type="button"
                disabled={busy}
                onClick={() => void onUpdate(status)}
                className="rounded-full border border-white/15 px-3 py-1 hover:border-brand disabled:opacity-40"
              >
                {label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export { PRIVATE_DSP_PARTNER_AMUSE, partnerHandoffNotes }
