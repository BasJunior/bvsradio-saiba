export const BVS_LIVE_PUBLIC_ID = /^evt_[a-z0-9]{8,16}$/
export const BVS_LIVE_SECRET = /^[a-f0-9]{32,128}$/

export type SrsHookAction = 'on_publish' | 'on_unpublish'

export type SrsHookPayload = {
  action: string
  clientId: string
  ip: string
  vhost: string
  app: string
  stream: string
  param: string
  tcUrl: string
  serverId: string
}

function scalar(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return ''
}

export function normaliseSrsPayload(input: Record<string, unknown>): SrsHookPayload {
  return {
    action: scalar(input.action),
    clientId: scalar(input.client_id),
    ip: scalar(input.ip),
    vhost: scalar(input.vhost),
    app: scalar(input.app),
    stream: scalar(input.stream),
    param: scalar(input.param),
    tcUrl: scalar(input.tcUrl),
    serverId: scalar(input.server_id),
  }
}

export async function parseSrsHookBody(request: Request): Promise<SrsHookPayload | null> {
  const contentType = (request.headers.get('content-type') || '').toLowerCase()
  const raw = await request.text()
  if (!raw) return null

  try {
    if (contentType.includes('application/json')) {
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
      return normaliseSrsPayload(parsed as Record<string, unknown>)
    }

    // Stock/relayed SRS integrations may use form-encoded callbacks. Supporting
    // both shapes keeps the BVS control-plane contract independent of the exact
    // media-origin build while never placing the credential in the callback URL.
    const params = new URLSearchParams(raw)
    return normaliseSrsPayload(Object.fromEntries(params.entries()))
  } catch {
    return null
  }
}

export function validPublicId(value: string): boolean {
  return BVS_LIVE_PUBLIC_ID.test(value) && !value.includes('.')
}

export function extractStreamSecret(param: string): string | null {
  try {
    const query = param.startsWith('?') ? param.slice(1) : param
    const values = new URLSearchParams(query).getAll('sk')
    if (values.length !== 1) return null
    const secret = values[0].trim().toLowerCase()
    return BVS_LIVE_SECRET.test(secret) ? secret : null
  } catch {
    return null
  }
}
