const SECRET_KEY = /(stream[_-]?key|service[_-]?role|authorization|password|recovery[_-]?token|access[_-]?token|refresh[_-]?token|secret)/i

function sanitizeString(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [REDACTED]')
    .replace(/sk_(?:live|test)_[A-Za-z0-9_-]+/gi, 'sk_[REDACTED]')
    .replace(/([?&]sk=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/(service[_-]?role\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/(stream[_-]?key\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
}

export function sanitizeCopilotValue<T>(value: T, depth = 0): T {
  if (depth > 8) return '[TRUNCATED]' as T
  if (typeof value === 'string') return sanitizeString(value) as T
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeCopilotValue(item, depth + 1)) as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEY.test(key) ? '[REDACTED]' : sanitizeCopilotValue(item, depth + 1)
    }
    return out as T
  }
  return value
}

export function sanitizeCopilotText(value: unknown, max = 2000): string {
  return sanitizeString(String(value ?? '')).slice(0, max)
}

export function safeClientContext(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object') return {}
  const raw = input as Record<string, unknown>
  const out: Record<string, string> = {}
  if (typeof raw.path === 'string') out.path = sanitizeCopilotText(raw.path, 240)
  if (typeof raw.timezone === 'string') out.timezone = sanitizeCopilotText(raw.timezone, 80)
  return out
}
