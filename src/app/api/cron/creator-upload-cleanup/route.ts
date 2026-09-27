import { NextResponse } from "next/server";
import { runCreatorUploadCleanup } from "@/lib/creator-upload-cleanup-server";
import { r2Configured } from "@/lib/r2-storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CANONICAL_BVS_PROJECT_ID = "prj_jdey5oej8CGAROfdPK2f5frnq2YK";

function isCanonicalWorker() {
  return process.env.VERCEL_ENV === "production"
    && process.env.VERCEL_PROJECT_ID === CANONICAL_BVS_PROJECT_ID;
}

function authorized(request: Request) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  // This repository deploys into more than one Vercel project. Only the canonical
  // production project may delete expired upload media.
  if (!isCanonicalWorker()) {
    return NextResponse.json(
      { ok: true, skipped: "non_canonical_project" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!r2Configured()) {
    return NextResponse.json({ error: "Media storage is unavailable." }, { status: 503 });
  }

  try {
    const cleanup = await runCreatorUploadCleanup(50, new Date());
    return NextResponse.json(
      {
        ok: cleanup.errors === 0,
        cleanup,
        finishedAt: new Date().toISOString(),
      },
      {
        status: cleanup.errors > 0 ? 207 : 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("creator upload cleanup cron", error);
    return NextResponse.json(
      { error: "Creator upload cleanup failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
