import 'server-only'
import { premiumAiAccess } from '@/lib/premium-ai'

export type StudioMixerLevel = 'read' | 'edit'

/** The rollout flag is server-only. A lapsed member may read their own future tracks. */
export async function studioMixerAccess(request: Request, level: StudioMixerLevel = 'edit') {
  const rollout = process.env.BVS_STUDIO_MIXER || 'off'
  if (!['testers', 'premium'].includes(rollout)) {
    return { status: 404, userId: null, allowed: false, reason: 'hidden' as const }
  }

  const membership = await premiumAiAccess(request).catch(() => ({ status: 503, userId: null, allowed: false }))
  if (membership.status === 401) {
    return { status: 401, userId: null, allowed: false, reason: 'sign_in' as const }
  }
  if (!membership.userId || membership.status === 503) {
    return { status: 503, userId: membership.userId, allowed: false, reason: 'unavailable' as const }
  }
  if (rollout === 'testers') {
    const testers = (process.env.BVS_STUDIO_MIXER_TESTERS || '').split(',').map(id => id.trim())
    if (!testers.includes(membership.userId)) {
      return { status: 404, userId: membership.userId, allowed: false, reason: 'hidden' as const }
    }
  }
  if (membership.allowed || level === 'read') {
    return { status: 200, userId: membership.userId, allowed: true, reason: membership.allowed ? 'premium' as const : 'read_only' as const }
  }
  return { status: 403, userId: membership.userId, allowed: false, reason: 'upgrade' as const }
}

export function studioMixerPresentation(access: Awaited<ReturnType<typeof studioMixerAccess>>): 'available' | 'upgrade' | 'hidden' {
  if (access.reason === 'premium' && access.allowed) return 'available'
  return access.reason === 'upgrade' ? 'upgrade' : 'hidden'
}
