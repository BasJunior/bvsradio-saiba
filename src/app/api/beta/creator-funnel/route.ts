import { NextResponse } from 'next/server'
import { editorialIdentity, editorialUrl, serviceHeaders } from '@/lib/editorial-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function count(eventName: string, since: string, propertyFilter?: { key: string; value: string }) {
  const filter = propertyFilter
    ? `&properties->>${encodeURIComponent(propertyFilter.key)}=eq.${encodeURIComponent(propertyFilter.value)}`
    : ''
  const response = await fetch(
    editorialUrl(`analytics_events?event_name=eq.${encodeURIComponent(eventName)}&created_at=gte.${encodeURIComponent(since)}&select=id${filter}`),
    { headers: { ...serviceHeaders, Prefer: 'count=exact' }, cache: 'no-store' },
  )
  if (!response.ok) return null
  const range = response.headers.get('content-range') || ''
  const total = Number(range.split('/').pop())
  return Number.isFinite(total) ? total : null
}

function percent(numerator: number | null, denominator: number | null) {
  if (numerator == null || denominator == null || denominator <= 0) return null
  return Math.round((numerator / denominator) * 1000) / 10
}

export async function GET(request: Request) {
  const identity = await editorialIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Active Editorial staff access is required.' }, { status: 403 })

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [
    studioOpen,
    releaseIntent,
    beatIntent,
    serviceIntent,
    formStarted,
    submissionComplete,
    beatView,
    licenceSelected,
    beatPaymentConfirmed,
    lyricsPadOpen,
    lyricsFirstSave,
    lyricsReturnSession,
    prepareRelease,
    releaseSubmitted,
  ] = await Promise.all([
    count('studio_open', since),
    count('create_intent_selected', since, { key: 'intent', value: 'release' }),
    count('create_intent_selected', since, { key: 'intent', value: 'beat' }),
    count('create_intent_selected', since, { key: 'intent', value: 'service' }),
    count('create_form_started', since),
    count('create_submission_complete', since),
    count('beat_view', since),
    count('licence_selected', since),
    count('payment_confirmed', since, { key: 'has_beat', value: 'true' }),
    count('lyrics_pad_open', since),
    count('lyrics_first_save', since),
    count('lyrics_return_session', since),
    count('prepare_release', since),
    count('release_submitted', since),
  ])

  return NextResponse.json({
    windowDays: 30,
    generatedAt: new Date().toISOString(),
    creator: {
      studioOpen,
      intents: { release: releaseIntent, beat: beatIntent, service: serviceIntent },
      formStarted,
      submissionComplete,
      studioToFormPercent: percent(formStarted, studioOpen),
      formToSubmitPercent: percent(submissionComplete, formStarted),
    },
    beatToRelease: {
      beatView,
      licenceSelected,
      beatPaymentConfirmed,
      lyricsPadOpen,
      lyricsFirstSave,
      lyricsReturnSession,
      prepareRelease,
      releaseSubmitted,
      beatViewToLicencePercent: percent(licenceSelected, beatView),
      licenceToPaidPercent: percent(beatPaymentConfirmed, licenceSelected),
      paidToLyricsOpenPercent: percent(lyricsPadOpen, beatPaymentConfirmed),
      lyricsOpenToFirstSavePercent: percent(lyricsFirstSave, lyricsPadOpen),
      firstSaveToPreparePercent: percent(prepareRelease, lyricsFirstSave),
      prepareToReleasePercent: percent(releaseSubmitted, prepareRelease),
    },
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}
