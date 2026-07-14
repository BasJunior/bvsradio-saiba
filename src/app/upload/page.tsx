'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export default function UploadPage() {
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('')
  const [description, setDescription] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [artworkFile, setArtworkFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const genres = [
    'Hip-Hop', 'Trap', 'Afrobeats', 'Amapiano', 'R&B',
    'Dancehall', 'Electronic', 'Lofi', 'Gospel', 'Jazz', 'Pop', 'Other'
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!audioFile || !title || !genre) {
      setError('Title, genre, and audio file are required')
      return
    }
    setLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append('title', title)
    formData.append('genre', genre)
    formData.append('description', description)
    formData.append('audio', audioFile)
    if (artworkFile) formData.append('artwork', artworkFile)

    try {
      const res = await fetch('/api/tracks/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setSuccess(true)
    } catch (err: any) {
      setError(err.message)
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
          <h1 className="text-2xl font-bold mb-4">Track Uploaded Successfully!</h1>
          <p className="text-text-secondary mb-6">Thank you for contributing to the sound of Zimbabwe. Your track will be reviewed and added to the catalogue soon.</p>
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
          <h1 className="text-5xl font-bold tracking-tight mb-4">Share your sound with Zimbabwe.</h1>
          <p className="text-xl text-text-secondary mb-8">Upload your original music and join a growing community of artists shaping the future of African sound.</p>

          <div className="space-y-6 text-sm">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center flex-shrink-0">1</div>
              <div><strong className="block mb-1">Upload original work only</strong> We support independent artists who own their masters.</div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center flex-shrink-0">2</div>
              <div><strong className="block mb-1">High quality audio</strong> 320kbps MP3 or WAV preferred for the best listening experience.</div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center flex-shrink-0">3</div>
              <div><strong className="block mb-1">Get discovered</strong> Your tracks can reach listeners in Zimbabwe and across the diaspora.</div>
            </div>
          </div>

          <div className="mt-10">
            <Image src="/images/musicians.jpg" alt="Artists in the studio" width={520} height={320} className="rounded-2xl" />
          </div>
        </div>

        {/* Form */}
        <div className="pt-2">
          <form onSubmit={handleSubmit} className="space-y-6 bg-bg-card/30 border border-white/10 p-8 rounded-2xl">
            <div>
              <label className="block text-sm font-medium mb-1.5">Audio File *</label>
              <div className="border-2 border-dashed border-white/20 hover:border-brand/50 rounded-2xl p-8 text-center transition-colors">
                <input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} className="hidden" id="audio-upload" />
                <label htmlFor="audio-upload" className="cursor-pointer block">
                  <div className="mx-auto w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  </div>
                  <p className="text-sm font-medium">{audioFile ? audioFile.name : 'Select your track (MP3, WAV, OGG)'}</p>
                  <p className="text-xs text-text-secondary mt-1">Max 25MB</p>
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

            {error && <div className="text-sm bg-red-500/10 text-red-400 p-3 rounded-xl">{error}</div>}

            <button type="submit" disabled={loading} className="w-full py-4 bg-brand hover:bg-brand-dark disabled:opacity-60 text-black font-semibold rounded-full text-lg transition-all">
              {loading ? 'Uploading to BVS...' : 'Upload & Submit for Review'}
            </button>

            <p className="text-center text-xs text-text-secondary">Your upload will be reviewed within 48 hours.</p>
          </form>
        </div>
      </div>
    </div>
  )
}
