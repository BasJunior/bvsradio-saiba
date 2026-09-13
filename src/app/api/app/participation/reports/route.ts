import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/app-api-auth";
import {
  checkParticipationRateLimit,
  cleanParticipationBody,
  participationEnabled,
  participationVisibleThread,
  participationRequestSurface,
  participationInsert,
  participationReady,
  participationRows,
} from "@/lib/participation-server";

const reasons = new Set(["harassment", "spam", "harmful_content", "rights_concern", "other"]);

type MessageTarget = { id: string; thread_id: string; author_user_id?: string | null; status: string };
type ThreadTarget = { id: string; author_user_id?: string | null; object_owner_user_id?: string | null; status: string };

export async function POST(request: Request) {
  if (!participationEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!participationReady()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in to report content." }, { status: 401 });
  const rate = await checkParticipationRateLimit(request, user.id, "report");
  if (!rate.allowed) return NextResponse.json({ error: "Too many reports in a short period.", retryAfter: rate.retryAfter }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });

  const body = await request.json().catch(() => ({})) as { threadId?: string; messageId?: string; reason?: string; details?: string };
  const threadId = String(body.threadId || "").trim();
  const messageId = String(body.messageId || "").trim();
  const reason = String(body.reason || "").trim();
  if (!threadId || !reasons.has(reason)) return NextResponse.json({ error: "Choose a report reason." }, { status: 400 });
  const details = cleanParticipationBody(body.details, 500) || null;

  if (!await participationVisibleThread(threadId, user.id, participationRequestSurface(request))) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  const threads = await participationRows<ThreadTarget>(
    `participation_threads?id=eq.${encodeURIComponent(threadId)}&status=in.(published,locked)&select=id,author_user_id,object_owner_user_id,status&limit=1`,
  );
  const thread = threads[0];
  if (!thread) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  let reportedUserId = thread.author_user_id || thread.object_owner_user_id || null;
  if (messageId) {
    const messages = await participationRows<MessageTarget>(
      `participation_messages?id=eq.${encodeURIComponent(messageId)}&thread_id=eq.${encodeURIComponent(threadId)}&status=eq.published&select=id,thread_id,author_user_id,status&limit=1`,
    );
    if (!messages[0]) return NextResponse.json({ error: "Message not found." }, { status: 404 });
    reportedUserId = messages[0].author_user_id || reportedUserId;
  }
  if (reportedUserId === user.id) return NextResponse.json({ error: "You cannot report your own content." }, { status: 400 });

  const existing = messageId
    ? await participationRows<{ id: string }>(`participation_reports?reporter_user_id=eq.${encodeURIComponent(user.id)}&message_id=eq.${encodeURIComponent(messageId)}&select=id&limit=1`)
    : await participationRows<{ id: string }>(`participation_reports?reporter_user_id=eq.${encodeURIComponent(user.id)}&thread_id=eq.${encodeURIComponent(threadId)}&message_id=is.null&select=id&limit=1`);
  if (existing[0]) return NextResponse.json({ ok: true, reportId: existing[0].id, alreadyReported: true });

  const rows = await participationInsert<{ id: string }>("participation_reports", {
    reporter_user_id: user.id,
    thread_id: threadId,
    message_id: messageId || null,
    reported_user_id: reportedUserId,
    reason,
    details,
    status: "open",
    created_at: new Date().toISOString(),
  });
  const report = rows[0];
  if (!report) return NextResponse.json({ error: "Could not submit this report." }, { status: 503 });
  await participationInsert("participation_domain_events", {
    source_key: `report:${report.id}`,
    event_type: "thread_reported",
    actor_user_id: user.id,
    thread_id: threadId,
    message_id: messageId || null,
    occurred_at: new Date().toISOString(),
    payload: { report_id: report.id, reason },
  }, "return=minimal");
  return NextResponse.json({ ok: true, reportId: report.id }, { status: 201 });
}
