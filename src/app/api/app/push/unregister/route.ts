import { NextResponse } from "next/server";
import { appServiceHeaders, appSupabaseService, appSupabaseUrl, requireAppUser } from "@/lib/app-api-auth";

export async function POST(request: Request) {
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!appSupabaseUrl || !appSupabaseService) return NextResponse.json({ error: "Push storage is unavailable." }, { status: 503 });
  const body = await request.json().catch(() => ({})) as { deviceToken?: string };
  const deviceToken = String(body.deviceToken || "").trim();
  if (!deviceToken) return NextResponse.json({ error: "Device token required." }, { status: 400 });
  const response = await fetch(`${appSupabaseUrl}/rest/v1/app_push_devices?user_id=eq.${encodeURIComponent(user.id)}&device_token=eq.${encodeURIComponent(deviceToken)}`, {
    method: "PATCH",
    headers: appServiceHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify({ enabled: false, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) return NextResponse.json({ error: "Could not unregister this device." }, { status: 503 });
  return new NextResponse(null, { status: 204 });
}
