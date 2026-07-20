'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { trackEvent } from '@/lib/analytics'
import { AUDIO_ACCEPT_ATTR, isAllowedAudioFile } from '@/lib/audio-formats'

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

  const genres = [
    'Hip-Hop', 'Trap', 'Afrobeats', 'Amapiano', 'R&B',
    'Dancehall', 'Electronic', 'Lofi', 'Gospel', 'Jazz', 'Pop',
    'Sungura', 'Zimdancehall', 'Chimurenga', 'Other',
  ]

  const onAudioChosen = (file: File | null) => {
    setError(null)
    if (!file) {
      setAudioFile(null)
      return
    }
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
    if (!audioFile || !title || !genre) {
      setError('Title, genre, and audio file are required')
      return
    }
    if (!rightsConfirmed) {
      setError('Confirm you control the rights before submitting.')
      return
    }
    const check = isAllowedAudioFile(audioFile)
    if (!check.ok) {
      setError(check.error || 'Unsupported audio file.')
      return
    }
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('title', title)
    formData.append('genre', genre)
    formData.append('description', description)
    formData.append('audio', audioFile)
    formData.append('rightsConfirmed', String(rightsConfirmed))
    formData.append('explicit', String(explicit))
    if (artworkFile) formData.append('artwork', artworkFile)

    try {
      const supabase = createClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        throw new Error(sessionError.message || 'Could not read your session. Sign in again.')
      }
      if (!session?.access_token) {
        throw new Error('Please sign in before submitting your track. Use Sign In (top right), then return to Upload.')
      }

      const res = await fetch('/api/tracks/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })
      let data: { error?: string; message?: string } = {}
      try {
        data = await res.json()
      } catch {
        throw new Error(`Upload failed (server ${res.status}). Try again or contact BVS.`)
      }
      if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`)
      trackEvent('upload_complete', { genre, has_artwork: Boolean(artworkFile) })
      setSuccess(true)
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Upload failed'
      // Browser native validity text is cryptic — rewrite for artists
      const msg =
        /did not match the expected pattern|match the requested format|typeMismatch|patternMismatch/i.test(raw)
          ? 'Something in the form was invalid (often email at sign-in, or a video file instead of audio). Use a real email to sign in, and upload MP3/WAV/M4A/FLAC — not phone video (MP4).'
          : raw
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-brand/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-4">Submission received</h1>
          <p className="text-text-secondary mb-6">BVS has received your files for editorial review. Submission does not guarantee radio play or catalogue publication; we will contact you if more information is needed.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => { setSuccess(false); setTitle(''); setGenre(''); setDescription(''); setAudioFile(null); setArtworkFile(null) }} className="px-6 py-3 bg-brand text-black font-semibold rounded-full hover:bg-brand-dark transition-all">
              Upload Another
            </button>
            <Link href="/catalogue" className="px-6 py-3 border border-white/20 rounded-full hover:bg-white/5 transition-all">Browse Catalogue</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="grid lg:grid-cols-2 gap-16">
        {/* Left side - Info */}
        <div>
          <p className="mb-3 text-xs uppercase tracking-[3px] text-brand">For artists · Radio submission</p>
          <h1 className="text-5xl font-bold tracking-tight mb-4">Submit your music to BVS.</h1>
          <p className="text-xl text-text-secondary mb-8">Send an original release for editorial review. This form is for radio and catalogue consideration, not for ordering mixing or mastering.</p>

          <section id="requirements" aria-labelledby="requirements-heading" className="scroll-mt-24 rounded-2xl border border-white/10 bg-bg-card/30 p-6">
            <h2 id="requirements-heading" className="text-2xl font-semibold">Submission requirements</h2>
            <p className="mt-2 text-sm text-text-secondary">Prepare these essentials before you upload.</p>
            <div className="mt-6 space-y-6 text-sm">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center flex-shrink-0">1</div>
              <div><strong className="block mb-1">Confirm eligibility and rights</strong> Submit original work only, with permission from every artist, producer and rights holder.</div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center flex-shrink-0">2</div>
              <div><strong className="block mb-1">Prepare the audio file</strong> Upload <strong>MP3, WAV, M4A, FLAC, OGG or AAC</strong> — not video (no phone MP4/MOV). Compressed audio max ~40MB; WAV/FLAC max ~100MB. 320kbps MP3 or release-ready WAV preferred for Zimbabwe radio review.</div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center flex-shrink-0">3</div>
              <div><strong className="block mb-1">Add release details</strong> Provide the track title, genre and optional square cover artwork. Add context in the description when useful (language, city, features).</div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center flex-shrink-0">4</div>
              <div><strong className="block mb-1">Understand the review</strong> BVS decides what fits Zimbabwean-facing programming. Uploading does not guarantee airplay, publication or feedback.</div>
            </div>
            </div>
          </section>

          <div className="mt-8 rounded-xl border border-white/10 bg-bg-card/40 p-5 text-sm text-text-secondary">
            Need engineering instead? <Link href="/shop" className="font-medium text-brand hover:underline">See mixing and mastering packages</Link>. Need help with rights or a submission already sent? <Link href="/contact" className="font-medium text-brand hover:underline">Contact BVS</Link>.
          </div>

          <div className="mt-10">
            <Image src="/images/musicians.jpg" alt="Artists in the studio" width={520} height={320} className="rounded-2xl" />
          </div>
        </div>

        {/* Form */}
        <div className="pt-2">
          <form onSubmit={handleSubmit} noValidate className="space-y-6 bg-bg-card/30 border border-white/10 p-8 rounded-2xl">
            <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-text-secondary">
              <strong className="text-text-primary">Where it goes:</strong> files land in BVS private review storage (Supabase), a row is created as <em>submitted</em>, and staff review at Admin → Editorial. Not live on radio until approved.
              {' '}
              <Link href="/auth/login" className="text-brand hover:underline">Sign in</Link>
              {' · '}
              <Link href="/auth/signup" className="text-brand hover:underline">Create account</Link>
            </p>
            <div>
              <label className="block text-sm font-medium mb-1.5">Audio File *</label>
              <div className="border-2 border-dashed border-white/20 hover:border-brand/50 rounded-2xl p-8 text-center transition-colors">
                <input type="file" accept={AUDIO_ACCEPT_ATTR} onChange={(e) => onAudioChosen(e.target.files?.[0] || null)} className="hidden" id="audio-upload" />
                <label htmlFor="audio-upload" className="cursor-pointer block">
                  <div className="mx-auto w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  </div>
                  <p className="text-sm font-medium">{audioFile ? audioFile.name : 'Select audio (MP3, WAV, M4A, FLAC, OGG, AAC)'}</p>
                  <p className="text-xs text-text-secondary mt-1">Not video · MP3/M4A/OGG/AAC ≤40MB · WAV/FLAC ≤100MB</p>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Track Title *</label>
                <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-white/10 rounded-xl focus:border-brand outline-none" placeholder="My New Single" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Genre *</label>
                <select value={genre} onChange={(e) => setGenre(e.target.value)} className="w-full px-4 py-3 bg-bg-primary border border-white/10 rounded-xl focus:border-brand outline-none text-text-primary" required>
                  <option value="">Select genre</option>
                  {genres.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-4 py-3 bg-bg-primary border border-white/10 rounded-xl focus:border-brand outline-none resize-y" placeholder="What inspired this track? Any special story behind it?" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Cover Artwork (optional)</label>
              <div className="border border-white/10 rounded-xl p-4">
                <input type="file" accept="image/*" onChange={(e) => setArtworkFile(e.target.files?.[0] || null)} className="hidden" id="artwork" />
                <label htmlFor="artwork" className="cursor-pointer flex items-center gap-3 text-sm">
                  <span className="px-3 py-1.5 border border-white/20 rounded-lg hover:bg-white/5">Choose image</span>
                  <span className="text-text-secondary">{artworkFile ? artworkFile.name : 'Recommended 1000×1000px'}</span>
                </label>
              </div>
            </div>

            <label className="flex gap-3 rounded-xl border border-white/10 p-4 text-sm"><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} required className="mt-1 accent-brand" /><span><strong className="block">I control the necessary rights</strong><span className="text-text-secondary">I have permission from all artists, producers and rights holders to submit this recording.</span></span></label>

            <label className="flex gap-3 rounded-xl border border-white/10 p-4 text-sm"><input type="checkbox" checked={explicit} onChange={(event) => setExplicit(event.target.checked)} className="mt-1 accent-brand" /><span><strong className="block">Explicit content</strong><span className="text-text-secondary">Mark this when the recording contains explicit language or themes.</span></span></label>

            {error && <div className="text-sm bg-red-500/10 text-red-400 p-3 rounded-xl">{error}</div>}

            <button type="submit" disabled={loading || !rightsConfirmed} className="w-full py-4 bg-brand hover:bg-brand-dark disabled:opacity-60 text-black font-semibold rounded-full text-lg transition-all">
              {loading ? 'Uploading to BVS...' : 'Upload & Submit for Review'}
            </button>

            <p className="text-center text-xs text-text-secondary">Keep your own copy of every file. Review times vary; BVS will contact you using the details connected to your account.</p>
          </form>
        </div>
      </div>
    </div>
  )
}
