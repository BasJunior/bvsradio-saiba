import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto'

export const QR_LOGIN_TTL_MS = 5 * 60 * 1000

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export function qrLoginConfigured() {
  return Boolean(url && serviceKey)
}

export function token() {
  return randomBytes(32).toString('base64url')
}

export function tokenHash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function safeHashMatch(value: string, expectedHash: string) {
  const actual = Buffer.from(tokenHash(value), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function pairingId() {
  return randomUUID()
}

export function serviceHeaders(extra?: HeadersInit): HeadersInit {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

export function restUrl(path: string) {
  return `${url}${path}`
}

export async function authenticatedUser(accessToken: string) {
  if (!accessToken) return null
  const response = await fetch(restUrl('/auth/v1/user'), {
    headers: { apikey: serviceKey, Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!response.ok) return null
  const user = await response.json()
  return typeof user?.id === 'string' && typeof user?.email === 'string' ? user : null
}

