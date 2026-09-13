import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/app-api-auth";
import {
  participationEnabled,
  participationInsert,
  participationReady,
  participationRows,
} from "@/lib/participation-server";

const defaults = {
  inbox_enabled: true,
  external_community_enabled: false,
  digest_enabled: false,
  digest_time: "18:00",
  timezone: "UTC",
  quiet_start: null as string | null,
  quiet_end: null as string | null,
  settings_version: "participation-v1",
};

type PreferenceRow = typeof defaults & { user_id: string; updated_at?: string };

function validTime(value: unknown) {
  const text = String(value || "").trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : null;
}

function validTimezone(value: unknown) {
  const zone = String(value || "").trim().slice(0, 80);
  if (!zone) return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format(new Date());
    return zone;
  } catch {
    return null;
  }
}

async function load(userId: string) {
  const rows = await participationRows<PreferenceRow>(
    `participation_preferences?user_id=eq.${encodeURIComponent(userId)}&select=user_id,inbox_enabled,external_community_enabled,digest_enabled,digest_time,timezone,quiet_start,quiet_end,settings_version,updated_at&limit=1`,
  );
  return { ...defaults, ...(rows[0] || {}) };
}

export async function GET(request: Request) {
  if (!participationEnabled()) return NextResponse.json({ enabled: false, preferences: defaults });
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!participationReady()) return NextResponse.json({ error: "Participation preferences are unavailable." }, { status: 503 });
  return NextResponse.json({ enabled: true, preferences: await load(user.id) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  if (!participationEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!participationReady()) return NextResponse.json({ error: "Participation preferences are unavailable." }, { status: 503 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const current = await load(user.id);
  const next = { ...current };

  for (const key of ["inbox_enabled", "external_community_enabled", "digest_enabled"] as const) {
    if (typeof body[key] === "boolean") next[key] = body[key] as boolean;
  }
  if (body.digest_time !== undefined) {
    const value = validTime(body.digest_time);
    if (!value) return NextResponse.json({ error: "Choose a valid pulse time." }, { status: 400 });
    next.digest_time = value;
  }
  if (body.timezone !== undefined) {
    const value = validTimezone(body.timezone);
    if (!value) return NextResponse.json({ error: "Choose a valid timezone." }, { status: 400 });
    next.timezone = value;
  }
  for (const key of ["quiet_start", "quiet_end"] as const) {
    if (body[key] === null || body[key] === "") next[key] = null;
    else if (body[key] !== undefined) {
      const value = validTime(body[key]);
      if (!value) return NextResponse.json({ error: "Choose a valid quiet-hours time." }, { status: 400 });
      next[key] = value;
    }
  }

  const rows = await participationInsert<PreferenceRow>(
    "participation_preferences?on_conflict=user_id",
    {
      user_id: user.id,
      inbox_enabled: next.inbox_enabled,
      external_community_enabled: next.external_community_enabled,
      digest_enabled: next.digest_enabled,
      digest_time: next.digest_time,
      timezone: next.timezone,
      quiet_start: next.quiet_start,
      quiet_end: next.quiet_end,
      settings_version: "participation-v1",
      updated_at: new Date().toISOString(),
    },
    "resolution=merge-duplicates,return=representation",
  );
  if (!rows[0]) return NextResponse.json({ error: "Could not save participation preferences." }, { status: 503 });
  return NextResponse.json({ enabled: true, preferences: { ...defaults, ...rows[0] } });
}
