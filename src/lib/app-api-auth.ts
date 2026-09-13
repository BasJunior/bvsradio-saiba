import "server-only";

export const appSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const appSupabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const appSupabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export type AppApiUser = {
  id: string;
  email?: string | null;
  emailConfirmedAt?: string | null;
  bannedUntil?: string | null;
};

export async function requireAppUser(request: Request): Promise<AppApiUser | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !appSupabaseUrl || !appSupabaseAnon) return null;
  const response = await fetch(`${appSupabaseUrl}/auth/v1/user`, {
    headers: { apikey: appSupabaseAnon, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const user = (await response.json()) as {
    id?: string;
    email?: string | null;
    email_confirmed_at?: string | null;
    confirmed_at?: string | null;
    banned_until?: string | null;
  };
  return user.id ? {
    id: user.id,
    email: user.email || null,
    emailConfirmedAt: user.email_confirmed_at || user.confirmed_at || null,
    bannedUntil: user.banned_until || null,
  } : null;
}

export function appServiceHeaders(extra?: Record<string, string>) {
  return {
    apikey: appSupabaseService,
    Authorization: `Bearer ${appSupabaseService}`,
    "Content-Type": "application/json",
    ...extra,
  };
}
