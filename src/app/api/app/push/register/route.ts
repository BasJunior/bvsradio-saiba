import { NextResponse } from "next/server";
import { appServiceHeaders, appSupabaseService, appSupabaseUrl, requireAppUser } from "@/lib/app-api-auth";

export async function POST(request: Request) {
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!appSupabaseUrl || !appSupabaseService) return NextResponse.json({ error: "Push storage is unavailable." }, { status: 503 });
  const body = await request.json().catch(() => ({})) as { deviceToken?: string; platform?: string; appVariant?: string };
  const deviceToken = String(body.deviceToken || "").trim();
  const platform = body.platform === "ios" || body.platform === "android" ? body.platform : "";
  const appVariant = ["vnext", "beta", "production"].includes(String(body.appVariant)) ? String(body.appVariant) : "vnext";
  if (!platform || deviceToken.length < 12 || deviceToken.length > 4096) return NextResponse.json({ error: "Invalid device registration." }, { status: 400 });

  const response = await fetch(`${appSupabaseUrl}/rest/v1/app_push_devices?on_conflict=device_token`, {
    method: "POST",
    headers: appServiceHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({
      user_id: user.id,
      device_token: deviceToken,
      platform,
      app_variant: appVariant,
      enabled: true,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) return NextResponse.json({ error: "Could not register this device." }, { status: 503 });
  return new NextResponse(null, { status: 204 });
}
