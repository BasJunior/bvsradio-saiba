import { NextResponse } from "next/server";
import { creatorIdentity } from "@/lib/creator-server";
import { r2Configured, signedR2UploadUrl } from "@/lib/r2-storage";

export const runtime = "nodejs";
const ext = (name: string) =>
  name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "bin";

async function prepare(request: Request) {
  const identity = await creatorIdentity(request);
  if (!identity?.user?.id)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!r2Configured())
    return NextResponse.json(
      { error: "Upload service unavailable." },
      { status: 503 },
    );
  const body = (await request.json().catch(() => ({}))) as {
    files?: Array<{
      kind?: string;
      name?: string;
      type?: string;
      size?: number;
    }>;
  };
  const files = Array.isArray(body.files) ? body.files.slice(0, 3) : [];
  if (!files.length || (body.files?.length || 0) > 3 || new Set(files.map(file => file.kind)).size !== files.length) return NextResponse.json({ error: "Choose one to three files, with one file per upload field." }, { status: 400 });
  const slots = [];
  for (const file of files) {
    const kind = String(file.kind || "");
    const name = String(file.name || "");
    const size = Number(file.size || 0);
    if (
      !["asset", "artwork", "preview", "delivery", "storefront_avatar", "storefront_banner"].includes(kind) ||
      !name ||
      !Number.isFinite(size) || size <= 0 ||
      size > 250 * 1024 * 1024
    )
      return NextResponse.json(
        { error: "Invalid file. Marketplace files must be 250 MB or smaller." },
        { status: 400 },
      );
    const extension = ext(name);
    if (
      ["artwork", "storefront_avatar", "storefront_banner"].includes(kind) &&
      !["jpg", "jpeg", "png", "webp"].includes(extension)
    )
      return NextResponse.json(
        { error: "Artwork must be JPG, PNG or WebP." },
        { status: 400 },
      );
    if (["artwork", "storefront_avatar", "storefront_banner"].includes(kind) && size > 10 * 1024 * 1024) return NextResponse.json({ error: "Images must be 10 MB or smaller." }, { status: 400 });
    const path = `marketplace/${identity.user.id}/${Date.now()}-${kind}-${crypto.randomUUID().slice(0, 6)}.${extension}`;
    const contentType = ["artwork", "storefront_avatar", "storefront_banner"].includes(kind) ? ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" }[extension] || "application/octet-stream") : String(file.type || "") || "application/octet-stream";
    slots.push({
      kind,
      path,
      contentType,
      signedUrl: await signedR2UploadUrl(path, contentType),
    });
  }
  return NextResponse.json({ slots });
}

export async function POST(request: Request) {
  try { return await prepare(request); } catch { return NextResponse.json({ error: "Your upload could not start. Please try again." }, { status: 503 }); }
}
