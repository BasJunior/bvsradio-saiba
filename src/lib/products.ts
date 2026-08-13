import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import {
  legacyFileForProductTitle,
  legacyMasterKey,
} from "@/lib/legacy-catalogue-media";
import { r2Configured, r2ObjectExists } from "@/lib/r2-storage";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export type ProductAsset =
  | { kind: "file"; path: string; filename: string }
  | { kind: "r2"; key: string; filename: string };

export function productsDir() {
  return (
    process.env.BVS_PRODUCTS_DIR ||
    path.join(process.cwd(), "..", "bvsradio-products")
  );
}

function normalizeProductId(itemId: string | number) {
  const raw = String(itemId || "").trim();
  // Live release packages use the release UUID; tolerate legacy prefixed cart ids.
  if (raw.startsWith("release-package-")) return raw.slice("release-package-".length);
  return raw;
}

/** Map cart line id / title slug → a locally staged product file. */
export async function resolveProductFile(
  itemId: string | number,
  title?: string,
): Promise<string | null> {
  const root = productsDir();
  const id = normalizeProductId(itemId);
  const candidates = [
    path.join(root, "beats", `${id}.zip`),
    path.join(root, "beats", `${id}.mp3`),
    path.join(root, "beats", `${id}.wav`),
    path.join(root, "albums", `${id}.zip`),
    path.join(root, "albums", `${id}.mp3`),
    path.join(root, "services", `${id}.zip`),
    path.join(root, "singles", `${id}.mp3`),
    path.join(root, "singles", `${id}.zip`),
    // legacy prefixed filenames if ops staged them that way
    path.join(root, "albums", `release-package-${id}.zip`),
  ];
  if (title) {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    candidates.push(
      path.join(root, "beats", `${slug}.zip`),
      path.join(root, "beats", `${slug}.mp3`),
      path.join(root, "albums", `${slug}.zip`),
      path.join(root, "albums", `${slug}.mp3`),
      path.join(root, "singles", `${slug}.mp3`),
      path.join(root, "singles", `${slug}.zip`),
    );
  }

  // Compatibility lookup for a local product staging directory. Public deployment
  // audio was evacuated to private R2 masters; resolveProductAsset handles those.
  const publicMusic = path.join(process.cwd(), "public", "music");
  if (title) {
    try {
      const files = await fs.readdir(publicMusic);
      const needle = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
      const match = files.find((file) => {
        const base = file.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/g, " ").trim();
        return base.includes(needle) || needle.includes(base);
      });
      if (match) candidates.push(path.join(publicMusic, match));
    } catch {
      /* no public music dir */
    }
  }

  for (const file of candidates) {
    try {
      await fs.access(file);
      return file;
    } catch {
      /* next */
    }
  }
  return null;
}

export async function resolveProductAsset(
  itemId: string | number,
  title?: string,
): Promise<ProductAsset | null> {
  const local = await resolveProductFile(itemId, title);
  if (local) {
    return { kind: "file", path: local, filename: path.basename(local) };
  }

  const normalizedId = normalizeProductId(itemId);
  if (/^[0-9a-f-]{36}$/i.test(normalizedId) && supabaseUrl && supabaseService && r2Configured()) {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/creator_marketplace_listings?id=eq.${encodeURIComponent(normalizedId)}&listing_type=eq.digital_product&status=eq.published&select=asset_path,title&limit=1`,
      { headers: { apikey: supabaseService, Authorization: `Bearer ${supabaseService}` }, cache: "no-store" },
    );
    if (response.ok) {
      const product = ((await response.json()) as Array<{ asset_path?: string; title?: string }>)[0];
      const key = product?.asset_path?.trim();
      if (key && key.startsWith("marketplace/") && await r2ObjectExists(key)) {
        const extension = path.extname(key).replace(/[^.a-z0-9]/gi, "").slice(0, 12);
        const base = (product.title || title || "bvs-creator-product").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "bvs-creator-product";
        return { kind: "r2", key, filename: `${base}${extension}` };
      }
    }
  }

  const filename = legacyFileForProductTitle(title);
  if (!filename || !r2Configured()) return null;
  const key = legacyMasterKey(filename);
  if (!(await r2ObjectExists(key))) return null;
  return { kind: "r2", key, filename };
}

const TOKEN_SECRET =
  process.env.BVS_DOWNLOAD_SECRET ||
  process.env.PAYNOW_INTEGRATION_KEY ||
  "bvs-dev-download-secret-change-me";

export function createDownloadToken(reference: string, itemId: string, ttlSec = 72 * 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${reference}:${itemId}:${exp}`;
  const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex").slice(0, 32);
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyDownloadToken(token: string): {
  reference: string;
  itemId: string;
} | null {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const [reference, itemId, expStr, sig] = raw.split(":");
    const exp = Number(expStr);
    if (!reference || !itemId || !sig || !Number.isFinite(exp)) return null;
    if (exp < Math.floor(Date.now() / 1000)) return null;
    const payload = `${reference}:${itemId}:${expStr}`;
    const expect = crypto
      .createHmac("sha256", TOKEN_SECRET)
      .update(payload)
      .digest("hex")
      .slice(0, 32);
    if (sig !== expect) return null;
    return { reference, itemId };
  } catch {
    return null;
  }
}
