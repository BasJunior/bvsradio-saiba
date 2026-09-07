import { NextResponse } from "next/server";
import { appServiceHeaders, appSupabaseService, appSupabaseUrl, requireAppUser } from "@/lib/app-api-auth";

const defaults = { releases: true, shows: true, creator_work: true, orders: true, community: false, marketing: false };
const allowed = Object.keys(defaults) as Array<keyof typeof defaults>;

export async function GET(request: Request) {
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!appSupabaseUrl || !appSupabaseService) return NextResponse.json({ preferences: defaults });
  const response = await fetch(`${appSupabaseUrl}/rest/v1/app_notification_preferences?user_id=eq.${encodeURIComponent(user.id)}&select=releases,shows,creator_work,orders,community,marketing&limit=1`, {
    headers: appServiceHeaders(), cache: "no-store",
  });
  if (!response.ok) return NextResponse.json({ preferences: defaults });
  const rows = await response.json() as Array<Record<string, boolean>>;
  return NextResponse.json({ preferences: { ...defaults, ...(rows[0] || {}) } });
}

export async function PATCH(request: Request) {
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!appSupabaseUrl || !appSupabaseService) return NextResponse.json({ error: "Notification preferences are unavailable." }, { status: 503 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const patch: Record<string, boolean> = {};
  for (const key of allowed) if (typeof body[key] === "boolean") patch[key] = body[key] as boolean;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "No valid preference changes." }, { status: 400 });
  const response = await fetch(`${appSupabaseUrl}/rest/v1/app_notification_preferences?on_conflict=user_id`, {
    method: "POST",
    headers: appServiceHeaders({ Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify({ user_id: user.id, ...patch, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) return NextResponse.json({ error: "Could not save notification preferences." }, { status: 503 });
  const rows = await response.json() as Array<Record<string, boolean>>;
  return NextResponse.json({ preferences: { ...defaults, ...(rows[0] || {}) } });
}
