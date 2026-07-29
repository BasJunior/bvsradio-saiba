import { NextResponse } from "next/server";
import {
  r2Configured,
  isPublicR2MediaKey,
  safeR2Key,
  signedR2DownloadUrl,
} from "@/lib/r2-storage";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  if (!r2Configured()) {
    return NextResponse.json({ error: "Media is temporarily unavailable." }, { status: 503 });
  }

  const { key: parts } = await context.params;
  const key = (parts || []).join("/");
  if (!safeR2Key(key)) {
    return NextResponse.json({ error: "Invalid media path." }, { status: 400 });
  }
  if (!(await isPublicR2MediaKey(key))) {
    return NextResponse.json({ error: "Media is not publicly available." }, { status: 403 });
  }

  try {
    const url = await signedR2DownloadUrl(key);
    return NextResponse.redirect(url, {
      status: 307,
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    console.error("R2 media redirect failed", { key, error });
    return NextResponse.json({ error: "Media is temporarily unavailable." }, { status: 503 });
  }
}

export async function HEAD(
  req: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  return GET(req, context);
}
