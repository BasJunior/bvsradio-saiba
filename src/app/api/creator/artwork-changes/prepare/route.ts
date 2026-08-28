import { NextResponse } from "next/server";
import { creatorIdentity } from "@/lib/creator-server";
import { r2Bucket, r2Configured, signedR2UploadUrl } from "@/lib/r2-storage";

export const runtime = "nodejs";

function extOf(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
}

export async function POST(request: Request) {
  try {
    const identity = await creatorIdentity(request);
    if (!identity?.user?.id || !identity.profile) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    if (identity.profile.role === "listener" && !identity.profile.is_producer) {
      return NextResponse.json({ error: "Creator access required." }, { status: 403 });
    }
    if (!r2Configured()) {
      return NextResponse.json({ error: "Upload service is unavailable." }, { status: 503 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      type?: string;
      size?: number;
    };
    const name = String(body.name || "");
    const size = Number(body.size || 0);
    const ext = extOf(name);
    if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
      return NextResponse.json({ error: "Cover art must be JPG, PNG, or WebP." }, { status: 400 });
    }
    if (!size || size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Cover art must be 8MB or smaller." }, { status: 400 });
    }

    const contentType =
      String(body.type || "") || `image/${ext === "jpg" ? "jpeg" : ext}`;
    const path = `artwork-changes/${identity.user.id}/${Date.now()}-artwork.${ext}`;
    return NextResponse.json({
      ok: true,
      provider: "r2",
      bucket: r2Bucket(),
      slot: {
        path,
        signedUrl: await signedR2UploadUrl(path, contentType),
        contentType,
      },
    });
  } catch (error) {
    console.error("artwork change prepare", error);
    return NextResponse.json({ error: "Could not prepare cover upload." }, { status: 500 });
  }
}
