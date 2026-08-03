import { NextResponse } from "next/server";
import { authUserId } from "@/lib/storage-upload";
import {
  accountUploadAllowed,
  addClearanceItem,
  rightsComplianceConfigured,
} from "@/lib/rights-compliance-server";
import { MATERIAL_TYPES, sanitizeClientText, type MaterialType } from "@/lib/rights-compliance";
import { restGet } from "@/lib/releases-server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function GET(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const user = await authUserId(SUPABASE_URL, SERVICE, token);
  if (!user?.id) return NextResponse.json({ error: "Session expired." }, { status: 401 });

  const releaseId = new URL(req.url).searchParams.get("releaseId") || "";
  if (!/^[0-9a-f-]{36}$/i.test(releaseId)) {
    return NextResponse.json({ error: "releaseId required." }, { status: 400 });
  }
  const owned = await restGet<Array<{ id: string }>>(
    `releases?id=eq.${encodeURIComponent(releaseId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`,
  );
  if (!owned?.[0]) return NextResponse.json({ error: "Release not found." }, { status: 404 });

  const items = await restGet<unknown[]>(
    `release_clearance_items?release_id=eq.${encodeURIComponent(releaseId)}&select=*&order=created_at.desc`,
  );
  return NextResponse.json({ items: items || [] });
}

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
        { error: "This account cannot add clearance evidence while restricted." },
        { status: 403 },
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const releaseId = String(body.releaseId || "").trim();
    const materialType = String(body.materialType || "") as MaterialType;
    if (!/^[0-9a-f-]{36}$/i.test(releaseId)) {
      return NextResponse.json({ error: "Valid releaseId is required." }, { status: 400 });
    }
    if (!MATERIAL_TYPES.includes(materialType)) {
      return NextResponse.json({ error: "Invalid material type." }, { status: 400 });
    }

    const title = sanitizeClientText(body.title, 200);
    if (title.length < 2) {
      return NextResponse.json({ error: "Clearance item title is required." }, { status: 400 });
    }

    const licenceOrPermissionRef = sanitizeClientText(body.licenceOrPermissionRef, 500) || undefined;
    const documentStoragePath = body.documentStoragePath
      ? sanitizeClientText(body.documentStoragePath, 500)
      : null;

    if (!licenceOrPermissionRef && !documentStoragePath) {
      return NextResponse.json(
        { error: "Attach a document storage path or a licence/permission reference." },
        { status: 400 },
      );
    }

    const riskLevel = ["low", "medium", "high", "critical"].includes(String(body.riskLevel))
      ? String(body.riskLevel)
      : "medium";

    const result = await addClearanceItem({
      releaseId,
      userId: user.id,
      materialType,
      riskLevel,
      title,
      description: sanitizeClientText(body.description, 4000),
      rightsHolderName: sanitizeClientText(body.rightsHolderName, 200) || undefined,
      licenceOrPermissionRef,
      sourceUrl: sanitizeClientText(body.sourceUrl, 1000) || undefined,
      documentStoragePath,
      documentFilename: body.documentFilename
        ? sanitizeClientText(body.documentFilename, 240)
        : null,
      documentContentType: body.documentContentType
        ? sanitizeClientText(body.documentContentType, 120)
        : null,
      documentByteSize:
        typeof body.documentByteSize === "number" && body.documentByteSize >= 0
          ? Math.min(body.documentByteSize, 50_000_000)
          : null,
      documentSha256: body.documentSha256
        ? sanitizeClientText(body.documentSha256, 128)
        : null,
      releaseTrackId: body.releaseTrackId ? String(body.releaseTrackId) : null,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, id: result.id });
  } catch (err) {
    console.error("clearance", err);
    return NextResponse.json({ error: "Could not save clearance evidence." }, { status: 500 });
  }
}
