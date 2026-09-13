import { NextResponse } from "next/server";
import { creatorIdentity } from "@/lib/creator-server";
import {
  loadParticipationProfiles,
  participationEnabled,
  participationInsert,
  participationPatch,
  participationReady,
  participationRows,
} from "@/lib/participation-server";

type ReportRow = {
  id: string;
  reporter_user_id: string;
  thread_id?: string | null;
  message_id?: string | null;
  reported_user_id?: string | null;
  reason: string;
  details?: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  review_owner_user_id?: string | null;
  reviewed_at?: string | null;
  created_at: string;
};
type ThreadRow = { id: string; thread_type: string; author_user_id?: string | null; object_owner_user_id?: string | null; object_title?: string | null; status: string };
type MessageRow = { id: string; thread_id: string; author_user_id?: string | null; body: string; status: string; message_kind: string };

type ModerationAction = "review" | "hide" | "restore" | "lock" | "unlock" | "delete" | "resolve_report" | "dismiss_report";
const actions = new Set<ModerationAction>(["review", "hide", "restore", "lock", "unlock", "delete", "resolve_report", "dismiss_report"]);

async function adminIdentity(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity?.user?.id || identity.profile?.role !== "admin") return null;
  return identity;
}

export async function GET(request: Request) {
  if (!participationEnabled()) return NextResponse.json({ enabled: false, reports: [] });
  if (!participationReady()) return NextResponse.json({ error: "Participation moderation is unavailable." }, { status: 503 });
  const identity = await adminIdentity(request);
  if (!identity) return NextResponse.json({ error: "Editorial access required." }, { status: 403 });
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "open,reviewing";
  const allowedStatus = status.split(",").filter((value) => ["open", "reviewing", "resolved", "dismissed"].includes(value));
  const statusFilter = allowedStatus.length ? `status=in.(${allowedStatus.join(",")})` : "status=in.(open,reviewing)";
  const reports = await participationRows<ReportRow>(
    `participation_reports?${statusFilter}&select=id,reporter_user_id,thread_id,message_id,reported_user_id,reason,details,status,review_owner_user_id,reviewed_at,created_at&order=created_at.asc&limit=150`,
  );
  const threadIds = [...new Set(reports.map((row) => row.thread_id).filter(Boolean) as string[])];
  const messageIds = [...new Set(reports.map((row) => row.message_id).filter(Boolean) as string[])];
  const [threads, messages] = await Promise.all([
    threadIds.length ? participationRows<ThreadRow>(`participation_threads?id=in.(${threadIds.map(encodeURIComponent).join(",")})&select=id,thread_type,author_user_id,object_owner_user_id,object_title,status&limit=200`) : [],
    messageIds.length ? participationRows<MessageRow>(`participation_messages?id=in.(${messageIds.map(encodeURIComponent).join(",")})&select=id,thread_id,author_user_id,body,status,message_kind&limit=200`) : [],
  ]);
  const userIds = [...new Set([
    ...reports.flatMap((row) => [row.reporter_user_id, row.reported_user_id, row.review_owner_user_id]),
    ...threads.flatMap((row) => [row.author_user_id, row.object_owner_user_id]),
    ...messages.map((row) => row.author_user_id),
  ].filter(Boolean) as string[])];
  const profiles = await loadParticipationProfiles(userIds);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const threadById = new Map(threads.map((row) => [row.id, row]));
  const messageById = new Map(messages.map((row) => [row.id, row]));
  return NextResponse.json({
    enabled: true,
    reports: reports.map((report) => ({
      id: report.id,
      reason: report.reason,
      details: report.details || null,
      status: report.status,
      createdAt: report.created_at,
      reviewedAt: report.reviewed_at || null,
      reporter: profileById.get(report.reporter_user_id) || { id: report.reporter_user_id, username: null, displayName: "BVS member", avatarUrl: null },
      reported: report.reported_user_id ? profileById.get(report.reported_user_id) || { id: report.reported_user_id, username: null, displayName: "BVS member", avatarUrl: null } : null,
      reviewOwner: report.review_owner_user_id ? profileById.get(report.review_owner_user_id) || null : null,
      thread: report.thread_id ? threadById.get(report.thread_id) || null : null,
      message: report.message_id ? messageById.get(report.message_id) || null : null,
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  if (!participationEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!participationReady()) return NextResponse.json({ error: "Participation moderation is unavailable." }, { status: 503 });
  const identity = await adminIdentity(request);
  if (!identity) return NextResponse.json({ error: "Editorial access required." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { reportId?: string; action?: ModerationAction; reason?: string };
  const reportId = String(body.reportId || "").trim();
  const action = body.action as ModerationAction;
  const reason = String(body.reason || "").trim().slice(0, 500);
  if (!reportId || !actions.has(action)) return NextResponse.json({ error: "Invalid moderation action." }, { status: 400 });
  if (action !== "review" && !reason) return NextResponse.json({ error: "Add a moderation reason for the audit log." }, { status: 400 });
  const report = (await participationRows<ReportRow>(
    `participation_reports?id=eq.${encodeURIComponent(reportId)}&select=id,reporter_user_id,thread_id,message_id,reported_user_id,reason,details,status,review_owner_user_id,reviewed_at,created_at&limit=1`,
  ))[0];
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  const staffId = identity.user.id;
  const now = new Date().toISOString();

  if (action === "review") {
    const updated = await participationPatch<ReportRow>(`participation_reports?id=eq.${encodeURIComponent(report.id)}`, {
      status: "reviewing", review_owner_user_id: staffId,
    });
    return NextResponse.json({ ok: Boolean(updated[0]), status: "reviewing" });
  }

  let auditAction: "hide" | "restore" | "lock" | "unlock" | "delete" | "resolve_report" | "dismiss_report" = action;
  if (action === "hide") {
    if (report.message_id) await participationPatch(`participation_messages?id=eq.${encodeURIComponent(report.message_id)}`, { status: "hidden", updated_at: now });
    else if (report.thread_id) await participationPatch(`participation_threads?id=eq.${encodeURIComponent(report.thread_id)}`, { status: "hidden", updated_at: now });
  } else if (action === "restore") {
    if (report.message_id) await participationPatch(`participation_messages?id=eq.${encodeURIComponent(report.message_id)}`, { status: "published", deleted_at: null, updated_at: now });
    else if (report.thread_id) await participationPatch(`participation_threads?id=eq.${encodeURIComponent(report.thread_id)}`, { status: "published", updated_at: now });
  } else if (action === "lock" && report.thread_id) {
    await participationPatch(`participation_threads?id=eq.${encodeURIComponent(report.thread_id)}`, { status: "locked", updated_at: now });
  } else if (action === "unlock" && report.thread_id) {
    await participationPatch(`participation_threads?id=eq.${encodeURIComponent(report.thread_id)}`, { status: "published", updated_at: now });
  } else if (action === "delete") {
    if (report.message_id) await participationPatch(`participation_messages?id=eq.${encodeURIComponent(report.message_id)}`, { body: "Removed by BVS moderation.", status: "deleted", deleted_at: now, updated_at: now });
    else if (report.thread_id) await participationPatch(`participation_threads?id=eq.${encodeURIComponent(report.thread_id)}`, { status: "deleted", updated_at: now });
  }

  if (action === "resolve_report" || action === "dismiss_report") {
    await participationPatch(`participation_reports?id=eq.${encodeURIComponent(report.id)}`, {
      status: action === "resolve_report" ? "resolved" : "dismissed",
      review_owner_user_id: staffId,
      reviewed_at: now,
    });
  } else {
    await participationPatch(`participation_reports?id=eq.${encodeURIComponent(report.id)}`, {
      status: "reviewing", review_owner_user_id: staffId,
    });
  }

  const audits = await participationInsert<{ id: string }>("participation_moderation_audit", {
    staff_user_id: staffId,
    action: auditAction,
    thread_id: report.thread_id || null,
    message_id: report.message_id || null,
    report_id: report.id,
    reason,
    created_at: now,
  });
  const audit = audits[0];
  if (audit) {
    await participationInsert("participation_domain_events", {
      source_key: `moderation:${audit.id}`,
      event_type: "thread_moderated",
      actor_user_id: staffId,
      thread_id: report.thread_id || null,
      message_id: report.message_id || null,
      occurred_at: now,
      payload: { report_id: report.id, action, reported_user_id: report.reported_user_id || null, reason },
    }, "return=minimal");
  }
  return NextResponse.json({ ok: true, action, reportId: report.id });
}
