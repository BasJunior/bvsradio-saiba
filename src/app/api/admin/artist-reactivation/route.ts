import { NextResponse } from "next/server";
import { creatorHeaders, creatorIdentity, creatorUrl } from "@/lib/creator-server";
import { supabaseAdmin } from "@/lib/auth-email";
import { sendBvsEmail } from "@/lib/mailer";
import { buildFirstUploadReactivationEmail } from "@/lib/artist-reactivation-email";

type ArtistProfile = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  created_at?: string | null;
};

type AuthUser = {
  id: string;
  email?: string | null;
};

const SEND_CONFIRMATION = "SEND_FIRST_UPLOAD_REACTIVATION";
const DEFAULT_DAYS = 14;
const MAX_DAYS = 90;
const MAX_SEND = 15;

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

async function requireAdmin(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity) {
    return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  }
  if (!identity.profile || identity.profile.role !== "admin") {
    return { error: NextResponse.json({ error: "Editorial staff access required." }, { status: 403 }) };
  }
  return { identity };
}

async function artistProfiles(): Promise<ArtistProfile[]> {
  const withCreated = await fetch(
    creatorUrl(
      "profiles?role=eq.artist&select=id,username,display_name,created_at&order=created_at.desc&limit=500",
    ),
    { headers: creatorHeaders, cache: "no-store" },
  );
  if (withCreated.ok) return (await withCreated.json()) as ArtistProfile[];

  // Keep the tool usable against older schemas that do not expose created_at.
  const fallback = await fetch(
    creatorUrl("profiles?role=eq.artist&select=id,username,display_name&limit=500"),
    { headers: creatorHeaders, cache: "no-store" },
  );
  if (!fallback.ok) throw new Error("Could not load artist profiles.");
  return (await fallback.json()) as ArtistProfile[];
}

async function artistIdsWithTracks(): Promise<Set<string>> {
  const response = await fetch(creatorUrl("tracks?select=user_id&limit=10000"), {
    headers: creatorHeaders,
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Could not load artist track activity.");
  const rows = (await response.json()) as Array<{ user_id?: string | null }>;
  return new Set(rows.map((row) => row.user_id).filter(Boolean) as string[]);
}

async function zeroTrackCohort(days: number) {
  const [profiles, withTracks] = await Promise.all([artistProfiles(), artistIdsWithTracks()]);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  return profiles
    .filter((profile) => !withTracks.has(profile.id))
    .filter((profile) => {
      if (!profile.created_at) return true;
      const joined = new Date(profile.created_at).getTime();
      return Number.isFinite(joined) ? joined >= cutoff : true;
    })
    .sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });
}

function publicCandidate(profile: ArtistProfile) {
  return {
    id: profile.id,
    username: profile.username || null,
    displayName: profile.display_name || null,
    joinedAt: profile.created_at || null,
  };
}

async function authUsersById() {
  const { res, data } = await supabaseAdmin("/auth/v1/admin/users?page=1&per_page=1000");
  if (!res.ok) throw new Error(String(data?.message || data?.msg || "Could not load account emails."));
  const users = Array.isArray(data?.users) ? (data.users as AuthUser[]) : [];
  return new Map(users.map((user) => [user.id, user]));
}

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if ("error" in access) return access.error;

  try {
    const url = new URL(request.url);
    const days = clampInt(url.searchParams.get("days"), DEFAULT_DAYS, 1, MAX_DAYS);
    const cohort = await zeroTrackCohort(days);
    return NextResponse.json({
      ok: true,
      mode: "dry_run",
      days,
      eligibleCount: cohort.length,
      maxSendPerRequest: MAX_SEND,
      candidates: cohort.map(publicCandidate),
      note: "No emails are exposed and GET never sends messages.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not build reactivation cohort." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const access = await requireAdmin(request);
  if ("error" in access) return access.error;

  const body = (await request.json().catch(() => ({}))) as {
    send?: boolean;
    confirm?: string;
    days?: number;
    limit?: number;
    userIds?: string[];
  };

  const days = clampInt(body.days, DEFAULT_DAYS, 1, MAX_DAYS);
  const limit = clampInt(body.limit, 10, 1, MAX_SEND);

  try {
    const cohort = await zeroTrackCohort(days);
    const requestedIds = new Set(
      Array.isArray(body.userIds)
        ? body.userIds.map((value) => String(value || "").trim()).filter(Boolean)
        : [],
    );
    const selected = (requestedIds.size
      ? cohort.filter((profile) => requestedIds.has(profile.id))
      : cohort
    ).slice(0, limit);

    if (body.send !== true) {
      return NextResponse.json({
        ok: true,
        mode: "dry_run",
        days,
        selectedCount: selected.length,
        candidates: selected.map(publicCandidate),
        sendRequires: {
          send: true,
          confirm: SEND_CONFIRMATION,
          maxPerRequest: MAX_SEND,
        },
      });
    }

    if (body.confirm !== SEND_CONFIRMATION) {
      return NextResponse.json(
        {
          error: "Explicit send confirmation is required.",
          requiredConfirmation: SEND_CONFIRMATION,
        },
        { status: 400 },
      );
    }

    if (!selected.length) {
      return NextResponse.json({ ok: true, mode: "send", sent: 0, failed: 0, results: [] });
    }

    const users = await authUsersById();
    const results: Array<{ id: string; username: string | null; status: "sent" | "skipped" | "failed"; reason?: string }> = [];

    // Deliberately sequential and capped: D11 is a small manual cohort experiment,
    // not a bulk marketing system or recurring cron.
    for (const profile of selected) {
      const user = users.get(profile.id);
      const email = String(user?.email || "").trim();
      if (!email) {
        results.push({ id: profile.id, username: profile.username || null, status: "skipped", reason: "No account email" });
        continue;
      }

      try {
        const message = buildFirstUploadReactivationEmail({
          displayName: profile.display_name || profile.username || null,
        });
        await sendBvsEmail({
          to: email,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
        results.push({ id: profile.id, username: profile.username || null, status: "sent" });
      } catch (error) {
        results.push({
          id: profile.id,
          username: profile.username || null,
          status: "failed",
          reason: error instanceof Error ? error.message.slice(0, 180) : "Send failed",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      mode: "send",
      days,
      selectedCount: selected.length,
      sent: results.filter((item) => item.status === "sent").length,
      failed: results.filter((item) => item.status === "failed").length,
      skipped: results.filter((item) => item.status === "skipped").length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Artist reactivation request failed." },
      { status: 500 },
    );
  }
}
