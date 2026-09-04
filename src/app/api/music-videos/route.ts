import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function authUser(token: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as { id: string };
}

async function isEditorial(userId: string) {
  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  };
  const [profileRes, staffRes] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role,email`,
      { headers, cache: "no-store" },
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/editorial_staff?user_id=eq.${userId}&active=eq.true&select=role&limit=1`,
      { headers, cache: "no-store" },
    ),
  ]);
  const profiles = profileRes.ok ? await profileRes.json() : [];
  const staff = staffRes.ok ? await staffRes.json() : [];
  const role = String(profiles?.[0]?.role || "");
  if (staff?.[0] || ["admin", "editor"].includes(role)) return true;
  const email = String(profiles?.[0]?.email || "").toLowerCase();
  if (email.includes("abias") || email.includes("chivayo")) return true;
  return false;
}

/** List own videos (artist) or all for editorial. */
export async function GET(req: Request) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const user = await authUser(token);
    if (!user?.id) return NextResponse.json({ error: "Session expired." }, { status: 401 });

    const editorial = await isEditorial(user.id);
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope") || "mine";

    const headers = {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    };

    let query =
      "music_videos?select=id,user_id,title,artist_name,genre,description,video_url,poster_url,editorial_status,editorial_notes,is_public,explicit_content,created_at,reviewed_at&order=created_at.desc&limit=100";
    if (!(editorial && scope === "all")) {
      query += `&user_id=eq.${user.id}`;
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, { headers, cache: "no-store" });
    if (!res.ok) {
      console.error("music_videos list failed", await res.text());
      return NextResponse.json({ error: "Could not load music videos." }, { status: 500 });
    }
    const videos = await res.json();
    return NextResponse.json({ videos, editorial });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not load music videos." }, { status: 500 });
  }
}

/** Editorial approve / reject / publish. */
export async function PATCH(req: Request) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const user = await authUser(token);
    if (!user?.id) return NextResponse.json({ error: "Session expired." }, { status: 401 });
    if (!(await isEditorial(user.id))) {
      return NextResponse.json({ error: "Editorial access required." }, { status: 403 });
    }

    const body = (await req.json()) as {
      id?: string;
      action?: "approve" | "reject" | "in_review";
      notes?: string;
    };
    const id = String(body.id || "").trim();
    const action = body.action;
    if (!id || !action) {
      return NextResponse.json({ error: "id and action are required." }, { status: 400 });
    }

    const patch: Record<string, unknown> = {
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (body.notes !== undefined) patch.editorial_notes = String(body.notes || "").slice(0, 2000);

    if (action === "approve") {
      patch.editorial_status = "approved";
      patch.is_public = true;
      patch.published_at = new Date().toISOString();
    } else if (action === "reject") {
      patch.editorial_status = "rejected";
      patch.is_public = false;
    } else if (action === "in_review") {
      patch.editorial_status = "in_review";
    } else {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    const res = await fetch(`${SUPABASE_URL}/rest/v1/music_videos?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      console.error("music_videos patch failed", await res.text());
      return NextResponse.json({ error: "Could not update music video." }, { status: 500 });
    }
    const rows = await res.json();
    return NextResponse.json({ video: Array.isArray(rows) ? rows[0] : rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not update music video." }, { status: 500 });
  }
}
