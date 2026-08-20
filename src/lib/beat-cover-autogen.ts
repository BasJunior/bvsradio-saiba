/**
 * BVS BeatStore fallback cover art.
 * Deterministic SVG from title + producer — free, on-brand, no AI spend.
 * Marked via path suffix `-artwork-generated.svg` (no schema migration required).
 */
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { r2Bucket, r2Client, r2Configured, r2StorageKey } from '@/lib/r2-storage'

export function isGeneratedBeatArtworkPath(path?: string | null) {
  const p = String(path || '')
  return p.includes('artwork-generated') || p.includes('/generated-cover')
}

function hashHue(input: string) {
  let h = 0
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0
  }
  return h % 360
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function wrapTitle(title: string, maxChars = 16, maxLines = 3) {
  const words = title.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ['Untitled']
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length <= maxChars) {
      line = next
      continue
    }
    if (line) lines.push(line)
    line = word.length > maxChars ? `${word.slice(0, maxChars - 1)}…` : word
    if (lines.length >= maxLines - 1) break
  }
  if (line && lines.length < maxLines) lines.push(line)
  return lines.slice(0, maxLines)
}

/** Build square SVG cover (viewBox 1000×1000). */
export function buildBeatCoverSvg(input: {
  title: string
  producerName: string
  accentHue?: number
}) {
  const title = String(input.title || 'Untitled beat').trim() || 'Untitled beat'
  const producer =
    String(input.producerName || 'BVS producer').trim() || 'BVS producer'
  const hue =
    typeof input.accentHue === 'number'
      ? input.accentHue
      : hashHue(`${title}|${producer}`)
  const c1 = `hsl(${hue} 72% 42%)`
  const c2 = `hsl(${(hue + 48) % 360} 68% 28%)`
  const c3 = `hsl(${(hue + 200) % 360} 40% 12%)`
  const lines = wrapTitle(title.toUpperCase(), 15, 3)
  const titleFs = lines.length >= 3 ? 72 : lines.length === 2 ? 84 : 96
  const titleBlock = lines
    .map((line, i) => {
      const y = 430 + i * (titleFs + 12)
      return `<text x="80" y="${y}" fill="#F7F4EF" font-family="Georgia, 'Times New Roman', serif" font-size="${titleFs}" font-weight="700" letter-spacing="1">${escapeXml(line)}</text>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000" role="img" aria-label="${escapeXml(title)} cover">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="55%" stop-color="${c2}"/>
      <stop offset="100%" stop-color="${c3}"/>
    </linearGradient>
    <radialGradient id="glow" cx="70%" cy="20%" r="55%">
      <stop offset="0%" stop-color="#FFE08A" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#FFE08A" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1000" height="1000" fill="url(#bg)"/>
  <rect width="1000" height="1000" fill="url(#glow)"/>
  <rect x="36" y="36" width="928" height="928" rx="28" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="3"/>
  <text x="80" y="120" fill="#F5C518" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="28" font-weight="700" letter-spacing="6">BVS RADIO</text>
  <text x="80" y="168" fill="rgba(255,255,255,0.72)" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="26" font-weight="600" letter-spacing="4">BEATSTORE</text>
  ${titleBlock}
  <text x="80" y="820" fill="rgba(255,255,255,0.88)" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="34" font-weight="600">${escapeXml(producer.slice(0, 42))}</text>
  <text x="80" y="880" fill="rgba(255,255,255,0.55)" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="22">Placeholder cover · replace with your art</text>
  <circle cx="860" cy="860" r="54" fill="rgba(0,0,0,0.28)" stroke="#F5C518" stroke-width="3"/>
  <text x="860" y="870" text-anchor="middle" fill="#F5C518" font-family="system-ui, sans-serif" font-size="28" font-weight="800">BVS</text>
</svg>
`
}

export async function uploadGeneratedBeatCover(input: {
  producerUserId: string
  title: string
  producerName: string
}): Promise<string | null> {
  if (!r2Configured()) return null
  const producerUserId = String(input.producerUserId || '').trim()
  if (!producerUserId) return null
  const svg = buildBeatCoverSvg({
    title: input.title,
    producerName: input.producerName,
  })
  const key = `beats/${producerUserId}/${Date.now()}-artwork-generated.svg`
  await r2Client().send(
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: r2StorageKey(key),
      Body: Buffer.from(svg, 'utf8'),
      ContentType: 'image/svg+xml',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )
  return key
}

/** If path empty, generate + upload cover. Returns existing path or new key. */
export async function ensureBeatArtworkPath(input: {
  producerUserId: string
  title: string
  producerName: string
  artworkPath?: string | null
}): Promise<{ path: string | null; generated: boolean }> {
  const existing = String(input.artworkPath || '').trim()
  if (existing) return { path: existing, generated: false }
  const path = await uploadGeneratedBeatCover({
    producerUserId: input.producerUserId,
    title: input.title,
    producerName: input.producerName,
  })
  return { path, generated: Boolean(path) }
}
