import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export function productsDir() {
  return (
    process.env.BVS_PRODUCTS_DIR ||
    path.join(process.cwd(), "..", "bvsradio-products")
  );
}

/** Map cart line id / title slug → relative path under products dir */
export async function resolveProductFile(
  itemId: string | number,
  title?: string,
): Promise<string | null> {
  const root = productsDir();
  const candidates = [
    path.join(root, "beats", `${itemId}.zip`),
    path.join(root, "beats", `${itemId}.mp3`),
    path.join(root, "beats", `${itemId}.wav`),
    path.join(root, "albums", `${itemId}.zip`),
    path.join(root, "albums", `${itemId}.mp3`),
    path.join(root, "services", `${itemId}.zip`),
  ];
  if (title) {
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    candidates.push(
      path.join(root, "beats", `${slug}.zip`),
      path.join(root, "beats", `${slug}.mp3`),
      path.join(root, "albums", `${slug}.zip`),
      path.join(root, "albums", `${slug}.mp3`),
    );
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
