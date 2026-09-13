import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/app-api-auth";
import {
  blockedPair,
  cleanParticipationBody,
  loadParticipationProfiles,
  participationBodyIssue,
  participationEnabled,
  participationPatch,
  participationReady,
  participationRows,
  participationRpc,
  userBlockSet,
  type ParticipationIntent,
  type ParticipationObjectKind,
} from "@/lib/participation-server";

type ThreadRow = {
  id: string;
  thread_type: "post" | "content";
  author_user_id?: string | null;
  intent?: ParticipationIntent | null;
  object_kind?: ParticipationObjectKind | null;
  object_id?: string | null;
  object_title?: string | null;
  object_href?: string | null;
  object_owner_user_id?: string | null;
  attachment_kind?: ParticipationObjectKind | null;
  attachment_id?: string | null;
  attachment_title?: string | null;
  attachment_href?: string | null;
  status: "published" | "locked";
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  thread_id: string;
  author_user_id?: string | null;
  message_kind: "root" | "reply";
  reply_to_id?: string | null;
  body: string;
  status: "published" | "deleted";
  created_at: string;
  updated_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
};

type SummaryRow = {
  thread_id: string;
  like_count: number | string;
  repost_count: number | string;
  reply_count: number | string;
  viewer_liked: boolean;
  viewer_reposted: boolean;
};

