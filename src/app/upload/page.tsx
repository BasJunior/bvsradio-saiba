'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { trackEvent } from '@/lib/analytics'
import { isAllowedAudioFile } from '@/lib/audio-formats'

export default function UploadPage() {
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [description, setDescription] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [artworkFile, setArtworkFile] = useState<File | null>(null)
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [explicit, setExplicit] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [signedInAs, setSignedInAs] = useState<string | null>(null)

  const genres = [
    'Hip-Hop', 'Trap', 'Afrobeats', 'Amapiano', 'R&B',
    'Dancehall', 'Electronic', 'Lofi', 'Gospel', 'Jazz', 'Pop',
    'Sungura', 'Zimdancehall', 'Chimurenga', 'Other',
  ]

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    void supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user?.email
      setSignedInAs(email || (data.session ? 'signed in' : null))
    })
  }, [])

  const onAudioChosen = (file: File | null) => {
    setError(null)
    if (!file) {
      setAudioFile(null)
      return
    }
    // Log for support if something still fails
    console.info('[bvs upload] file chosen', {
      name: file.name,
      type: file.type || '(empty)',
      size: file.size,
    })
    const check = isAllowedAudioFile(file)
    if (!check.ok) {
      setAudioFile(null)
      setError(check.error || 'Unsupported audio file.')
      return
    }
    setAudioFile(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setError(null)

    if (!audioFile) {
      setError('Choose an audio file first (MP3, WAV, M4A, FLAC, OGG or AAC — not video).')
      return
    }
    if (!title.trim()) {
      setError('Enter a track title.')
      return
    }
    if (!genre) {
      setError('Select a genre from the list.')
      return
    }
    if (!rightsConfirmed) {
      setError('Tick “I control the necessary rights” before submitting.')
      return
    }
    const check = isAllowedAudioFile(audioFile)
    if (!check.ok) {
      setError(check.error || 'Unsupported audio file.')
      return
    }
    if (!isSupabaseConfigured()) {
      setError('Account service is not configured. Contact BVS.')
      return
    }

    setLoading(true)

    const formData = new FormData()
    formData.append('title', title.trim())
    formData.append('genre', genre)
    formData.append('description', description.trim())
    formData.append('audio', audioFile, audioFile.name)
    formData.append('rightsConfirmed', 'true')
    formData.append('explicit', explicit ? 'true' : 'false')
    if (artworkFile) formData.append('artwork', artworkFile, artworkFile.name)

    try {
      const supabase = createClient()
      // Prefer getUser() so we refresh a stale access token when possible
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error('[bvs upload] getUser', userError)
        throw new Error(
          /pattern|jwt|session|refresh/i.test(userError.message)
            ? 'Your sign-in session is invalid. Sign out, sign in again, then submit.'
            : userError.message,
        )
      }
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        console.error('[bvs upload] getSession', sessionError)
        throw new Error('Could not read your session. Sign out and sign in again.')
      }
      if (!userData.user || !session?.access_token) {
        throw new Error('Please sign in before submitting. Use Sign In (top right), then return here.')
      }

      const res = await fetch('/api/tracks/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })
      let data: { error?: string; message?: string; track?: { id?: string } } = {}
      try {
        data = await res.json()
      } catch {
        throw new Error(`Upload failed (server ${res.status}). Try again or contact BVS.`)
      }
      if (!res.ok) {
        console.error('[bvs upload] api error', res.status, data)
        throw new Error(data.error || `Upload failed (${res.status})`)
      }
      trackEvent('upload_complete', { genre, has_artwork: Boolean(artworkFile) })
      setSuccess(true)
    } catch (err: unknown) {
      console.error('[bvs upload] failed', err)
      const raw = err instanceof Error ? err.message : String(err)
      const msg =
        /did not match the expected pattern|match the requested format|typeMismatch|patternMismatch|Invalid regular expression/i.test(
          raw,
        )
          ? 'Browser rejected a form value (often a bad session or video file). Sign out → sign in → pick a WAV/MP3 (not MP4 video) → fill title + genre → submit again.'
          : raw
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-brand/20">
            <svg className="h-8 w-8 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mb-4 text-2xl font-bold">Submission received</h1>
          <p className="mb-6 text-text-secondary">
            BVS has your files in private review storage. Status is <strong className="text-text-primary">submitted</strong> —
            not live on radio until editorial approves. Staff: Admin → Editorial.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setSuccess(false)
                setTitle('')
                setGenre('')
                setDescription('')
                setAudioFile(null)
                setArtworkFile(null)
                setRightsConfirmed(false)
                setExplicit(false)
              }}
              className="rounded-full bg-brand px-6 py-3 font-semibold text-black transition-all hover:bg-brand-dark"
            >
              Upload Another
            </button>
            <Link
              href="/admin/editorial"
              className="rounded-full border border-white/20 px-6 py-3 transition-all hover:bg-white/5"
            >
              Open Editorial
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="grid gap-16 lg:grid-cols-2">
        <div>
          <p className="mb-3 text-xs uppercase tracking-[3px] text-brand">For artists · Radio submission</p>
          <h1 className="mb-4 text-5xl font-bold tracking-tight">Submit your music to BVS.</h1>
          <p className="mb-8 text-xl text-text-secondary">
            Send an original release for editorial review. This form is for radio and catalogue consideration, not for
            ordering mixing or mastering.
          </p>

          <section
            id="requirements"
            aria-labelledby="requirements-heading"
            className="scroll-mt-24 rounded-2xl border border-white/10 bg-bg-card/30 p-6"
          >
            <h2 id="requirements-heading" className="text-2xl font-semibold">
              Submission requirements
            </h2>
            <p className="mt-2 text-sm text-text-secondary">Prepare these essentials before you upload.</p>
            <div className="mt-6 space-y-6 text-sm">
              <div className="flex gap-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                  1
                </div>
                <div>
                  <strong className="mb-1 block">Confirm eligibility and rights</strong> Submit original work only, with
                  permission from every artist, producer and rights holder.
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                  2
                </div>
                <div>
                  <strong className="mb-1 block">Prepare the audio file</strong> Upload{' '}
                  <strong>MP3, WAV, M4A, FLAC, OGG or AAC</strong> — not video (no phone MP4/MOV). Compressed audio max
                  ~40MB; WAV/FLAC max ~100MB.
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                  3
                </div>
                <div>
                  <strong className="mb-1 block">Add release details</strong> Title, genre, optional cover art and
                  description (language, city, features).
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                  4
                </div>
                <div>
                  <strong className="mb-1 block">Understand the review</strong> Upload does not guarantee airplay or
                  publication.
                </div>
              </div>
            </div>
          </section>

          <div className="mt-8 rounded-xl border border-white/10 bg-bg-card/40 p-5 text-sm text-text-secondary">
            Need engineering instead?{' '}
            <Link href="/shop" className="font-medium text-brand hover:underline">
              See mixing and mastering packages
            </Link>
            . Need help?{' '}
            <Link href="/contact" className="font-medium text-brand hover:underline">
              Contact BVS
            </Link>
            .
          </div>

          <div className="mt-10">
            <Image
              src="/images/musicians.jpg"
              alt="Artists in the studio"
              width={520}
              height={320}
              className="rounded-2xl"
            />
          </div>
        </div>

        <div className="pt-2">
          {/* noValidate: never show cryptic browser “pattern” tooltips */}
          <form onSubmit={handleSubmit} noValidate className="space-y-6 rounded-2xl border border-white/10 bg-bg-card/30 p-8">
            <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-text-secondary">
              <strong className="text-text-primary">Where it goes:</strong> Supabase storage bucket{' '}
              <code className="text-brand">bvsradio-audio</code> under{' '}
              <code className="text-brand">tracks/…</code>, plus a <em>submitted</em> row for staff at{' '}
              <Link href="/admin/editorial" className="text-brand hover:underline">
                Admin → Editorial
              </Link>
              . Not on radio until approved.
              <br />
              {signedInAs ? (
                <span className="mt-1 inline-block text-brand">Signed in as {signedInAs}</span>
              ) : (
                <span className="mt-1 inline-block">
                  Not signed in —{' '}
                  <Link href="/auth/login" className="text-brand hover:underline">
                    Sign in
                  </Link>{' '}
                  first.
                </span>
              )}
            </p>

            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="audio-upload">
                Audio File *
              </label>
              <div className="rounded-2xl border-2 border-dashed border-white/20 p-8 text-center transition-colors hover:border-brand/50">
                {/* No accept= — WebKit can throw “string did not match the expected pattern” on some accept lists */}
                <input
                  type="file"
                  onChange={(e) => onAudioChosen(e.target.files?.[0] || null)}
                  className="hidden"
                  id="audio-upload"
                />
                <label htmlFor="audio-upload" className="block cursor-pointer">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <p className="text-sm font-medium">
                    {audioFile ? audioFile.name : 'Select audio (MP3, WAV, M4A, FLAC, OGG, AAC)'}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    Not video · MP3/M4A/OGG/AAC ≤40MB · WAV/FLAC ≤100MB
                    {audioFile ? ` · detected type: ${audioFile.type || 'unknown'}` : ''}
                  </p>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium" htmlFor="track-title">
                  Track Title *
                </label>
                <input
                  id="track-title"
                  name="trackTitle"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3 outline-none focus:border-brand"
                  placeholder="My New Single"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium" htmlFor="track-genre">
                  Genre *
                </label>
                <select
                  id="track-genre"
                  name="trackGenre"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-bg-primary px-4 py-3 text-text-primary outline-none focus:border-brand"
                >
                  <option value="">Select genre</option>
                  {genres.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="track-description">
                Description
              </label>
              <textarea
                id="track-description"
                name="trackDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full resize-y rounded-xl border border-white/10 bg-bg-primary px-4 py-3 outline-none focus:border-brand"
                placeholder="What inspired this track? Language, city, features…"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Cover Artwork (optional)</label>
              <div className="rounded-xl border border-white/10 p-4">
                <input
                  type="file"
                  onChange={(e) => setArtworkFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="artwork"
                />
                <label htmlFor="artwork" className="flex cursor-pointer items-center gap-3 text-sm">
                  <span className="rounded-lg border border-white/20 px-3 py-1.5 hover:bg-white/5">Choose image</span>
                  <span className="text-text-secondary">
                    {artworkFile ? artworkFile.name : 'Recommended 1000×1000px'}
                  </span>
                </label>
              </div>
            </div>

            <label className="flex gap-3 rounded-xl border border-white/10 p-4 text-sm">
              <input
                type="checkbox"
                checked={rightsConfirmed}
                onChange={(event) => setRightsConfirmed(event.target.checked)}
                className="mt-1 accent-brand"
              />
              <span>
                <strong className="block">I control the necessary rights</strong>
                <span className="text-text-secondary">
                  I have permission from all artists, producers and rights holders to submit this recording.
                </span>
              </span>
            </label>

            <label className="flex gap-3 rounded-xl border border-white/10 p-4 text-sm">
              <input
                type="checkbox"
                checked={explicit}
                onChange={(event) => setExplicit(event.target.checked)}
                className="mt-1 accent-brand"
              />
              <span>
                <strong className="block">Explicit content</strong>
                <span className="text-text-secondary">
                  Mark this when the recording contains explicit language or themes.
                </span>
              </span>
            </label>

            {error && (
              <div role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-brand py-4 text-lg font-semibold text-black transition-all hover:bg-brand-dark disabled:opacity-60"
            >
              {loading ? 'Uploading to BVS…' : 'Upload & Submit for Review'}
            </button>

            <p className="text-center text-xs text-text-secondary">
              Keep your own copy of every file. Fill <strong>title</strong> and <strong>genre</strong> before submit —
              empty fields used to trigger confusing browser errors.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
