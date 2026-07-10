'use client'

import { useState } from 'react'
import Link from 'next/link'

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

    // First verify auth by checking login session
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
          <h1 className="text-2xl font-bold mb-4">Track Uploaded!</h1>
          <p className="text-text-secondary mb-6">
            Your track has been submitted and will appear in the catalogue after review.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setSuccess(false)}
              className="px-6 py-3 bg-brand text-black font-semibold rounded-full hover:bg-brand-dark transition-all"
            >
              Upload Another
            </button>
            <Link
              href="/catalogue"
              className="px-6 py-3 border border-white/20 rounded-full hover:bg-white/5 transition-all"
            >
              Browse Catalogue
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Upload New Track</h1>
        <p className="text-text-secondary">Share your music with the world</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">Audio File *</label>
          <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-brand/50 transition-colors cursor-pointer">
            <input
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg"
              onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
              className="hidden"
              id="audio-upload"
            />
            <label htmlFor="audio-upload" className="cursor-pointer">
              <svg className="w-10 h-10 text-text-secondary mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-text-secondary mb-1">
                {audioFile ? audioFile.name : 'Click to select MP3, WAV, or OGG'}
              </p>
              <p className="text-xs text-text-secondary/60">Max 20MB</p>
            </label>
          </div>
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-1">Track Title *</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 bg-bg-card border border-white/10 rounded-xl focus:outline-none focus:border-brand transition-colors"
            placeholder="My Amazing Track"
            required
          />
        </div>

        <div>
          <label htmlFor="genre" className="block text-sm font-medium mb-1">Genre *</label>
          <select
            id="genre"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="w-full px-4 py-3 bg-bg-card border border-white/10 rounded-xl focus:outline-none focus:border-brand transition-colors text-text-primary"
            required
          >
            <option value="" className="bg-bg-card">Select genre</option>
            {genres.map((g) => (
              <option key={g} value={g} className="bg-bg-card">{g}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-1">Description</label>
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 bg-bg-card border border-white/10 rounded-xl focus:outline-none focus:border-brand transition-colors resize-none"
            placeholder="Tell listeners about this track..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Cover Artwork</label>
          <div className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center hover:border-brand/50 transition-colors cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setArtworkFile(e.target.files?.[0] || null)}
              className="hidden"
              id="artwork-upload"
            />
            <label htmlFor="artwork-upload" className="cursor-pointer">
              <p className="text-sm text-text-secondary">
                {artworkFile ? artworkFile.name : 'Click to select artwork image (optional)'}
              </p>
            </label>
          </div>
        </div>

        {error && (
          <div className="bg-accent/10 border border-accent/30 rounded-xl px-4 py-3 text-sm text-accent">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-brand text-black font-semibold rounded-full hover:bg-brand-dark disabled:opacity-50 transition-all text-lg"
        >
          {loading ? 'Uploading...' : 'Upload Track'}
        </button>
      </form>
    </div>
  )
}