async function loadThread(threadId: string, viewerId: string | null) {
  const threads = await participationRows<ThreadRow>(
    `participation_threads?id=eq.${encodeURIComponent(threadId)}&status=in.(published,locked)&select=id,thread_type,author_user_id,intent,object_kind,object_id,object_title,object_href,object_owner_user_id,attachment_kind,attachment_id,attachment_title,attachment_href,status,created_at,updated_at&limit=1`,
  );
  const thread = threads[0];
  if (!thread) return null;
  const rootOwner = thread.thread_type === "post" ? thread.author_user_id : thread.object_owner_user_id;
  if (viewerId && rootOwner && await blockedPair(viewerId, rootOwner)) return null;

  const blocked = viewerId ? await userBlockSet(viewerId) : new Set<string>();
  const messages = await participationRows<MessageRow>(
    `participation_messages?thread_id=eq.${encodeURIComponent(thread.id)}&status=in.(published,deleted)&select=id,thread_id,author_user_id,message_kind,reply_to_id,body,status,created_at,updated_at,edited_at,deleted_at&order=created_at.asc,id.asc&limit=500`,
  );
  const visibleMessages = messages.filter((message) => !message.author_user_id || !blocked.has(message.author_user_id));
  const authorIds = [...new Set(visibleMessages.flatMap((message) => [message.author_user_id || ""]).filter(Boolean))];
  const profiles = await loadParticipationProfiles(authorIds);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const messageById = new Map(visibleMessages.map((message) => [message.id, message]));
  const summaryRows = await participationRpc<SummaryRow[]>("participation_thread_summary", {
    p_thread_ids: [thread.id],
    p_viewer: viewerId,
  });
  const summary = Array.isArray(summaryRows) ? summaryRows[0] : null;
  const subscriptions = viewerId
    ? await participationRows<{ watch_all_replies: boolean; muted_at?: string | null }>(
      `participation_thread_subscriptions?user_id=eq.${encodeURIComponent(viewerId)}&thread_id=eq.${encodeURIComponent(thread.id)}&select=watch_all_replies,muted_at&limit=1`,
    )
    : [];

  return {
    thread: {
      id: thread.id,
      type: thread.thread_type,
      intent: thread.intent || null,
      status: thread.status,
      createdAt: thread.created_at,
      updatedAt: thread.updated_at,
      authorUserId: thread.author_user_id || null,
      object: thread.object_kind && thread.object_id ? {
        kind: thread.object_kind,
        id: thread.object_id,
        title: thread.object_title || "BVS content",
        href: thread.object_href || "#",
        ownerUserId: thread.object_owner_user_id || null,
      } : null,
      attachment: thread.attachment_kind && thread.attachment_id ? {
        kind: thread.attachment_kind,
        id: thread.attachment_id,
        title: thread.attachment_title || "BVS content",
        href: thread.attachment_href || "#",
      } : null,
    },
    messages: visibleMessages.map((message) => {
      const actor = message.author_user_id ? profileById.get(message.author_user_id) : null;
      const parent = message.reply_to_id ? messageById.get(message.reply_to_id) : null;
      const parentActor = parent?.author_user_id ? profileById.get(parent.author_user_id) : null;
      return {
        id: message.id,
        threadId: message.thread_id,
        kind: message.message_kind,
        replyToId: message.reply_to_id || null,
        body: message.status === "deleted" ? "This message was deleted." : message.body,
        deleted: message.status === "deleted",
        createdAt: message.created_at,
        editedAt: message.edited_at || null,
        author: actor || {
          id: message.author_user_id || "deleted",
          username: null,
          displayName: message.status === "deleted" ? "Deleted member" : "BVS member",
          avatarUrl: null,
        },
        replyToAuthor: parentActor || (parent ? {
          id: parent.author_user_id || "deleted",
          username: null,
          displayName: "BVS member",
          avatarUrl: null,
        } : null),
      };
    }),
    summary: {
      threadId: thread.id,
      likes: Number(summary?.like_count) || 0,
      reposts: Number(summary?.repost_count) || 0,
      comments: Number(summary?.reply_count) || 0,
      liked: Boolean(summary?.viewer_liked),
      reposted: Boolean(summary?.viewer_reposted),
    },
    subscription: subscriptions[0] ? {
      watchAllReplies: Boolean(subscriptions[0].watch_all_replies),
      muted: Boolean(subscriptions[0].muted_at),
    } : { watchAllReplies: false, muted: false },
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!participationEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!participationReady()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });
  const user = await requireAppUser(request);
  const threadId = String((await params).id || "").trim();
  const payload = threadId ? await loadThread(threadId, user?.id || null) : null;
  if (!payload) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  return NextResponse.json(payload, { headers: { "Cache-Control": user ? "private, no-store" : "public, max-age=30, stale-while-revalidate=60" } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!participationEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!participationReady()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });
  const threadId = String((await params).id || "").trim();
  const body = await request.json().catch(() => ({})) as { body?: string };
  const text = cleanParticipationBody(body.body, 1000);
  const issue = participationBodyIssue(text, 1000);
  if (issue) return NextResponse.json({ error: issue }, { status: 400 });
  const threads = await participationRows<ThreadRow>(
    `participation_threads?id=eq.${encodeURIComponent(threadId)}&thread_type=eq.post&author_user_id=eq.${encodeURIComponent(user.id)}&status=eq.published&select=id&limit=1`,
  );
  if (!threads[0]) return NextResponse.json({ error: "You cannot edit this post." }, { status: 403 });
  const updated = await participationPatch<MessageRow>(
    `participation_messages?thread_id=eq.${encodeURIComponent(threadId)}&message_kind=eq.root&author_user_id=eq.${encodeURIComponent(user.id)}&status=eq.published`,
    { body: text, edited_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  );
  if (!updated[0]) return NextResponse.json({ error: "Post could not be updated." }, { status: 503 });
  await participationPatch<ThreadRow>(`participation_threads?id=eq.${encodeURIComponent(threadId)}`, { updated_at: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!participationEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!participationReady()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });
  const threadId = String((await params).id || "").trim();
  const threads = await participationRows<ThreadRow>(
    `participation_threads?id=eq.${encodeURIComponent(threadId)}&thread_type=eq.post&author_user_id=eq.${encodeURIComponent(user.id)}&status=in.(published,locked)&select=id&limit=1`,
  );
  if (!threads[0]) return NextResponse.json({ error: "You cannot delete this post." }, { status: 403 });
  const replies = await participationRows<{ id: string }>(
    `participation_messages?thread_id=eq.${encodeURIComponent(threadId)}&message_kind=eq.reply&status=eq.published&select=id&limit=1`,
  );
  const now = new Date().toISOString();
  const removed = await participationPatch<MessageRow>(
    `participation_messages?thread_id=eq.${encodeURIComponent(threadId)}&message_kind=eq.root&author_user_id=eq.${encodeURIComponent(user.id)}`,
    { body: "This message was deleted.", status: "deleted", deleted_at: now, updated_at: now },
  );
  if (!removed[0]) return NextResponse.json({ error: "Post could not be deleted." }, { status: 503 });
  if (!replies[0]) await participationPatch<ThreadRow>(`participation_threads?id=eq.${encodeURIComponent(threadId)}`, { status: "deleted", deleted_at: now, updated_at: now });
  return NextResponse.json({ ok: true, tombstone: Boolean(replies[0]) });
}
