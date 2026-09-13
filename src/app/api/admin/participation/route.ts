import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/app-api-auth";
import {
  cleanParticipationBody,
  participationEnabled,
  participationInsert,
  participationPatch,
  participationReady,
  participationRows,
} from "@/lib/participation-server";

const actions = new Set(["hide", "restore", "lock", "unlock", "delete", "resolve_report", "dismiss_report"]);

async function requireParticipationStaff(request: Request) {
  const user = await requireAppUser(request);
  if (!user) return null;
  const rows = await participationRows<{ user_id: string; role: string; active: boolean }>(
    `editorial_staff?user_id=eq.${encodeURIComponent(user.id)}&active=eq.true&select=user_id,role,active&limit=1`,
  );
  return rows[0] ? { user, staff: rows[0] } : null;
}

export async function GET(request: Request) {
  if (!participationEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!participationReady()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });
  const access = await requireParticipationStaff(request);
  if (!access) return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  const url = new URL(request.url);
  const status = ["open", "reviewing", "resolved", "dismissed"].includes(String(url.searchParams.get("status")))
    ? String(url.searchParams.get("status"))
    : "open";
  const reports = await participationRows<Record<string, unknown>>(
    `participation_reports?status=eq.${encodeURIComponent(status)}&select=id,reporter_user_id,thread_id,message_id,reported_user_id,reason,details,status,review_owner_user_id,reviewed_at,created_at&order=created_at.asc&limit=100`,
  );
  return NextResponse.json({ reports }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!participationEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!participationReady()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });
  const access = await requireParticipationStaff(request);
  if (!access) return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as {
    action?: string;
    threadId?: string;
    messageId?: string;
    reportId?: string;
    reason?: string;
  };
  const action = String(body.action || "");
  if (!actions.has(action)) return NextResponse.json({ error: "Invalid moderation action." }, { status: 400 });
  const reason = cleanParticipationBody(body.reason, 500);
  if (!reason) return NextResponse.json({ error: "Record a moderation reason." }, { status: 400 });
  const now = new Date().toISOString();
  const threadId = String(body.threadId || "").trim() || null;
  const messageId = String(body.messageId || "").trim() || null;
  const reportId = String(body.reportId || "").trim() || null;

  if (action === "hide" || action === "restore" || action === "delete") {
    if (!threadId && !messageId) return NextResponse.json({ error: "Choose content to moderate." }, { status: 400 });
    if (messageId) {
      const status = action === "restore" ? "published" : action === "hide" ? "hidden" : "deleted";
      const payload: Record<string, unknown> = { status, updated_at: now };
      if (action === "delete") Object.assign(payload, { body: "This message was deleted.", deleted_at: now });
      else if (action === "restore") Object.assign(payload, { deleted_at: null });
      const rows = await participationPatch(`participation_messages?id=eq.${encodeURIComponent(messageId)}`, payload);
      if (!rows[0]) return NextResponse.json({ error: "Message moderation failed." }, { status: 404 });
    } else if (threadId) {
      const status = action === "restore" ? "published" : action === "hide" ? "hidden" : "deleted";
      const rows = await participationPatch(`participation_threads?id=eq.${encodeURIComponent(threadId)}`, {
        status,
        moderation_reason: reason,
        updated_at: now,
        ...(action === "delete" ? { deleted_at: now } : action === "restore" ? { deleted_at: null } : {}),
      });
      if (!rows[0]) return NextResponse.json({ error: "Thread moderation failed." }, { status: 404 });
    }
  }

  if (action === "lock" || action === "unlock") {
    if (!threadId) return NextResponse.json({ error: "Choose a conversation." }, { status: 400 });
    const rows = await participationPatch(`participation_threads?id=eq.${encodeURIComponent(threadId)}`, {
      status: action === "lock" ? "locked" : "published",
      moderation_reason: action === "lock" ? reason : null,
      updated_at: now,
    });
    if (!rows[0]) return NextResponse.json({ error: "Conversation moderation failed." }, { status: 404 });
  }

  if (action === "resolve_report" || action === "dismiss_report") {
    if (!reportId) return NextResponse.json({ error: "Choose a report." }, { status: 400 });
    const rows = await participationPatch(`participation_reports?id=eq.${encodeURIComponent(reportId)}`, {
      status: action === "resolve_report" ? "resolved" : "dismissed",
      review_owner_user_id: access.user.id,
      reviewed_at: now,
    });
    if (!rows[0]) return NextResponse.json({ error: "Report update failed." }, { status: 404 });
  }

  await participationInsert("participation_moderation_audit", {
    staff_user_id: access.user.id,
    action,
    thread_id: threadId,
    message_id: messageId,
    report_id: reportId,
    reason,
    created_at: now,
  }, "return=minimal");
  await participationInsert("participation_domain_events", {
    source_key: `moderation:${access.user.id}:${action}:${threadId || messageId || reportId}:${Date.now()}`,
    event_type: "thread_moderated",
    actor_user_id: access.user.id,
    thread_id: threadId,
    message_id: messageId,
    occurred_at: now,
    payload: { action, report_id: reportId },
  }, "return=minimal");
  return NextResponse.json({ ok: true });
}
