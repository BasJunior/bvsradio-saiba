import { NextResponse } from "next/server";
import { authUserId } from "@/lib/storage-upload";
import { sanitizeClientText } from "@/lib/rights-compliance";
import { submitCounterNotice } from "@/lib/rights-compliance-server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function POST(req: Request) {
  try {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const user = await authUserId(SUPABASE_URL, SERVICE, token);
    if (!user?.id) return NextResponse.json({ error: "Session expired." }, { status: 401 });

    const body = (await req.json()) as Record<string, unknown>;
    const complaintId = String(body.complaintId || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(complaintId)) {
      return NextResponse.json({ error: "Valid complaintId is required." }, { status: 400 });
    }

    const contactEmail = sanitizeClientText(body.contactEmail, 200).toLowerCase();
    const statement = sanitizeClientText(body.statement, 8000);
    const signatureName = sanitizeClientText(body.signatureName, 160);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return NextResponse.json({ error: "Valid contact email is required." }, { status: 400 });
    }
    if (statement.length < 20) {
      return NextResponse.json({ error: "Counter-response must be at least 20 characters." }, { status: 400 });
    }
    if (signatureName.length < 2) {
      return NextResponse.json({ error: "Signature name is required." }, { status: 400 });
    }
    if (body.goodFaithDeclaration !== true) {
      return NextResponse.json({ error: "Good-faith declaration is required." }, { status: 400 });
    }

    const result = await submitCounterNotice({
      complaintId,
      artistUserId: user.id,
      contactEmail,
      statement,
      signatureName,
      goodFaithDeclaration: true,
      request: req,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      message: "Counter-response recorded. Staff will review. Content is not auto-restored.",
    });
  } catch (err) {
    console.error("counter-notice", err);
    return NextResponse.json({ error: "Could not submit counter-response." }, { status: 500 });
  }
}
