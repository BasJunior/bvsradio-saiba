import { NextResponse } from 'next/server'
import { getPublishedProducers } from '@/lib/artist-content'

export async function GET() {
  return NextResponse.json({ producers: await getPublishedProducers() })
}
