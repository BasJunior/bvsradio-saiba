import "server-only";
import {
  ACTIVE_RIGHTS_AGREEMENT_VERSION,
  DEFAULT_ACCOUNT_RESTRICTION_THRESHOLD,
  DEFAULT_STRIKE_THRESHOLD,
  allAttestationFlagsTrue,
  buildAttestationSnapshot,
  generateDocketNumber,
  shouldRestrictAccount,
  type AttestationFlags,
  type ComplaintStatus,
  type MaterialFlags,
  type MaterialType,
} from "@/lib/rights-compliance";
import { restGet, restPatch, restPost } from "@/lib/releases-server";
import { audit } from "@/lib/editorial-server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function serviceHeaders(prefer = "return=representation") {
  return {
    apikey: service,
    Authorization: `Bearer ${service}`,
    "Content-Type": "application/json",
    Prefer: prefer,
  };
}

async function restUpsert(path: string, body: unknown) {
  if (!url || !service) return { ok: false, status: 503, text: "not configured" };
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: "POST",
    headers: serviceHeaders("resolution=merge-duplicates,return=representation"),
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

async function safeAudit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown> = {},
) {
  if (actorId && /^[0-9a-f-]{36}$/i.test(actorId)) {
    await audit(actorId, action, entityType, entityId, details);
    return;
  }
  // System/public events: write editorial_audit_log with null actor when possible
  if (!url || !service) return;
  await fetch(`${url}/rest/v1/editorial_audit_log`, {
    method: "POST",
    headers: serviceHeaders("return=minimal"),
    body: JSON.stringify({
      actor_id: null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    }),
  }).catch(() => null);
}

export function clientIp(request: Request): string | null {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim().slice(0, 80) || null;
  const real = request.headers.get("x-real-ip");
  return real ? real.trim().slice(0, 80) : null;
}

export function clientUserAgent(request: Request): string | null {
  const ua = request.headers.get("user-agent");
  return ua ? ua.slice(0, 500) : null;
}

export async function getActiveAgreementVersion(): Promise<string> {
  const rows = await restGet<Array<{ version: string }>>(
    "rights_agreement_versions?active=eq.true&select=version&order=effective_at.desc&limit=1",
  );
  return rows?.[0]?.version || ACTIVE_RIGHTS_AGREEMENT_VERSION;
}

