import 'server-only';
import { PREMIUM_CATALOG } from '@/lib/premium-catalog';
import { authUserId, serviceHeaders } from '@/lib/storage-upload';

export type AiMembership = { plan_id: string; status: string; starts_at: string | null; ends_at: string | null };

/** Paid listener (supporter) membership is the entry level; paid creator plans also qualify.
 * A release-only Premium Instant purchase or a shell record never unlocks access. */
export function hasPremiumAiMembership(rows: AiMembership[], now = Date.now()) {
  return rows.some(row => {
    const plan = PREMIUM_CATALOG.find(plan => plan.id === row.plan_id);
    const paid = row.plan_id === 'artist_annual' || Boolean(plan && ((plan.monthlyUsd || 0) > 0 || (plan.yearlyUsd || 0) > 0));
    return paid && ['active', 'trialing'].includes(row.status)
      && (!row.starts_at || Date.parse(row.starts_at) <= now)
      && (!row.ends_at || Date.parse(row.ends_at) > now);
  });
}

export function premiumAiConfigured() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

export async function premiumAiAccess(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { status: 401, userId: null, allowed: false };
  if (!url || !key) return { status: 503, userId: null, allowed: false };
  const user = await authUserId(url, key, token);
  if (!user?.id) return { status: 401, userId: null, allowed: false };
  const response = await fetch(`${url}/rest/v1/bvs_memberships?user_id=eq.${encodeURIComponent(user.id)}&status=in.(active,trialing)&select=plan_id,status,starts_at,ends_at`, {
    headers: serviceHeaders(key), cache: 'no-store', signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return { status: 503, userId: user.id, allowed: false };
  const allowed = hasPremiumAiMembership(await response.json() as AiMembership[]);
  return { status: allowed ? 200 : 403, userId: user.id, allowed };
}
