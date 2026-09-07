import type { Metadata } from 'next'
import LyricsPadHub from '@/components/lyrics/LyricsPadHub'

export const metadata: Metadata = {
  title: 'Lyrics Pad',
  description: 'Write lyrics privately, return to song ideas, and write with beats already licensed to your BVS account.',
}

export default function LyricsPage() {
  return <LyricsPadHub />
}
