import { NextResponse } from "next/server";
import { authUserId, serviceHeaders as storageHeaders } from "@/lib/storage-upload";
import {
  accountUploadAllowed,
  recordReleaseAttestation,
  rightsComplianceConfigured,
} from "@/lib/rights-compliance-server";
import { allAttestationFlagsTrue, type AttestationFlags, type MaterialFlags } from "@/lib/rights-compliance";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function POST(req: Request) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!rightsComplianceConfigured()) {
      return NextResponse.json({ error: "Rights compliance is not configured." }, { status: 503 });
    }

    const user = await authUserId(SUPABASE_URL, SERVICE, token);
    if (!user?.id) return NextResponse.json({ error: "Session expired." }, { status: 401 });

    if (!(await accountUploadAllowed(user.id))) {
      return NextResponse.json(
        { error: "This account cannot submit rights attestations while a rights restriction is active." },
        { status: 403 },
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const releaseId = String(body.releaseId || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(releaseId)) {
      return NextResponse.json({ error: "Valid releaseId is required." }, { status: 400 });
    }

    const flags: AttestationFlags = {
      masterControl: body.masterControl === true,
      compositionControl: body.compositionControl === true,
      featuredContributorsCleared: body.featuredContributorsCleared === true,
      samplesBeatsCleared: body.samplesBeatsCleared === true,
      grantHost: body.grantHost === true,
      grantStream: body.grantStream === true,
      grantCatalogue: body.grantCatalogue === true,
      grantPromote: body.grantPromote === true,
      accuracyConfirmed: body.accuracyConfirmed === true,
    };

    if (!allAttestationFlagsTrue(flags)) {
      return NextResponse.json(
        { error: "Confirm every rights declaration, including the BVS host/stream/catalogue/promote grant." },
        { status: 400 },
      );
    }

    const materialFlags: MaterialFlags = {
      containsCover: body.containsCover === true,
      containsRemix: body.containsRemix === true,
      containsSamples: body.containsSamples === true,
      containsLeasedBeats: body.containsLeasedBeats === true,
      containsThirdParty: body.containsThirdParty === true,
    };

    const result = await recordReleaseAttestation({
      releaseId,
      userId: user.id,
      flags,
      materialFlags,
      request: req,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      attestationId: result.attestationId,
      agreementVersion: result.agreementVersion,
    });
  } catch (err) {
    console.error("rights-attestation", err);
    return NextResponse.json({ error: "Could not record rights attestation." }, { status: 500 });
  }
}

/** GET active agreement version text for UI */
export async function GET() {
  void storageHeaders;
  return NextResponse.json({
    version: "BVS-RIGHTS-ATTEST-2026-08-01",
    summary:
      "Artist confirms master/composition control, featured contributors, samples/beats clearance, and grants BVS limited host/stream/catalogue/promote rights for this release.",
    lawyerReview:
      "Agreement text is an operational placeholder describing product behaviour and is marked for lawyer review.",
  });
}
