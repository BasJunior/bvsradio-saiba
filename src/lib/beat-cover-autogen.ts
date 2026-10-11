/**
 * BVS BeatStore fallback cover art.
 * Deterministic editorial SVG from title + producer — square, dark and BVS branded.
 * Marked via path suffix `-artwork-generated.svg` (no schema migration required).
 */
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { r2Bucket, r2Client, r2Configured } from '@/lib/r2-storage'

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

function wrapTitle(title: string, maxChars = 11) {
  const lines: string[] = []
  let line = ''
  for (const word of title.trim().split(/\s+/).filter(Boolean)) {
    if (line && `${line} ${word}`.length > maxChars) {
      lines.push(line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['UNTITLED BEAT']
}

export type BeatCoverDirection = 'monolith' | 'echo' | 'interlace' | 'bloom'
const directions: BeatCoverDirection[] = ['monolith', 'echo', 'interlace', 'bloom']

function coverComposition(direction: BeatCoverDirection) {
  if (direction === 'monolith') {
    const steps = Array.from({ length: 22 }, (_, i) => {
      const y = 720 - i * 13
      const half = 210 - i * 7
      return `<path d="M${500 - half} ${y}L500 ${y - 62}L${500 + half} ${y}" fill="none" stroke="url(#metal)" stroke-width="5"/>`
    }).join('')
    return `<ellipse cx="500" cy="736" rx="280" ry="36" fill="url(#halo)"/><path d="M463 692V405L500 370L537 405V692L500 717Z" fill="url(#metal)"/><path d="M500 370V717" stroke="#ece0ff" stroke-width="2"/>${steps}<path d="M500 348V328M255 734H225M745 734H775" stroke="#ccff3d" stroke-width="3"/>`
  }
  if (direction === 'echo') {
    const rings = Array.from({ length: 18 }, (_, i) => `<ellipse cx="500" cy="550" rx="${248 - i * 12}" ry="${180 - i * 8}" fill="none" stroke="${i % 4 === 0 ? '#ead8ff' : '#a980ec'}" stroke-opacity="${.3 + i / 28}" stroke-width="${i % 4 === 0 ? 3 : 1.5}" transform="rotate(${i * 4 - 28} 500 550)"/>`).join('')
    return `<circle cx="500" cy="550" r="230" fill="url(#halo)"/>${rings}<path d="M265 708L738 385" stroke="#ccff3d" stroke-width="2"/><circle cx="500" cy="550" r="24" fill="#09090d" stroke="#e7d8ff" stroke-width="2"/><circle cx="500" cy="550" r="4" fill="#ccff3d"/>`
  }
  if (direction === 'interlace') {
    const ribbons = Array.from({ length: 17 }, (_, i) => `<path d="M${250 + i * 8} 380C${820 - i * 5} 440 ${180 + i * 5} 650 ${750 - i * 8} 728" fill="none" stroke="url(#metal)" stroke-width="3"/><path d="M${750 - i * 8} 380C${180 + i * 5} 440 ${820 - i * 5} 650 ${250 + i * 8} 728" fill="none" stroke="url(#metal)" stroke-width="3"/>`).join('')
    return `<ellipse cx="500" cy="558" rx="240" ry="185" fill="url(#halo)"/>${ribbons}<path d="M500 370V732" stroke="#ccff3d" stroke-opacity=".7" stroke-width="1"/><rect x="492" y="545" width="16" height="16" fill="#ccff3d" transform="rotate(45 500 553)"/>`
  }
  const petals = Array.from({ length: 24 }, (_, i) => `<ellipse cx="500" cy="548" rx="${212 - i * 4}" ry="${90 + i * 2}" fill="none" stroke="${i % 6 === 0 ? '#e8d8ff' : '#b186f1'}" stroke-opacity="${.35 + i / 40}" stroke-width="2" transform="rotate(${i * 15} 500 548)"/>`).join('')
  return `<circle cx="500" cy="548" r="222" fill="url(#halo)"/>${petals}<circle cx="500" cy="548" r="32" fill="#ccff3d"/><circle cx="500" cy="548" r="18" fill="#0b0b0f"/><path d="M500 313V335M500 761V783M267 548H289M711 548H733" stroke="#ccff3d" stroke-width="2"/>`
}

/** Square editorial sleeve. Titles and producer identity remain complete. */
export function buildBeatCoverSvg(input: {
  title: string
  producerName: string
  accentHue?: number
  direction?: BeatCoverDirection
  genre?: string
  bpm?: number | null
}) {
  const title = String(input.title || 'Untitled beat').trim() || 'Untitled beat'
  const producer = String(input.producerName || 'BVS producer').trim() || 'BVS producer'
  const seed = hashHue(`${title}|${producer}`)
  const direction = input.direction || directions[seed % directions.length]
  const lines = wrapTitle(title.toUpperCase())
  const titleSize = Math.min(114, 252 / lines.length, 884 / (Math.max(...lines.map(line => line.length)) * .8))
  const titleBlock = lines.map((line, i) => {
    return `<text x="58" y="${220 + i * titleSize * 1.06}" font-size="${titleSize}" font-weight="900" letter-spacing="-3">${escapeXml(line)}</text>`
  }).join('')
  const metadata = [input.genre, input.bpm ? `${input.bpm} BPM` : ''].filter(Boolean).join(' / ').toUpperCase()
  const compositionY = lines.length > 2 ? 220 : lines.length === 2 ? 85 : 0
  const compositionScale = lines.length > 2 ? .72 : lines.length === 2 ? .85 : 1
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000" role="img" aria-label="${escapeXml(title)} — ${escapeXml(producer)} cover">
<defs>
  <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#6d4f99"/><stop offset=".28" stop-color="#f0e6ff"/><stop offset=".48" stop-color="#a875e7"/><stop offset=".7" stop-color="#ded0f5"/><stop offset="1" stop-color="#523271"/></linearGradient>
  <radialGradient id="halo"><stop stop-color="#8d51cf" stop-opacity=".22"/><stop offset="1" stop-color="#8d51cf" stop-opacity="0"/></radialGradient>
  <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#dac2ff" stroke-opacity=".045" stroke-width="1"/></pattern>
</defs>
<rect width="1000" height="1000" fill="#0b0b0f"/>
<rect x="28" y="28" width="944" height="944" fill="none" stroke="#a47adb" stroke-opacity=".36"/>
<rect x="58" y="324" width="884" height="465" fill="url(#grid)"/>
<g font-family="Arial, Helvetica, sans-serif" fill="#f3f1f6">
  <text x="58" y="70" font-size="25" font-weight="900" letter-spacing="-1">BVS<tspan fill="#ccff3d">.</tspan></text>
  <text x="942" y="68" text-anchor="end" fill="#c8a4fa" font-size="18" font-weight="700" letter-spacing="5">BEATSTORE</text>
  <path d="M58 94H942" stroke="#c8a4fa" stroke-opacity=".45"/>
  ${titleBlock}
  <g transform="translate(${500 * (1 - compositionScale)} ${compositionY}) scale(${compositionScale})">${coverComposition(direction)}</g>
  <path d="M58 821H942" stroke="#c8a4fa" stroke-opacity=".45"/>
  <text x="58" y="862" fill="#c8a4fa" font-size="16" letter-spacing="4">PRODUCED BY</text>
  <text x="58" y="912" font-size="${Math.min(42, 860 / Math.max(1, producer.length) / .65)}" font-weight="700" letter-spacing="-1">${escapeXml(producer)}</text>
  <text x="58" y="950" fill="#9f99a9" font-size="16" letter-spacing="2">${escapeXml(metadata || 'BVS RADIO')}</text>
  <path d="M897 926H942V950H897Z" fill="#c8a4fa"/><path d="M904 938H935" stroke="#0b0b0f" stroke-width="3"/>
</g>
</svg>`
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
      Key: key,
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
