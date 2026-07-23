import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { loadOrderLocal } from "@/lib/orders";
import { resolveProductFile, verifyDownloadToken } from "@/lib/products";

/**
 * Secure product download from VPS bvsradio-products folder.
 * Requires valid token + order status paid|fulfilled.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const parsed = verifyDownloadToken(token);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 403 });
  }

  const order = await loadOrderLocal(parsed.reference);
  if (!order || (order.status !== "paid" && order.status !== "fulfilled")) {
    return NextResponse.json(
      { error: "Payment not confirmed yet. Contact BVS if you already paid." },
      { status: 402 },
    );
  }

  const item = order.items.find((i) => String(i.id) === parsed.itemId);
  const filePath = await resolveProductFile(parsed.itemId, item?.title);
  if (!filePath) {
    return NextResponse.json(
      {
        error: "File not staged yet. BVS will send it on WhatsApp/email.",
        contact: process.env.BVS_ORDER_EMAIL || "contact@bvsradio.com",
      },
      { status: 404 },
    );
  }

  const data = await fs.readFile(filePath);
  const filename = path.basename(filePath);
  return new NextResponse(data, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
