import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/app-api-auth";
import { withParticipationErrors } from "@/lib/participation-route";
import { blockedPair, loadParticipationProfiles, participationEnabled, participationReady, participationRequestSurface, participationRows, participationVisibleThread } from "@/lib/participation-server";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withParticipationErrors(async () => {
    if (!participationEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (!participationReady()) return NextResponse.json({ error: "Profiles are unavailable." }, { status: 503 });
    const { id } = await params;
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) return NextResponse.json({ error: "Member not found." }, { status: 404 });
    const user = await requireAppUser(request);
    if (user && await blockedPair(user.id, id)) return NextResponse.json({ error: "Member not found." }, { status: 404 });
    const surface = participationRequestSurface(request);
    const metadata = (await participationRows<{ is_published: boolean; bio: string | null; username: string | null }>(`profiles?id=eq.${id}&select=is_published,bio,username&limit=1`))[0];
    if (!metadata) return NextResponse.json({ error: "Member not found." }, { status: 404 });
    const messages = await participationRows<{ id: string; thread_id: string; message_kind: string; body: string; created_at: string }>(`participation_messages?author_user_id=eq.${id}&status=eq.published&select=id,thread_id,message_kind,body,created_at&order=created_at.desc&limit=15`);
    const ids = [...new Set(messages.map(message => message.thread_id))];
    const visible = await Promise.all(ids.map(thread => participationVisibleThread(thread, user?.id || null, surface)));
    const allowed = new Set(visible.filter(Boolean).map(thread => thread!.id));
    if (!metadata.is_published && !allowed.size) return NextResponse.json({ error: "Member not found." }, { status: 404 });
    const profile = (await loadParticipationProfiles([id]))[0];
    if (!profile) return NextResponse.json({ error: "Member not found." }, { status: 404 });
    return NextResponse.json({ profile, bio: metadata.is_published ? metadata.bio || "" : "",
      creatorHref: metadata.is_published && metadata.username ? (surface ? `/app/${surface}/creator/${id}` : `/artist/${encodeURIComponent(metadata.username)}`) : null,
      activity: messages.filter(message => allowed.has(message.thread_id)).map(message => ({ id: message.id, body: message.body.slice(0, 240), createdAt: message.created_at,
        href: `${surface ? `/app/${surface}` : ""}/feed/${message.thread_id}#reply-${message.id}`, kind: message.message_kind === "root" ? "Post" : "Comment" })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  });
}