export async function recordReleaseAttestation(input: {
  releaseId: string;
  userId: string;
  flags: AttestationFlags;
  materialFlags: MaterialFlags;
  request: Request;
}): Promise<{ ok: true; attestationId: string; agreementVersion: string } | { ok: false; error: string }> {
  if (!allAttestationFlagsTrue(input.flags)) {
    return { ok: false, error: "All rights declarations must be confirmed." };
  }

  const releases = await restGet<Array<Record<string, unknown>>>(
    `releases?id=eq.${encodeURIComponent(input.releaseId)}&user_id=eq.${encodeURIComponent(input.userId)}&select=*&limit=1`,
  );
  const release = releases?.[0];
  if (!release) return { ok: false, error: "Release not found for this account." };

  const restrictions = await restGet<Array<{ upload_restricted?: boolean; publish_restricted?: boolean }>>(
    `account_rights_restrictions?user_id=eq.${encodeURIComponent(input.userId)}&select=upload_restricted,publish_restricted&limit=1`,
  );
  const profiles = await restGet<Array<{ rights_upload_restricted?: boolean }>>(
    `profiles?id=eq.${encodeURIComponent(input.userId)}&select=rights_upload_restricted&limit=1`,
  );
  if (restrictions?.[0]?.upload_restricted || profiles?.[0]?.rights_upload_restricted) {
    return { ok: false, error: "This account cannot submit new rights attestations while a rights restriction is active." };
  }

  const agreementVersion = await getActiveAgreementVersion();
  const members = await restGet<Array<{ id: string; track_id?: string | null }>>(
    `release_tracks?release_id=eq.${encodeURIComponent(input.releaseId)}&select=id,track_id&order=position.asc`,
  );
  const contributors = await restGet<unknown[]>(
    `release_contributors?release_id=eq.${encodeURIComponent(input.releaseId)}&select=*`,
  );
  const releaseTrackIds = (members || []).map((m) => m.id);
  const trackIds = (members || []).map((m) => m.track_id).filter(Boolean) as string[];

  const snapshot = buildAttestationSnapshot({
    releaseId: input.releaseId,
    userId: input.userId,
    agreementVersion,
    release,
    contributors: contributors || [],
    trackIds,
    releaseTrackIds,
    materialFlags: input.materialFlags,
    flags: input.flags,
  });

  const inserted = await restPost<Array<{ id: string }>>("release_rights_attestations", {
    release_id: input.releaseId,
    user_id: input.userId,
    agreement_version: agreementVersion,
    master_control: input.flags.masterControl,
    composition_control: input.flags.compositionControl,
    featured_contributors_cleared: input.flags.featuredContributorsCleared,
    samples_beats_cleared: input.flags.samplesBeatsCleared,
    grant_host: input.flags.grantHost,
    grant_stream: input.flags.grantStream,
    grant_catalogue: input.flags.grantCatalogue,
    grant_promote: input.flags.grantPromote,
    accuracy_confirmed: input.flags.accuracyConfirmed,
    track_ids: trackIds,
    release_track_ids: releaseTrackIds,
    snapshot,
    ip_address: clientIp(input.request),
    user_agent: clientUserAgent(input.request),
  });

  if (!inserted.ok || !inserted.data?.[0]?.id) {
    const missing = inserted.text.includes("does not exist") || inserted.status === 404;
    return {
      ok: false,
      error: missing
        ? "Rights compliance tables are not applied yet. Run supabase-apple-rights-compliance.sql."
        : "Could not store rights attestation.",
    };
  }

  const attestationId = inserted.data[0].id;
  const now = new Date().toISOString();
  await restPatch(`releases?id=eq.${encodeURIComponent(input.releaseId)}`, {
    rights_confirmed: true,
    rights_attestation_id: attestationId,
    rights_agreement_version: agreementVersion,
    rights_attested_at: now,
    contains_cover: input.materialFlags.containsCover,
    contains_remix: input.materialFlags.containsRemix,
    contains_samples: input.materialFlags.containsSamples,
    contains_leased_beats: input.materialFlags.containsLeasedBeats,
    contains_third_party: input.materialFlags.containsThirdParty,
    updated_at: now,
  });

  await restPost("rpc/refresh_release_preflight", { p_release_id: input.releaseId });
  await safeAudit(input.userId, "release_rights_attested", "release", input.releaseId, {
    agreementVersion,
    attestationId,
  });

  return { ok: true, attestationId, agreementVersion };
}

