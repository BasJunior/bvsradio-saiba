"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

type Application = { status: string; bio: string; beats: string[]; portfolio_url: string | null; review_notes?: string | null };
type Article = { id: string; slug: string | null; title: string; dek: string; body: string; cover_art_path: string | null; sources: string[]; status: string; editor_notes?: string | null; updated_at: string };
type WriterData = { application: Application | null; approved: boolean; articles: Article[]; profile: { username: string | null; displayName: string } };
type Draft = { id: string; title: string; dek: string; body: string; sources: string; coverPath: string };
const emptyDraft: Draft = { id: "", title: "", dek: "", body: "", sources: "", coverPath: "" };
const field = "w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-brand focus:outline-none";
const button = "inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";
const editStatuses = new Set(["draft", "changes_requested"]);

export default function WriterStudio() {
  const [token, setToken] = useState("");
  const lastAccessToken = useRef("");
  const [signedOut, setSignedOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<WriterData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [bio, setBio] = useState("");
  const [beats, setBeats] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async (accessToken: string) => {
    const response = await fetch("/api/writer", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    const payload = await response.json() as WriterData & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Could not open the Writer Studio.");
    setData(payload);
    setBio(payload.application?.bio || "");
    setBeats((payload.application?.beats || []).join(", "));
    setPortfolio(payload.application?.portfolio_url || "");
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) { setError("Account service is not configured."); setLoading(false); return; }
    let alive = true;
    const client = createClient();
    const sync = async (nextToken: string) => {
      if (!alive) return;
      lastAccessToken.current = nextToken;
      setToken(nextToken);
      setSignedOut(!nextToken);
      if (nextToken) {
        try { await load(nextToken); if (alive) setError(""); }
        catch (e) { if (alive) setError(e instanceof Error ? e.message : "Writer Studio unavailable."); }
      } else setData(null);
      if (alive) setLoading(false);
    };
    void client.auth.getSession().then(({ data: session }) => sync(session.session?.access_token || ""));
    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      // Avoid synchronous Supabase client calls inside the auth callback.
      if (alive && (session?.access_token || "") !== lastAccessToken.current) void sync(session?.access_token || "");
    });
    return () => { alive = false; subscription.subscription.unsubscribe(); };
  }, [load]);

  const act = async (payload: Record<string, unknown>) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/writer", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Request failed.");
      await load(token);
      setNotice(payload.action === "save_article" ? payload.submit ? "Submitted to the editorial team. You can track its status below." : "Draft saved." : payload.action === "apply" ? "Application submitted for editorial review." : "Writer profile saved.");
      if (payload.action === "save_article") setDraft(emptyDraft);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); }
    finally { setBusy(false); }
  };

  const uploadCover = async (file?: File) => {
    if (!file) return;
    setUploading(true); setError("");
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch("/api/writer/cover", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const result = await response.json() as { path?: string; error?: string };
      if (!response.ok || !result.path) throw new Error(result.error || "Upload failed.");
      setDraft(prev => ({ ...prev, coverPath: result.path || "" }));
      setNotice("Cover image uploaded. Save the article to attach it.");
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); }
    finally { setUploading(false); }
  };
  const applyForm = (mode: "apply" | "update_profile") => void act({ action: mode, bio, beats: beats.split(",").map(x => x.trim()).filter(Boolean), portfolioUrl: portfolio });
  const save = (submit: boolean) => void act({ action: "save_article", id: draft.id || undefined, title: draft.title, dek: draft.dek, body: draft.body, sources: draft.sources.split("\n").map(x => x.trim()).filter(Boolean), coverPath: draft.coverPath, submit });
  const edit = (article: Article) => {
    setDraft({ id: article.id, title: article.title, dek: article.dek, body: article.body, coverPath: article.cover_art_path || "", sources: (article.sources || []).join("\n") });
    document.getElementById("writer-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return <main className="mx-auto min-h-[60vh] max-w-6xl px-5 py-12 sm:px-6">
    <div className="mb-10 flex flex-wrap items-start justify-between gap-5">
      <div><p className="text-xs font-bold uppercase tracking-[.22em] text-brand">BVS Journal · Contributors</p><h1 className="mt-2 text-4xl font-bold sm:text-5xl">Writer Studio</h1><p className="mt-4 max-w-2xl leading-7 text-text-secondary">Pitch your voice, craft stories and follow every editorial decision. Publishing is always reviewed by the BVS team.</p></div>
      <Link href="/blog" className="rounded-full border border-white/15 px-5 py-3 text-sm hover:border-brand">Read the Journal</Link>
    </div>
    {loading && <p role="status" className="text-text-secondary">Opening Writer Studio…</p>}
    {!loading && signedOut && <section className="rounded-3xl border border-brand/20 bg-white/[.03] p-8"><h2 className="text-2xl font-semibold">Become a BVS contributor</h2><p className="mt-3 text-text-secondary">Sign in or create a free BVS account to apply. You do not need an artist account.</p><Link href="/auth/login?next=/writer" className={`${button} mt-6 bg-brand text-black`}>Sign in to apply</Link><Link href="/auth/signup?next=%2Fwriter" className="ml-4 text-sm text-brand hover:underline">Create an account</Link></section>}
    {error && <p role="alert" className="mb-6 rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
    {notice && <p role="status" className="mb-6 rounded-xl border border-brand/25 bg-brand/10 p-4 text-sm text-brand">{notice}</p>}
    {data && <>
      <section className="rounded-3xl border border-white/10 bg-white/[.025] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-brand">Contributor access</p><h2 className="mt-2 text-2xl font-semibold">{data.approved ? "Your writer profile" : "Apply to write for BVS"}</h2></div>
          <span className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-widest text-text-secondary">{data.application?.status?.replaceAll("_", " ") || "Not applied"}</span></div>
        {data.application?.review_notes && <p className="mt-4 rounded-xl bg-white/5 p-4 text-sm text-text-secondary">Editorial feedback: {data.application.review_notes}</p>}
        {(!data.application || ["rejected", "paused", "approved"].includes(data.application.status)) && <>
          <div className="mt-6 grid gap-5">
            <label className="grid gap-2 text-sm">Your bio and writing experience<textarea className={field} rows={5} maxLength={2000} value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell our editors about your music interests, writing background and the stories you want to tell." /></label>
            <div className="grid gap-5 sm:grid-cols-2"><label className="grid gap-2 text-sm">Your beats / topics<input className={field} value={beats} onChange={e => setBeats(e.target.value)} placeholder="Interviews, reviews, hip-hop, radio…" /></label>
            <label className="grid gap-2 text-sm">Portfolio URL (optional)<input className={field} type="url" value={portfolio} onChange={e => setPortfolio(e.target.value)} placeholder="https://" /></label></div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3"><button type="button" disabled={busy || bio.trim().length < 40} className={`${button} bg-brand text-black`} onClick={() => applyForm(data.approved ? "update_profile" : "apply")}>{busy ? "Saving…" : data.approved ? "Save writer profile" : "Submit application"}</button>
            {data.approved && data.profile.username && <Link className={`${button} border border-white/20 text-white`} href={`/writer/${encodeURIComponent(data.profile.username)}`}>View public profile</Link>}</div>
        </>}
        {data.application && ["submitted"].includes(data.application.status) && <p className="mt-5 text-sm leading-7 text-text-secondary">Your application is in the editorial queue. Return here to see the decision.</p>}
      </section>
      {data.approved && <>
        <section id="writer-editor" className="mt-9 scroll-mt-28 rounded-3xl border border-white/10 bg-white/[.025] p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-brand">Writing desk</p><h2 className="mt-2 text-2xl font-semibold">{draft.id ? "Edit your draft" : "Write a new article"}</h2></div>{draft.id && <button type="button" className="text-sm text-brand hover:underline" onClick={() => setDraft(emptyDraft)}>Start another story</button>}</div>
          <div className="mt-6 grid gap-5">
            <label className="grid gap-2 text-sm">Headline<input className={field} maxLength={180} value={draft.title} onChange={e => setDraft(p => ({ ...p, title: e.target.value }))} placeholder="An original headline" /></label>
            <label className="grid gap-2 text-sm">Short introduction<input className={field} maxLength={400} value={draft.dek} onChange={e => setDraft(p => ({ ...p, dek: e.target.value }))} placeholder="What should listeners know about this story?" /></label>
            <label className="grid gap-2 text-sm">Article body<textarea className={`${field} min-h-80 font-mono leading-7`} rows={16} maxLength={60000} value={draft.body} onChange={e => setDraft(p => ({ ...p, body: e.target.value }))} placeholder={"Write your story here. Separate paragraphs with a blank line; use ## for a section heading."} /><span className="text-xs text-text-secondary">{draft.body.trim().split(/\s+/).filter(Boolean).length} words · Plain text with ## headings</span></label>
            <label className="grid gap-2 text-sm">Sources (optional, one URL per line)<textarea className={field} rows={3} value={draft.sources} onChange={e => setDraft(p => ({ ...p, sources: e.target.value }))} placeholder="https://…" /></label>
            <label className="grid gap-2 text-sm">Cover artwork · JPG, PNG, WebP · up to 8 MB<input className="block w-full rounded-xl border border-dashed border-white/20 p-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-brand file:px-4 file:py-2 file:text-black" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading || busy} onChange={e => { void uploadCover(e.target.files?.[0]); e.target.value = ""; }} /><span className="text-xs text-text-secondary">{uploading ? "Uploading image…" : draft.coverPath ? "Cover attached: " + draft.coverPath.split("/").pop() : "Choose cover artwork to appear on the published story."}</span></label>
          </div>
          <div className="mt-6 flex flex-wrap gap-3"><button type="button" disabled={busy || uploading || draft.title.trim().length < 5} className={`${button} border border-white/25 text-white hover:border-brand`} onClick={() => save(false)}>Save draft</button>
            <button type="button" disabled={busy || uploading || draft.title.trim().length < 5 || draft.body.trim().length < 120} className={`${button} bg-brand text-black`} onClick={() => save(true)}>Submit for editorial review</button></div>
          <p className="mt-4 text-xs leading-6 text-text-secondary">Submission does not publish your article. Editors can request revisions, approve, schedule, or publish it.</p>
        </section>
        <section className="mt-9"><div className="flex flex-wrap items-end justify-between gap-3"><h2 className="text-2xl font-semibold">My articles</h2><span className="text-sm text-text-secondary">{data.articles.length} stories</span></div>
          <div className="mt-5 space-y-3">{data.articles.map(article => <article key={article.id} className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-lg font-semibold">{article.title}</h3><p className="mt-1 text-xs text-text-secondary">Updated {new Date(article.updated_at).toLocaleDateString()} · {article.status.replaceAll("_", " ")}</p></div><div className="flex flex-wrap gap-2">{editStatuses.has(article.status) && <button type="button" onClick={() => edit(article)} className={`${button} border border-white/20 hover:border-brand`}>Edit</button>}{article.status === "published" && article.slug && <Link className={`${button} border border-brand/40 text-brand`} href={`/blog/${article.slug}`}>Read published story</Link>}</div></div>{article.editor_notes && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-white/5 p-3 text-sm text-text-secondary">Editor's notes: {article.editor_notes}</p>}</article>)}
          {!data.articles.length && <p className="rounded-2xl border border-dashed border-white/15 p-6 text-sm text-text-secondary">Your stories will appear here once you save the first draft.</p>}</div>
        </section>
      </>}
    </>}
  </main>;
}
