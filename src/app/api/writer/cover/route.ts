import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { creatorHeaders, creatorIdentity, creatorUrl } from "@/lib/creator-server";
import { r2Bucket, r2Client, r2Configured } from "@/lib/r2-storage";

export const runtime = "nodejs";
const types: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const userId = identity.user.id;
  const isStaff = identity.profile?.role === "admin";
  if (!isStaff) {
    const r = await fetch(creatorUrl(`writer_applications?user_id=eq.${userId}&status=eq.approved&select=id&limit=1`), { headers: creatorHeaders, cache: "no-store" });
    if (!r.ok) return NextResponse.json({ error: "Writer service unavailable." }, { status: 503 });
    if (!((await r.json()) as unknown[]).length) return NextResponse.json({ error: "Approved writers only." }, { status: 403 });
  }
  if (!r2Configured()) return NextResponse.json({ error: "Cover upload service unavailable." }, { status: 503 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !types[file.type] || file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Choose a JPG, PNG or WebP image up to 8 MB." }, { status: 400 });
  }
  const path = `writer-covers/${userId}/${crypto.randomUUID()}.${types[file.type]}`;
  try {
    await r2Client().send(new PutObjectCommand({
      Bucket: r2Bucket(), Key: path, Body: new Uint8Array(await file.arrayBuffer()),
      ContentType: file.type, CacheControl: "private, max-age=3600",
    }));
    return NextResponse.json({ path }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Writer cover upload failed", error);
    return NextResponse.json({ error: "Could not upload this image." }, { status: 503 });
  }
}