export async function addClearanceItem(input: {
  releaseId: string;
  userId: string;
  materialType: MaterialType;
  riskLevel: string;
  title: string;
  description: string;
  rightsHolderName?: string;
  licenceOrPermissionRef?: string;
  sourceUrl?: string;
  documentStoragePath?: string | null;
  documentFilename?: string | null;
  documentContentType?: string | null;
  documentByteSize?: number | null;
  documentSha256?: string | null;
  releaseTrackId?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const releases = await restGet<Array<{ id: string }>>(
    `releases?id=eq.${encodeURIComponent(input.releaseId)}&user_id=eq.${encodeURIComponent(input.userId)}&select=id&limit=1`,
  );
  if (!releases?.[0]) return { ok: false, error: "Release not found for this account." };

  if (input.documentStoragePath) {
    const path = input.documentStoragePath;
    if (!path.startsWith(`releases/${input.userId}/`) && !path.startsWith(`clearance/${input.userId}/`)) {
      return { ok: false, error: "Invalid document storage path." };
    }
  }

  const inserted = await restPost<Array<{ id: string }>>("release_clearance_items", {
    release_id: input.releaseId,
    release_track_id: input.releaseTrackId || null,
    material_type: input.materialType,
    risk_level: input.riskLevel,
    title: input.title,
    description: input.description,
    rights_holder_name: input.rightsHolderName || null,
    licence_or_permission_ref: input.licenceOrPermissionRef || null,
    source_url: input.sourceUrl || null,
    document_storage_path: input.documentStoragePath || null,
    document_filename: input.documentFilename || null,
    document_content_type: input.documentContentType || null,
    document_byte_size: input.documentByteSize ?? null,
    document_sha256: input.documentSha256 || null,
    required: true,
    status: "submitted",
    created_by: input.userId,
    updated_at: new Date().toISOString(),
  });

  if (!inserted.ok || !inserted.data?.[0]?.id) {
    return {
      ok: false,
      error:
        inserted.status === 404
          ? "Clearance tables are not applied yet."
          : "Could not save clearance evidence.",
    };
  }

  await restPost("rpc/refresh_release_preflight", { p_release_id: input.releaseId });
  await safeAudit(input.userId, "clearance_item_added", "release", input.releaseId, {
    materialType: input.materialType,
    itemId: inserted.data[0].id,
  });
  return { ok: true, id: inserted.data[0].id };
}

export async function createCopyrightComplaint(input: {
  claimantName: string;
  claimantEmail: string;
  claimantOrganization?: string;
  claimantAddress?: string;
  contactPhone?: string;
  workTitle: string;
  workDescription?: string;
  originalWorkUrls: string[];
  allegedlyInfringingUrls: string[];
  releaseId?: string | null;
  trackId?: string | null;
  goodFaithDeclaration: boolean;
  accuracyDeclaration: boolean;
  authorityDeclaration: boolean;
  signatureName: string;
  statement: string;
  request: Request;
}): Promise<{ ok: true; docketNumber: string; id: string } | { ok: false; error: string }> {
  let targetUserId: string | null = null;
  if (input.releaseId) {
    const rel = await restGet<Array<{ user_id: string }>>(
      `releases?id=eq.${encodeURIComponent(input.releaseId)}&select=user_id&limit=1`,
    );
    targetUserId = rel?.[0]?.user_id || null;
  } else if (input.trackId) {
    const tr = await restGet<Array<{ user_id: string }>>(
      `tracks?id=eq.${encodeURIComponent(input.trackId)}&select=user_id&limit=1`,
    );
    targetUserId = tr?.[0]?.user_id || null;
  }

  let docketNumber = generateDocketNumber();
  for (let attempt = 0; attempt < 3; attempt++) {
    const inserted = await restPost<Array<{ id: string; docket_number: string }>>("copyright_complaints", {
      docket_number: docketNumber,
      status: "received",
      claimant_name: input.claimantName,
      claimant_email: input.claimantEmail,
      claimant_organization: input.claimantOrganization || null,
      claimant_address: input.claimantAddress || null,
      contact_phone: input.contactPhone || null,
      work_title: input.workTitle,
      work_description: input.workDescription || "",
      original_work_urls: input.originalWorkUrls,
      allegedly_infringing_urls: input.allegedlyInfringingUrls,
      release_id: input.releaseId || null,
      track_id: input.trackId || null,
      target_user_id: targetUserId,
      good_faith_declaration: true,
      accuracy_declaration: true,
      authority_declaration: true,
      signature_name: input.signatureName,
      statement: input.statement,
      ip_address: clientIp(input.request),
      user_agent: clientUserAgent(input.request),
    });

    if (inserted.ok && inserted.data?.[0]) {
      const row = inserted.data[0];
      await restPost("copyright_complaint_events", {
        complaint_id: row.id,
        actor_id: null,
        actor_kind: "public",
        event_type: "complaint_received",
        details: {
          docketNumber: row.docket_number,
          releaseId: input.releaseId || null,
          trackId: input.trackId || null,
        },
      });

      if (targetUserId) {
        await restPost("artist_rights_notices", {
          user_id: targetUserId,
          complaint_id: row.id,
          notice_type: "complaint_received",
          title: "Copyright complaint received",
          body: `A copyright complaint was filed against material associated with your account (docket ${row.docket_number}). BVS staff will review. You may submit a counter-response if notified. Content is not auto-deleted.`,
        });
      }

      await safeAudit(null, "copyright_complaint_received", "copyright_complaint", row.id, {
        docketNumber: row.docket_number,
      });

      return { ok: true, docketNumber: row.docket_number, id: row.id };
    }

    if (inserted.status === 409 || inserted.text.includes("duplicate") || inserted.text.includes("unique")) {
      docketNumber = generateDocketNumber();
      continue;
    }

    if (inserted.status === 404 || inserted.text.includes("does not exist")) {
      return {
        ok: false,
        error: "Copyright complaint system is not ready in the database.",
      };
    }
    return { ok: false, error: "Could not store complaint." };
  }
  return { ok: false, error: "Could not allocate a docket number." };
}

export async function unpublishForHold(input: {
  releaseId?: string | null;
  trackId?: string | null;
  reason: string;
  staffId: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const reason = input.reason.slice(0, 500);

  if (input.releaseId) {
    await restPatch(`releases?id=eq.${encodeURIComponent(input.releaseId)}`, {
      is_public: false,
      in_rotation: false,
      content_hold: true,
      content_hold_reason: reason,
      content_hold_at: now,
      content_hold_by: input.staffId,
      updated_at: now,
    });
    const members = await restGet<Array<{ track_id?: string | null }>>(
      `release_tracks?release_id=eq.${encodeURIComponent(input.releaseId)}&select=track_id`,
    );
    for (const m of members || []) {
      if (!m.track_id) continue;
      await restPatch(`tracks?id=eq.${encodeURIComponent(m.track_id)}`, {
        is_public: false,
        in_rotation: false,
        content_hold: true,
        content_hold_reason: reason,
        content_hold_at: now,
      });
    }
  }

  if (input.trackId) {
    await restPatch(`tracks?id=eq.${encodeURIComponent(input.trackId)}`, {
      is_public: false,
      in_rotation: false,
      content_hold: true,
      content_hold_reason: reason,
      content_hold_at: now,
    });
  }
}

export async function getPolicySettings(): Promise<{
  strike_threshold: number;
  account_restriction_threshold: number;
  release_hold_on_upheld: boolean;
  restrict_uploads_at_threshold: boolean;
  restrict_publish_at_threshold: boolean;
}> {
  const rows = await restGet<
    Array<{
      strike_threshold?: number;
      account_restriction_threshold?: number;
      release_hold_on_upheld?: boolean;
      restrict_uploads_at_threshold?: boolean;
      restrict_publish_at_threshold?: boolean;
    }>
  >("copyright_policy_settings?id=eq.1&select=*&limit=1");
  const s = rows?.[0];
  return {
    strike_threshold: s?.strike_threshold ?? DEFAULT_STRIKE_THRESHOLD,
    account_restriction_threshold:
      s?.account_restriction_threshold ?? DEFAULT_ACCOUNT_RESTRICTION_THRESHOLD,
    release_hold_on_upheld: s?.release_hold_on_upheld !== false,
    restrict_uploads_at_threshold: s?.restrict_uploads_at_threshold !== false,
    restrict_publish_at_threshold: s?.restrict_publish_at_threshold !== false,
  };
}

export async function applyStrikeAndMaybeRestrict(input: {
  userId: string;
  complaintId: string;
  releaseId?: string | null;
  trackId?: string | null;
  reason: string;
  staffId: string;
}): Promise<{ activeStrikes: number; restricted: boolean }> {
  await restPost("copyright_strikes", {
    user_id: input.userId,
    complaint_id: input.complaintId,
    release_id: input.releaseId || null,
    track_id: input.trackId || null,
    reason: input.reason.slice(0, 1000),
    active: true,
    created_by: input.staffId,
  });

  const countRes = await restPost<number>("rpc/refresh_profile_copyright_strikes", {
    p_user_id: input.userId,
  });
  const strikes = await restGet<Array<{ id: string }>>(
    `copyright_strikes?user_id=eq.${encodeURIComponent(input.userId)}&active=eq.true&select=id`,
  );
  const activeStrikes =
    typeof countRes.data === "number" ? countRes.data : (strikes || []).length;

  const policy = await getPolicySettings();
  const restricted = shouldRestrictAccount(
    activeStrikes,
    policy.account_restriction_threshold,
  );

  if (restricted) {
    const now = new Date().toISOString();
    await restUpsert("account_rights_restrictions?on_conflict=user_id", {
      user_id: input.userId,
      upload_restricted: policy.restrict_uploads_at_threshold,
      publish_restricted: policy.restrict_publish_at_threshold,
      reason: `Active copyright strikes reached threshold (${activeStrikes}/${policy.account_restriction_threshold}). No content or account auto-deletion.`,
      strike_count_snapshot: activeStrikes,
      set_by: input.staffId,
      set_at: now,
      updated_at: now,
    });
    await restPatch(`profiles?id=eq.${encodeURIComponent(input.userId)}`, {
      rights_upload_restricted: policy.restrict_uploads_at_threshold,
      rights_publish_restricted: policy.restrict_publish_at_threshold,
      rights_restriction_reason: `Repeat-infringer threshold (${activeStrikes} active strikes).`,
      rights_restriction_at: now,
      rights_restriction_by: input.staffId,
      active_copyright_strikes: activeStrikes,
    });
    await restPost("artist_rights_notices", {
      user_id: input.userId,
      complaint_id: input.complaintId,
      notice_type: "account_restricted",
      title: "Account rights restriction applied",
      body: `Your account has ${activeStrikes} active copyright strike(s). Upload and/or publish capabilities may be restricted. Content is not automatically deleted. Contact BVS editorial if you believe this is an error.`,
    });
  } else {
    await restPatch(`profiles?id=eq.${encodeURIComponent(input.userId)}`, {
      active_copyright_strikes: activeStrikes,
    });
    await restPost("artist_rights_notices", {
      user_id: input.userId,
      complaint_id: input.complaintId,
      notice_type: "strike_issued",
      title: "Copyright strike recorded",
      body: `A copyright strike was recorded against your account (${activeStrikes} active). Content is not automatically deleted. Repeated upheld complaints may restrict uploads/publishing.`,
    });
  }

  await safeAudit(input.staffId, "copyright_strike_issued", "profile", input.userId, {
    complaintId: input.complaintId,
    activeStrikes,
    restricted,
  });

  return { activeStrikes, restricted };
}

export async function staffUpdateComplaint(input: {
  complaintId: string;
  staffId: string;
  status: ComplaintStatus;
  staffNotes?: string;
  resolutionSummary?: string;
  applyHold?: boolean;
  issueStrike?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const rows = await restGet<
    Array<{
      id: string;
      status: ComplaintStatus;
      release_id?: string | null;
      track_id?: string | null;
      target_user_id?: string | null;
      docket_number: string;
    }>
  >(`copyright_complaints?id=eq.${encodeURIComponent(input.complaintId)}&select=*&limit=1`);
  const complaint = rows?.[0];
  if (!complaint) return { ok: false, error: "Complaint not found." };

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: now,
    assigned_to: input.staffId,
  };
  if (input.staffNotes !== undefined) patch.staff_notes = input.staffNotes.slice(0, 4000);
  if (input.resolutionSummary !== undefined) {
    patch.resolution_summary = input.resolutionSummary.slice(0, 4000);
  }
  if (["resolved_upheld", "resolved_rejected", "withdrawn"].includes(input.status)) {
    patch.resolved_at = now;
    patch.resolved_by = input.staffId;
  }

  const shouldHold =
    input.applyHold === true ||
    input.status === "hold_applied" ||
    (input.status === "resolved_upheld" && input.applyHold !== false);

  if (shouldHold) {
    patch.hold_applied_at = now;
    patch.hold_applied_by = input.staffId;
    if (input.status === "resolved_upheld" && input.applyHold !== false) {
      // keep status as resolved_upheld; hold is side-effect
    } else if (input.applyHold) {
      patch.status = "hold_applied";
    }
    await unpublishForHold({
      releaseId: complaint.release_id,
      trackId: complaint.track_id,
      reason: `Copyright docket ${complaint.docket_number}`,
      staffId: input.staffId,
    });
  }

  const updated = await restPatch(
    `copyright_complaints?id=eq.${encodeURIComponent(input.complaintId)}`,
    patch,
  );
  if (!updated.ok) return { ok: false, error: "Could not update complaint." };

  await restPost("copyright_complaint_events", {
    complaint_id: input.complaintId,
    actor_id: input.staffId,
    actor_kind: "staff",
    event_type: `status_${String(patch.status)}`,
    details: {
      previous: complaint.status,
      next: patch.status,
      hold: shouldHold,
      notesPreview: input.staffNotes?.slice(0, 200),
    },
  });

  if (complaint.target_user_id) {
    await restPost("artist_rights_notices", {
      user_id: complaint.target_user_id,
      complaint_id: input.complaintId,
      notice_type: `complaint_${patch.status}`,
      title: `Copyright docket ${complaint.docket_number} updated`,
      body: `Staff updated your related copyright docket to “${String(patch.status).replaceAll("_", " ")}”. Content is never auto-deleted by this workflow; holds unpublish or block rotation only.`,
    });
  }

  if (
    (input.issueStrike || input.status === "resolved_upheld") &&
    complaint.target_user_id &&
    input.status === "resolved_upheld"
  ) {
    await applyStrikeAndMaybeRestrict({
      userId: complaint.target_user_id,
      complaintId: input.complaintId,
      releaseId: complaint.release_id,
      trackId: complaint.track_id,
      reason: `Upheld complaint ${complaint.docket_number}`,
      staffId: input.staffId,
    });
  }

  await safeAudit(input.staffId, "copyright_complaint_updated", "copyright_complaint", input.complaintId, {
    status: patch.status,
    hold: shouldHold,
  });

  return { ok: true };
}

export async function staffOverrideRestriction(input: {
  userId: string;
  staffId: string;
  reason: string;
  clearUpload?: boolean;
  clearPublish?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const reason = input.reason.trim();
  if (reason.length < 5) return { ok: false, error: "Override reason is required." };
  const now = new Date().toISOString();
  const existing = await restGet<Array<Record<string, unknown>>>(
    `account_rights_restrictions?user_id=eq.${encodeURIComponent(input.userId)}&select=*&limit=1`,
  );
  const row = existing?.[0];
  const uploadRestricted =
    input.clearUpload === false ? Boolean(row?.upload_restricted) : false;
  const publishRestricted =
    input.clearPublish === false ? Boolean(row?.publish_restricted) : false;

  await restUpsert("account_rights_restrictions?on_conflict=user_id", {
    user_id: input.userId,
    upload_restricted: uploadRestricted,
    publish_restricted: publishRestricted,
    reason: row?.reason || "Staff override",
    strike_count_snapshot: row?.strike_count_snapshot || 0,
    set_by: row?.set_by || input.staffId,
    set_at: row?.set_at || now,
    override_by: input.staffId,
    override_reason: reason.slice(0, 2000),
    override_at: now,
    updated_at: now,
  });

  await restPatch(`profiles?id=eq.${encodeURIComponent(input.userId)}`, {
    rights_upload_restricted: uploadRestricted,
    rights_publish_restricted: publishRestricted,
    rights_restriction_reason: uploadRestricted || publishRestricted ? reason.slice(0, 500) : null,
    rights_restriction_at: uploadRestricted || publishRestricted ? now : null,
    rights_restriction_by: input.staffId,
  });

  await restPost("artist_rights_notices", {
    user_id: input.userId,
    notice_type: "restriction_override",
    title: "Rights restriction updated by staff",
    body: "A BVS staff member updated rights restrictions on your account. Contact editorial if you need details.",
  });

  await safeAudit(input.staffId, "rights_restriction_override", "profile", input.userId, {
    reason: reason.slice(0, 300),
    uploadRestricted,
    publishRestricted,
  });

  return { ok: true };
}

export async function submitCounterNotice(input: {
  complaintId: string;
  artistUserId: string;
  contactEmail: string;
  statement: string;
  signatureName: string;
  goodFaithDeclaration: boolean;
  request: Request;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.goodFaithDeclaration) {
    return { ok: false, error: "Good-faith declaration is required." };
  }
  const rows = await restGet<
    Array<{ id: string; target_user_id?: string | null; status: string; docket_number: string }>
  >(`copyright_complaints?id=eq.${encodeURIComponent(input.complaintId)}&select=id,target_user_id,status,docket_number&limit=1`);
  const complaint = rows?.[0];
  if (!complaint) return { ok: false, error: "Complaint not found." };
  if (complaint.target_user_id && complaint.target_user_id !== input.artistUserId) {
    return { ok: false, error: "You can only respond to complaints linked to your account." };
  }
  // Allow counter-notice if artist owns linked release/track even when target not set — require target match when set.
  if (!complaint.target_user_id) {
    return { ok: false, error: "This docket is not linked to an artist account for counter-response." };
  }

  const inserted = await restPost("copyright_counter_notices", {
    complaint_id: input.complaintId,
    artist_user_id: input.artistUserId,
    contact_email: input.contactEmail,
    statement: input.statement,
    good_faith_declaration: true,
    signature_name: input.signatureName,
    ip_address: clientIp(input.request),
    user_agent: clientUserAgent(input.request),
  });
  if (!inserted.ok) return { ok: false, error: "Could not save counter-response." };

  await restPatch(`copyright_complaints?id=eq.${encodeURIComponent(input.complaintId)}`, {
    status: "counter_notice_received",
    updated_at: new Date().toISOString(),
  });
  await restPost("copyright_complaint_events", {
    complaint_id: input.complaintId,
    actor_id: input.artistUserId,
    actor_kind: "artist",
    event_type: "counter_notice_submitted",
    details: { docketNumber: complaint.docket_number },
  });
  await safeAudit(input.artistUserId, "copyright_counter_notice", "copyright_complaint", input.complaintId, {});
  return { ok: true };
}

/** Soft check used by release POST to block restricted accounts. */
export async function accountUploadAllowed(userId: string): Promise<boolean> {
  const [profiles, restrictions] = await Promise.all([
    restGet<Array<{ rights_upload_restricted?: boolean }>>(
      `profiles?id=eq.${encodeURIComponent(userId)}&select=rights_upload_restricted&limit=1`,
    ),
    restGet<Array<{ upload_restricted?: boolean }>>(
      `account_rights_restrictions?user_id=eq.${encodeURIComponent(userId)}&select=upload_restricted&limit=1`,
    ),
  ]);
  if (profiles?.[0]?.rights_upload_restricted) return false;
  if (restrictions?.[0]?.upload_restricted) return false;
  return true;
}

export function rightsComplianceConfigured() {
  return Boolean(url && service);
}
