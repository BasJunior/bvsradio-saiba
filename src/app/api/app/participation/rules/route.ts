import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/app-api-auth";
import {
  hasParticipationRulesAgreement,
  participationEnabled,
  participationInsert,
  participationReady,
} from "@/lib/participation-server";

export const PARTICIPATION_RULES_VERSION = "participation-v1";

export async function GET(request: Request) {
  if (!participationEnabled()) return NextResponse.json({ enabled: false, agreed: false, version: PARTICIPATION_RULES_VERSION });
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ enabled: true, agreed: false, version: PARTICIPATION_RULES_VERSION });
  return NextResponse.json({
    enabled: true,
    agreed: await hasParticipationRulesAgreement(user.id, PARTICIPATION_RULES_VERSION),
    version: PARTICIPATION_RULES_VERSION,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!participationEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!participationReady()) return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { version?: string; agree?: boolean };
  if (body.agree !== true || body.version !== PARTICIPATION_RULES_VERSION) {
    return NextResponse.json({ error: "Confirm the current BVS community rules to continue." }, { status: 400 });
  }
  const rows = await participationInsert<{ user_id: string }>(
    "participation_rule_agreements?on_conflict=user_id,rules_version",
    { user_id: user.id, rules_version: PARTICIPATION_RULES_VERSION, agreed_at: new Date().toISOString() },
    "resolution=merge-duplicates,return=representation",
  );
  if (!rows[0]) return NextResponse.json({ error: "Could not save your agreement." }, { status: 503 });
  return NextResponse.json({ ok: true, agreed: true, version: PARTICIPATION_RULES_VERSION });
}
