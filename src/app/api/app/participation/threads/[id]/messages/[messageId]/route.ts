import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/app-api-auth";
import {
  cleanParticipationBody,
  participationBodyIssue,
  participationEnabled,
  participationPatch,
  participationReady,
  participationRows,
} from "@/lib/participation-server";

type MessageRow = {
  id: string;
  thread_id: string;
  author_user_id?: string | null;
  message_kind: "root" | "reply";
  status: "published" | "deleted";
};

async function ownedReply(threadId: string, messageId: string, userId: string) {
  const rows = await participationRows<MessageRow>(
    `participation_messages?id=eq.${encodeURIComponent(messageId)}&thread_id=eq.${encodeURIComponent(threadId)}&author_user_id=eq.${encodeURIComponent(userId)}&message_kind=eq.reply&status=eq.published&select=id,thread_id,author_user_id,message_kind,status&limit=1`,
  );
  return rows[0] || null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; messageId: string }> }) {
  if (!participationEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!participationReady()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id: threadId, messageId } = await params;
  if (!await ownedReply(threadId, messageId, user.id)) return NextResponse.json({ error: "You cannot edit this reply." }, { status: 403 });
  const payload = await request.json().catch(() => ({})) as { body?: string };
  const text = cleanParticipationBody(payload.body, 500);
  const issue = participationBodyIssue(text, 500);
  if (issue) return NextResponse.json({ error: issue }, { status: 400 });
  const updated = await participationPatch<MessageRow>(
    `participation_messages?id=eq.${encodeURIComponent(messageId)}&thread_id=eq.${encodeURIComponent(threadId)}&author_user_id=eq.${encodeURIComponent(user.id)}&status=eq.published`,
    { body: text, edited_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  );
  if (!updated[0]) return NextResponse.json({ error: "Reply could not be updated." }, { status: 503 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; messageId: string }> }) {
  if (!participationEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!participationReady()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id: threadId, messageId } = await params;
  if (!await ownedReply(threadId, messageId, user.id)) return NextResponse.json({ error: "You cannot delete this reply." }, { status: 403 });
  const now = new Date().toISOString();
  const removed = await participationPatch<MessageRow>(
    `participation_messages?id=eq.${encodeURIComponent(messageId)}&thread_id=eq.${encodeURIComponent(threadId)}&author_user_id=eq.${encodeURIComponent(user.id)}&status=eq.published`,
    { body: "This message was deleted.", status: "deleted", deleted_at: now, updated_at: now },
  );
  if (!removed[0]) return NextResponse.json({ error: "Reply could not be deleted." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
