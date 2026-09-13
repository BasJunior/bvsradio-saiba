import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/app-api-auth";
import { participationEnabled, searchMentionProfiles, userBlockSet } from "@/lib/participation-server";

export async function GET(request: Request) {
  if (!participationEnabled()) return NextResponse.json({ profiles: [] });
  const user = await requireAppUser(request);
  if (!user) return NextResponse.json({ profiles: [] });
  const q = new URL(request.url).searchParams.get("q") || "";
  const [profiles, blocked] = await Promise.all([searchMentionProfiles(q), userBlockSet(user.id)]);
  return NextResponse.json({ profiles: profiles.filter((profile) => profile.id !== user.id && !blocked.has(profile.id)).slice(0, 8) }, { headers: { "Cache-Control": "private, no-store" } });
}
