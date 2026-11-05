import { NextResponse } from "next/server";
import { creatorHeaders, creatorIdentity, creatorJson, creatorUrl } from "@/lib/creator-server";
import { r2Configured, r2ObjectExists } from "@/lib/r2-storage";
import { canSubmitWriterArticle, cleanWriterText, editableArticleStatuses, safeWriterPortfolio, validWriterCoverPath } from "@/lib/writer-workflow";

export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
const resource = (path: string, init?: RequestInit) => fetch(creatorUrl(path), { headers: creatorHeaders, cache: "no-store", ...init });

type Application = { id: string; status: string; bio?: string; beats?: string[]; portfolio_url?: string | null };
type Article = { id: string; status: string; author_id: string; cover_art_path?: string | null };

async function writerAccess(userId: string, isStaff: boolean) {
  const response = await resource(`writer_applications?user_id=eq.${userId}&select=*&limit=1`);
  if (!response.ok) throw new Error("Writer tables are unavailable. Apply the creator workflow SQL and latest migrations.");
  const applications = await response.json() as Application[];
  const application = applications[0] || null;
  return { application, approved: canSubmitWriterArticle(application?.status, isStaff) };
}

export async function GET(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity?.user?.id) return json({ error: "Sign in to access the Writer Studio." }, 401);
  try {
    const { application, approved } = await writerAccess(identity.user.id, identity.profile?.role === "admin");
    const response = await resource(`editorial_articles?author_id=eq.${identity.user.id}&select=id,title,slug,dek,body,sources,status,cover_art_path,editor_notes,published_at,created_at,updated_at&order=updated_at.desc&limit=100`);
    if (!response.ok) throw new Error("Article tables are unavailable. Apply the writer migration.");
    const articles = await response.json();
    return json({ application, approved, articles, profile: {
      username: identity.profile?.username || null,
      displayName: identity.profile?.display_name || identity.profile?.username || "Writer",
    } });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Writer Studio unavailable." }, 503);
  }
}

export async function POST(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity?.user?.id) return json({ error: "Sign in to continue." }, 401);
  const userId = identity.user.id;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid request." }, 400);
  const action = cleanWriterText(body.action, 40);
  try {
    const { application, approved } = await writerAccess(userId, identity.profile?.role === "admin");
    if (action === "apply") {
      if (application && !["rejected", "paused"].includes(application.status)) {
        return json({ error: application.status === "approved" ? "You are already approved. Edit your profile instead." : "Your application is already awaiting editorial review." }, 409);
      }
      const bio = cleanWriterText(body.bio, 2000);
      if (bio.length < 40) return json({ error: "Tell the team about your writing experience (at least 40 characters)." }, 400);
      const beats = Array.isArray(body.beats) ? body.beats.map(v => cleanWriterText(v, 60)).filter(Boolean).slice(0, 8) : [];
      const payload = { user_id: userId, bio, beats, portfolio_url: safeWriterPortfolio(body.portfolioUrl), status: "submitted", review_notes: null, reviewed_by: null, reviewed_at: null, updated_at: new Date().toISOString() };
      const data = await creatorJson(await resource("writer_applications?on_conflict=user_id", { method: "POST", headers: { ...creatorHeaders, Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(payload) }));
      return json({ application: data[0] });
    }
    if (action === "update_profile") {
      if (!approved || !application) return json({ error: "Writer approval required." }, 403);
      const bio = cleanWriterText(body.bio, 2000);
      if (bio.length < 40) return json({ error: "Add at least 40 characters to your writer bio." }, 400);
      const beats = Array.isArray(body.beats) ? body.beats.map(v => cleanWriterText(v, 60)).filter(Boolean).slice(0, 8) : [];
      const data = await creatorJson(await resource(`writer_applications?user_id=eq.${userId}&status=eq.approved`, { method: "PATCH", headers: { ...creatorHeaders, Prefer: "return=representation" }, body: JSON.stringify({ bio, beats, portfolio_url: safeWriterPortfolio(body.portfolioUrl), updated_at: new Date().toISOString() }) }));
      return json({ application: data[0] });
    }
    if (action === "save_article") {
      if (!approved) return json({ error: "An editor must approve your application before you can draft articles." }, 403);
      const title = cleanWriterText(body.title, 180);
      const dek = cleanWriterText(body.dek, 400);
      const articleBody = cleanWriterText(body.body, 60000);
      const submit = body.submit === true;
      if (title.length < 5) return json({ error: "Add a descriptive article title." }, 400);
      if (submit && articleBody.length < 120) return json({ error: "Add at least 120 characters before submitting for review." }, 400);
      const articleId = cleanWriterText(body.id, 80);
      if (articleId && !/^[0-9a-f-]{36}$/i.test(articleId)) return json({ error: "Invalid article ID." }, 400);
      let current: Article | null = null;
      if (articleId) {
        const r = await resource(`editorial_articles?id=eq.${encodeURIComponent(articleId)}&author_id=eq.${userId}&select=id,author_id,status,cover_art_path&limit=1`);
        if (!r.ok) throw new Error("Could not check article ownership.");
        current = ((await r.json()) as Article[])[0] || null;
        if (!current || !editableArticleStatuses.has(current.status)) return json({ error: "Only your drafts or requested revisions can be edited." }, 409);
      }
      const coverPath = typeof body.coverPath === "string" ? cleanWriterText(body.coverPath, 900) : (current?.cover_art_path || "");
      if (coverPath && (!validWriterCoverPath(coverPath, userId) || !r2Configured() || !(await r2ObjectExists(coverPath)))) {
        return json({ error: "Cover image is missing or does not belong to your account." }, 400);
      }
      const sources = Array.isArray(body.sources)
        ? body.sources.filter(v => typeof v === "string").map(v => safeWriterPortfolio(v)).filter((v): v is string => Boolean(v)).slice(0, 20)
        : [];
      const payload = { author_id: userId, title, dek, body: articleBody, sources, cover_art_path: coverPath || null, status: submit ? "submitted" : "draft", updated_at: new Date().toISOString() };
      const response = articleId
        ? await resource(`editorial_articles?id=eq.${encodeURIComponent(articleId)}&author_id=eq.${userId}&status=in.(draft,changes_requested)`, { method: "PATCH", headers: { ...creatorHeaders, Prefer: "return=representation" }, body: JSON.stringify(payload) })
        : await resource("editorial_articles", { method: "POST", headers: { ...creatorHeaders, Prefer: "return=representation" }, body: JSON.stringify(payload) });
      const rows = await creatorJson(response);
      if (!rows[0]) return json({ error: "This article is no longer editable." }, 409);
      return json({ article: rows[0] });
    }
    return json({ error: "Unknown writer action." }, 400);
  } catch (error) {
    console.error("Writer workflow failed", error);
    return json({ error: "Could not complete your request. Check that editorial migrations are applied." }, 503);
  }
}
