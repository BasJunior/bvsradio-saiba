import { NextResponse } from "next/server";
import { can, editorialIdentity, editorialUrl, serviceHeaders } from "@/lib/editorial-server";
import {
  COMPLAINT_STATUSES,
  isStaffComplaintTransition,
  sanitizeClientText,
  type ComplaintStatus,
} from "@/lib/rights-compliance";
import {
  staffOverrideRestriction,
  staffUpdateComplaint,
} from "@/lib/rights-compliance-server";

async function optionalJson(path: string) {
  const response = await fetch(editorialUrl(path), { headers: serviceHeaders, cache: "no-store" });
  if (!response.ok) return [];
  return response.json();
}

export async function GET(request: Request) {
  const identity = await editorialIdentity(request);
  if (!identity) {
    return NextResponse.json({ error: "Editorial access required." }, { status: 403 });
  }
  if (!can(identity, "approve_submissions")) {
    return NextResponse.json({ error: "Insufficient editorial permission." }, { status: 403 });
  }

  const [complaints, events, strikes, restrictions, settings, counters, notices] = await Promise.all([
    optionalJson("copyright_complaints?select=*&order=created_at.desc&limit=100"),
    optionalJson("copyright_complaint_events?select=*&order=created_at.desc&limit=200"),
    optionalJson("copyright_strikes?select=*&order=created_at.desc&limit=100"),
    optionalJson("account_rights_restrictions?select=*&order=updated_at.desc&limit=100"),
    optionalJson("copyright_policy_settings?id=eq.1&select=*&limit=1"),
    optionalJson("copyright_counter_notices?select=*&order=submitted_at.desc&limit=50"),
    optionalJson("artist_rights_notices?select=id,user_id,notice_type,title,created_at&order=created_at.desc&limit=50"),
  ]);

  return NextResponse.json({
    identity: { role: identity.role, permissions: identity.permissions },
    complaints,
    events,
    strikes,
    restrictions,
    settings: settings[0] || null,
    counters,
    notices,
  });
}

type Body = { action?: string; [key: string]: unknown };

export async function PATCH(request: Request) {
  const identity = await editorialIdentity(request);
  if (!identity) return NextResponse.json({ error: "Editorial access required." }, { status: 403 });
  if (!can(identity, "approve_submissions")) {
    return NextResponse.json({ error: "Insufficient editorial permission." }, { status: 403 });
  }

  const body = (await request.json()) as Body;

  try {
    switch (body.action) {
      case "update_complaint": {
        const complaintId = String(body.complaintId || "");
        const status = String(body.status || "") as ComplaintStatus;
        if (!/^[0-9a-f-]{36}$/i.test(complaintId)) {
          return NextResponse.json({ error: "complaintId required." }, { status: 400 });
        }
        if (!COMPLAINT_STATUSES.includes(status)) {
          return NextResponse.json({ error: "Invalid status." }, { status: 400 });
        }

        const existing = (await optionalJson(
          `copyright_complaints?id=eq.${encodeURIComponent(complaintId)}&select=status&limit=1`,
        ))[0] as { status?: ComplaintStatus } | undefined;
        if (!existing?.status) {
          return NextResponse.json({ error: "Complaint not found." }, { status: 404 });
        }
        if (!isStaffComplaintTransition(existing.status, status)) {
          return NextResponse.json(
            { error: `Cannot move docket from ${existing.status} to ${status}.` },
            { status: 409 },
          );
        }

        const result = await staffUpdateComplaint({
          complaintId,
          staffId: identity.user.id,
          status,
          staffNotes: body.staffNotes ? sanitizeClientText(body.staffNotes, 4000) : undefined,
          resolutionSummary: body.resolutionSummary
            ? sanitizeClientText(body.resolutionSummary, 4000)
            : undefined,
          applyHold: body.applyHold === true || status === "hold_applied",
          issueStrike: body.issueStrike === true || status === "resolved_upheld",
        });
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      case "override_restriction": {
        if (!can(identity, "manage_staff")) {
          return NextResponse.json(
            { error: "Only administrators can override rights restrictions." },
            { status: 403 },
          );
        }
        const userId = String(body.userId || "");
        const reason = sanitizeClientText(body.reason, 2000);
        if (!/^[0-9a-f-]{36}$/i.test(userId)) {
          return NextResponse.json({ error: "userId required." }, { status: 400 });
        }
        const result = await staffOverrideRestriction({
          userId,
          staffId: identity.user.id,
          reason,
          clearUpload: body.clearUpload !== false,
          clearPublish: body.clearPublish !== false,
        });
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      case "update_policy": {
        if (identity.role !== "administrator") {
          return NextResponse.json({ error: "Administrator only." }, { status: 403 });
        }
        const strikeThreshold = Math.min(20, Math.max(1, Number(body.strikeThreshold) || 3));
        const accountThreshold = Math.min(20, Math.max(1, Number(body.accountRestrictionThreshold) || 3));
        const response = await fetch(editorialUrl("copyright_policy_settings?id=eq.1"), {
          method: "PATCH",
          headers: { ...serviceHeaders, Prefer: "return=representation" },
          body: JSON.stringify({
            strike_threshold: strikeThreshold,
            account_restriction_threshold: accountThreshold,
            release_hold_on_upheld: body.releaseHoldOnUpheld !== false,
            restrict_uploads_at_threshold: body.restrictUploadsAtThreshold !== false,
            restrict_publish_at_threshold: body.restrictPublishAtThreshold !== false,
            notes: sanitizeClientText(
              body.notes ||
                "Operational defaults. Lawyer review before treating thresholds as final policy.",
              2000,
            ),
            updated_at: new Date().toISOString(),
            updated_by: identity.user.id,
          }),
        });
        if (!response.ok) {
          return NextResponse.json({ error: "Could not update policy settings." }, { status: 400 });
        }
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    if (message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    console.error("admin copyright", err);
    return NextResponse.json({ error: "Could not process copyright admin action." }, { status: 500 });
  }
}
