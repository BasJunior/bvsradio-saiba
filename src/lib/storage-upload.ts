/** Shared Supabase Auth/REST helpers (server). Media uploads use private R2. */

export async function authUserId(
  supabaseUrl: string,
  serviceKey: string,
  bearer: string,
): Promise<{ id: string; email?: string } | null> {
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${bearer}`,
    },
  });
  if (!userRes.ok) return null;
  return (await userRes.json()) as { id: string; email?: string };
}

export const serviceHeaders = (serviceKey: string) => ({
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
});
