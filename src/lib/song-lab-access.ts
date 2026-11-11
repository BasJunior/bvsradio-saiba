import "server-only";
import { authUserId, serviceHeaders } from "@/lib/storage-upload";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

type Membership = {
  family?: string;
  plan_id?: string;
  status?: string;
  ends_at?: string | null;
  entitlements?: Record<string, unknown> | null;
};
type Profile = { premium_active?: boolean; premium_until?: string | null };

export function songLabDevPreviewEnabled(): boolean {
  // A developer can prototype locally without activating paid billing.
  // This flag has no effect on preview/production deployments.
  return process.env.NODE_ENV === "development" && process.env.BVS_SONG_LAB_DEV_ACCESS === "true";
}

function notExpired(endsAt?: string | null): boolean {
  if (!endsAt) return true;
  const expires = Date.parse(endsAt);
  return Number.isFinite(expires) && expires > Date.now();
}

export async function songLabUser(request: Request) {
  if (!url || !key) return null;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return token ? authUserId(url, key, token) : null;
}

export async function songLabAccess(userId: string): Promise<boolean> {
  if (songLabDevPreviewEnabled()) return true;
  if (!url || !key) return false;
  try {
    const headers = serviceHeaders(key);
    const [profileResponse, membershipResponse] = await Promise.all([
      fetch(url + "/rest/v1/profiles?id=eq." + encodeURIComponent(userId) +
        "&select=premium_active,premium_until&limit=1", { headers, cache: "no-store" }),
      fetch(url + "/rest/v1/bvs_memberships?user_id=eq." + encodeURIComponent(userId) +
        "&status=in.(active,trialing)&select=family,plan_id,status,ends_at,entitlements&limit=30",
        { headers, cache: "no-store" }),
    ]);
    if (!profileResponse.ok || !membershipResponse.ok) return false;
    const profiles = (await profileResponse.json()) as Profile[];
    const memberships = (await membershipResponse.json()) as Membership[];
    const profile = profiles[0];
    if (profile?.premium_active === true && notExpired(profile.premium_until)) return true;
    return memberships.some((membership) => {
      if (!notExpired(membership.ends_at)) return false;
      if (membership.entitlements?.song_lab_enabled === true) return true;
      const family = String(membership.family || "").toLowerCase();
      const plan = String(membership.plan_id || "").toLowerCase();
      return family === "artist" || family === "creator_bundle" ||
        plan.startsWith("artist_") || plan.includes("creator_complete");
    });
  } catch {
    // Never grant Premium access when entitlement verification fails.
    return false;
  }
}
