import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.NEXT_PUBLIC_BVS_BUILD_ID ||
    "dev";
  return NextResponse.json(
    {
      sha: String(sha).slice(0, 16),
      env: process.env.BVS_ENV_LANE || process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_BVS_ENV_LANE || "unknown",
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
