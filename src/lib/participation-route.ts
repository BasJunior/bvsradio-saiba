import { NextResponse } from "next/server";
import { ParticipationUnavailableError } from "@/lib/participation-server";

export function participationUnavailableResponse() {
  return NextResponse.json({ error: "Participation is unavailable." }, { status: 503 });
}

export async function withParticipationErrors(run: () => Promise<Response>) {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ParticipationUnavailableError) return participationUnavailableResponse();
    throw error;
  }
}
