import { NextResponse } from "next/server";
import {
  customerSafeComplaintError,
  parseUrlList,
  sanitizeClientText,
  validateComplaintInput,
} from "@/lib/rights-compliance";
import {
  createCopyrightComplaint,
  rightsComplianceConfigured,
} from "@/lib/rights-compliance-server";

export async function GET() {
  return NextResponse.json({
    policyPath: "/copyright",
    fields: [
      "claimantName",
      "claimantEmail",
      "workTitle",
      "allegedlyInfringingUrls",
      "goodFaithDeclaration",
      "accuracyDeclaration",
      "authorityDeclaration",
      "signatureName",
      "statement",
    ],
    note: "Public copyright complaint intake. Staff review required before hold or strike.",
  });
}

export async function POST(req: Request) {
  try {
    if (!rightsComplianceConfigured()) {
      return NextResponse.json(
        { error: customerSafeComplaintError("not configured") },
        { status: 503 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const claimantName = sanitizeClientText(body.claimantName, 160);
    const claimantEmail = sanitizeClientText(body.claimantEmail, 200).toLowerCase();
    const workTitle = sanitizeClientText(body.workTitle, 240);
    const statement = sanitizeClientText(body.statement, 8000);
    const signatureName = sanitizeClientText(body.signatureName, 160);
    const allegedlyInfringingUrls = parseUrlList(body.allegedlyInfringingUrls, 20);
    const originalWorkUrls = parseUrlList(body.originalWorkUrls, 20);

    const validation = validateComplaintInput({
      claimantName,
      claimantEmail,
      workTitle,
      statement,
      allegedlyInfringingUrls,
      goodFaithDeclaration: body.goodFaithDeclaration === true,
      accuracyDeclaration: body.accuracyDeclaration === true,
      authorityDeclaration: body.authorityDeclaration === true,
      signatureName,
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const releaseId =
      typeof body.releaseId === "string" && /^[0-9a-f-]{36}$/i.test(body.releaseId)
        ? body.releaseId
        : null;
    const trackId =
      typeof body.trackId === "string" && /^[0-9a-f-]{36}$/i.test(body.trackId)
        ? body.trackId
        : null;

    const result = await createCopyrightComplaint({
      claimantName,
      claimantEmail,
      claimantOrganization: sanitizeClientText(body.claimantOrganization, 200) || undefined,
      claimantAddress: sanitizeClientText(body.claimantAddress, 500) || undefined,
      contactPhone: sanitizeClientText(body.contactPhone, 40) || undefined,
      workTitle,
      workDescription: sanitizeClientText(body.workDescription, 4000),
      originalWorkUrls,
      allegedlyInfringingUrls,
      releaseId,
      trackId,
      goodFaithDeclaration: true,
      accuracyDeclaration: true,
      authorityDeclaration: true,
      signatureName,
      statement,
      request: req,
    });

    if (!result.ok) {
      console.error("copyright complaint store failed", result.error);
      return NextResponse.json({ error: customerSafeComplaintError(result.error) }, { status: 503 });
    }

    // Customer-safe success: docket only, no internal IDs required beyond docket.
    return NextResponse.json({
      ok: true,
      docketNumber: result.docketNumber,
      message:
        "Complaint received. Keep your docket number for reference. BVS staff will review. We do not auto-delete accounts or catalogues from this form.",
    });
  } catch (err) {
    console.error("copyright complaint", err);
    return NextResponse.json({ error: customerSafeComplaintError() }, { status: 500 });
  }
}
