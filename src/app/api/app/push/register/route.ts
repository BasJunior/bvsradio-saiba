import { apnsConfigured } from "@/lib/apns-server";
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
  if (!platform || deviceToken.length < 12 || deviceToken.length > 300 || (platform === "ios" && !/^[0-9a-f]{32,}$/i.test(deviceToken))) return NextResponse.json({ error: "Invalid device registration." }, { status: 400 });

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

// Only account-scoped counts and provider readiness; never return device tokens or credentials.
export async function GET(request: Request) {
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!appSupabaseUrl || !appSupabaseService) return NextResponse.json({ error: "Push storage is unavailable." }, { status: 503 });
  const response = await fetch(`${appSupabaseUrl}/rest/v1/app_push_devices?user_id=eq.${encodeURIComponent(user.id)}&enabled=eq.true&select=platform&limit=100`, { headers: appServiceHeaders(), cache: "no-store" });
  if (!response.ok) return NextResponse.json({ error: "Device registration is unavailable." }, { status: 503 });
  const devices = await response.json() as Array<{ platform: string }>;
  return NextResponse.json({ registeredDevices: devices.length, iosDeliveryReady: apnsConfigured() || Boolean(process.env.BVS_PUSH_DELIVERY_ENDPOINT && process.env.BVS_PUSH_DELIVERY_SECRET) }, { headers: { "Cache-Control": "private, no-store" } });
}
