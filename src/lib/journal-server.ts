import "server-only";
import { r2MediaUrl } from "@/lib/r2-storage";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const headers = { apikey: service, Authorization: `Bearer ${service}` };
export type PublishedStory = {
  id: string; slug: string; title: string; dek: string; body: string;
  published_at: string; cover_art_path: string | null;
  author_id: string; authorName: string; authorUsername: string | null;
};
type StoryRow = Omit<PublishedStory, "authorName" | "authorUsername">;
type Profile = { id: string; username: string | null; display_name: string | null };

async function rows<T>(path: string): Promise<T[]> {
  if (!supabaseUrl || !service) return [];
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, { headers, cache: "no-store" });
  if (!response.ok) {
    console.error("Published Journal query failed", response.status);
    return [];
  }
  return response.json() as Promise<T[]>;
}

async function withBylines(stories: StoryRow[]): Promise<PublishedStory[]> {
  const ids = [...new Set(stories.map(item => item.author_id).filter(Boolean))];
  const profiles = ids.length ? await rows<Profile>(`profiles?id=in.(${ids.map(encodeURIComponent).join(",")})&select=id,username,display_name`) : [];
  const byId = new Map(profiles.map(p => [p.id, p]));
  return stories.filter(story => Boolean(story.slug)).map(story => {
    const profile = byId.get(story.author_id);
    return { ...story, authorName: profile?.display_name || profile?.username || "BVS Contributor", authorUsername: profile?.username || null };
  });
}

const select = "id,slug,title,dek,body,published_at,cover_art_path,author_id";
export async function publishedJournalStories(limit = 50): Promise<PublishedStory[]> {
  const stories = await rows<StoryRow>(`editorial_articles?status=eq.published&published_at=not.is.null&select=${select}&order=published_at.desc&limit=${Math.min(Math.max(limit, 1), 100)}`);
  return withBylines(stories);
}
export async function publishedJournalStory(slug: string): Promise<PublishedStory | null> {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const stories = await rows<StoryRow>(`editorial_articles?status=eq.published&slug=eq.${encodeURIComponent(slug)}&select=${select}&limit=1`);
  return (await withBylines(stories))[0] || null;
}
export async function publishedWriterProfile(username: string): Promise<{
  name: string; username: string; bio: string; beats: string[]; articles: PublishedStory[];
} | null> {
  if (!/^[a-zA-Z0-9._-]{1,70}$/.test(username)) return null;
  const profile = (await rows<Profile>(`profiles?username=eq.${encodeURIComponent(username)}&select=id,username,display_name&limit=1`))[0];
  if (!profile?.id || !profile.username) return null;
  const [applications, stories] = await Promise.all([
    rows<{bio: string; beats: string[]}>(`writer_applications?user_id=eq.${profile.id}&status=eq.approved&select=bio,beats&limit=1`),
    rows<StoryRow>(`editorial_articles?author_id=eq.${profile.id}&status=eq.published&published_at=not.is.null&select=${select}&order=published_at.desc&limit=100`),
  ]);
  // Staff authors may publish without applying for a writer role. A public byline
  // should never lead to a 404 when that author already has published articles.
  if (!applications.length && !stories.length) return null;
  return { name: profile.display_name || profile.username, username: profile.username,
    bio: applications[0]?.bio || "", beats: applications[0]?.beats || [],
    articles: await withBylines(stories) };
}
export function publicStoryCover(key: string | null | undefined) {
  return key?.startsWith("writer-covers/") ? r2MediaUrl(key) : null;
}
