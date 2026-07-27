import { NextResponse } from 'next/server'

/**
 * Legacy multipart endpoint. Large episode files must use the direct-to-R2
 * prepare flow so neither Vercel nor Supabase Storage carries the media body.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Use the secure direct-upload flow in Creator Studio.' },
    { status: 410 },
  )
}
