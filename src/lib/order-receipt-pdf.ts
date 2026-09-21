import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { StoredOrder } from "@/lib/orders";

export type ReceiptPdfInput = {
  reference: string;
  status: string;
  deliveryStatus?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  paymentMethod?: string | null;
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  taxLabel?: string | null;
  taxCountry?: string | null;
  taxMode?: string | null;
  total: number;
  currency: string;
  createdAt?: string | null;
  paidAt?: string | null;
  stripePaymentIntent?: string | null;
  stripeSessionId?: string | null;
  items: Array<{
    title: string;
    artist?: string | null;
    type?: string | null;
    sku?: string | null;
    quantity: number;
    unitAmount: number;
    delivery?: string | null;
    licenceSummary?: string | null;
  }>;
};

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 48;
const INK = rgb(0.04, 0.04, 0.06);
const MUTED = rgb(0.36, 0.36, 0.4);
const LINE = rgb(0.9, 0.9, 0.92);
const SOFT = rgb(0.97, 0.96, 1);
const PAID = rgb(0.02, 0.48, 0.27);
const PAID_BG = rgb(0.91, 0.97, 0.93);
const BRAND = rgb(0.49, 0.23, 0.93);

function money(amount: number, currency = "USD") {
  const cur = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 2,
    }).format(Number(amount || 0));
  } catch {
    return `${cur} ${Number(amount || 0).toFixed(2)}`;
  }
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(dt) + " Europe/Berlin";
  } catch {
    return dt.toISOString();
  }
}

function clean(value?: string | null, fallback = "—") {
  const text = String(value || "").trim();
  return text || fallback;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next;
    else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

function drawLabelValue(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  x: number,
  y: number,
  label: string,
  value: string,
  width: number,
) {
  page.drawText(label, { x, y, size: 8, font: bold, color: MUTED });
  const lines = wrapText(value, font, 10, width);
  let cursor = y - 14;
  for (const line of lines.slice(0, 4)) {
    page.drawText(line, { x, y: cursor, size: 10, font, color: INK });
    cursor -= 13;
  }
  return cursor - 8;
}

export function receiptInputFromStoredOrder(order: StoredOrder, paidAt?: string | null): ReceiptPdfInput {
  return {
    reference: order.reference,
    status: order.status,
    deliveryStatus: order.deliveryStatus,
    customerName: order.customer?.name,
    customerEmail: order.customer?.email,
    paymentMethod: order.paymentMethod,
    subtotal: Number(order.subtotal || 0),
    taxAmount: Number(order.taxAmount || 0),
    taxRate: Number(order.taxRate || 0),
    taxLabel: order.taxLabel || "VAT / tax",
    taxCountry: order.taxCountry || order.customer?.country || null,
    taxMode: order.taxMode,
    total: Number(order.total || 0),
    currency: order.currency || "USD",
    createdAt: order.createdAt,
    paidAt: paidAt || (order.status === "paid" || order.status === "fulfilled" ? order.createdAt : null),
    stripePaymentIntent: order.stripePaymentIntent || null,
    stripeSessionId: order.stripeSessionId || null,
    items: (order.items || []).map((item) => ({
      title: item.title || "BVS item",
      artist: item.artist || null,
      type: item.type || null,
      sku: item.licence_option_id ? String(item.licence_option_id) : String(item.id ?? ""),
      quantity: Number(item.quantity || 1),
      unitAmount: Number(item.price || 0),
      delivery: item.delivery || null,
      licenceSummary: null,
    })),
  };
}

export async function buildOrderReceiptPdf(input: ReceiptPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = PAGE_H - MARGIN;

  page.drawText("BVS Radio", { x: MARGIN, y, size: 18, font: bold, color: INK });
  page.drawText("RECEIPT", {
    x: PAGE_W - MARGIN - bold.widthOfTextAtSize("RECEIPT", 20),
    y: y - 2,
    size: 20,
    font: bold,
    color: INK,
  });
  y -= 18;
  page.drawText("Best Virtual Sound · Digital purchase receipt", {
    x: MARGIN,
    y,
    size: 9,
    font,
    color: MUTED,
  });
  page.drawText(input.reference, {
    x: PAGE_W - MARGIN - bold.widthOfTextAtSize(input.reference, 10),
    y,
    size: 10,
    font: bold,
    color: INK,
  });
  y -= 14;
  page.drawText("bvsradio.com", { x: MARGIN, y, size: 9, font, color: MUTED });
  const issued = `Issued ${fmtDate(new Date().toISOString())}`;
  page.drawText(issued, {
    x: PAGE_W - MARGIN - font.widthOfTextAtSize(issued, 9),
    y,
    size: 9,
    font,
    color: MUTED,
  });

  y -= 18;
  page.drawRectangle({
    x: MARGIN,
    y: y - 1,
    width: PAGE_W - MARGIN * 2,
    height: 1,
    color: LINE,
  });
  y -= 22;

  const paid = ["paid", "fulfilled"].includes(String(input.status || "").toLowerCase());
  page.drawRectangle({
    x: MARGIN,
    y: y - 10,
    width: 70,
    height: 22,
    color: paid ? PAID_BG : SOFT,
    borderColor: paid ? rgb(0.78, 0.92, 0.84) : LINE,
    borderWidth: 0.8,
  });
  page.drawText(paid ? "PAID" : String(input.status || "OPEN").toUpperCase(), {
    x: MARGIN + 14,
    y: y - 3,
    size: 10,
    font: bold,
    color: paid ? PAID : BRAND,
  });
  const statusNote = [
    "Digital product",
    clean(input.paymentMethod, "payment").replaceAll("_", " "),
    input.taxCountry ? `Tax ${input.taxCountry}` : null,
    input.taxRate > 0 ? `${(input.taxRate * 100).toFixed(0)}%` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  page.drawText(statusNote, { x: MARGIN + 84, y: y - 2, size: 9, font, color: MUTED });
  y -= 36;

  // Parties
  page.drawText("From", { x: MARGIN, y, size: 10, font: bold, color: INK });
  page.drawText("Bill to", { x: 320, y, size: 10, font: bold, color: INK });
  y -= 16;
  page.drawText("BVS Radio / Best Virtual Sound", { x: MARGIN, y, size: 10, font: bold, color: INK });
  page.drawText(clean(input.customerName, "Customer"), { x: 320, y, size: 10, font: bold, color: INK });
  y -= 13;
  page.drawText("Digital music & creative platform", { x: MARGIN, y, size: 9, font, color: MUTED });
  page.drawText(clean(input.customerEmail, "No email on file"), { x: 320, y, size: 9, font, color: MUTED });
  y -= 13;
  page.drawText("Support: bvsradio.com/contact", { x: MARGIN, y, size: 9, font, color: MUTED });
  page.drawText(`Method: ${clean(input.paymentMethod, "—").replaceAll("_", " ")}`, {
    x: 320,
    y,
    size: 9,
    font,
    color: MUTED,
  });
  y -= 13;
  page.drawText("No physical shipping", { x: MARGIN, y, size: 9, font, color: MUTED });
  if (input.taxCountry) {
    page.drawText(
      `Tax: ${input.taxCountry}${input.taxRate > 0 ? ` · ${(input.taxRate * 100).toFixed(0)}%` : ""}`,
      { x: 320, y, size: 9, font, color: MUTED },
    );
  }
  y -= 28;

  // Items header
  page.drawText("Items", { x: MARGIN, y, size: 11, font: bold, color: INK });
  y -= 10;
  page.drawRectangle({
    x: MARGIN,
    y: y - 18,
    width: PAGE_W - MARGIN * 2,
    height: 24,
    color: rgb(0.95, 0.95, 0.96),
  });
  page.drawText("Description", { x: MARGIN + 8, y: y - 10, size: 9, font: bold, color: MUTED });
  page.drawText("Qty", { x: 360, y: y - 10, size: 9, font: bold, color: MUTED });
  page.drawText("Unit", { x: 410, y: y - 10, size: 9, font: bold, color: MUTED });
  page.drawText("Amount", { x: 480, y: y - 10, size: 9, font: bold, color: MUTED });
  y -= 34;

  const currency = input.currency || "USD";
  for (const item of input.items) {
    const title = clean(item.title, "BVS item");
    const meta = [item.artist, item.type, item.sku ? `SKU ${item.sku}` : null].filter(Boolean).join(" · ");
    const qty = Number(item.quantity || 1);
    const unit = Number(item.unitAmount || 0);
    const amount = unit * qty;
    const titleLines = wrapText(title, bold, 10, 290);
    const metaLines = meta ? wrapText(meta, font, 8.5, 290) : [];
    const blockH = Math.max(28, titleLines.length * 12 + metaLines.length * 11 + 10);

    if (y - blockH < 120) {
      // Keep totals on first page for typical single-item digital orders.
      break;
    }

    let cursor = y;
    for (const line of titleLines) {
      page.drawText(line, { x: MARGIN + 8, y: cursor, size: 10, font: bold, color: INK });
      cursor -= 12;
    }
    for (const line of metaLines.slice(0, 2)) {
      page.drawText(line, { x: MARGIN + 8, y: cursor, size: 8.5, font, color: MUTED });
      cursor -= 11;
    }
    if (item.delivery) {
      const deliveryLines = wrapText(String(item.delivery), font, 8, 290);
      for (const line of deliveryLines.slice(0, 2)) {
        page.drawText(line, { x: MARGIN + 8, y: cursor, size: 8, font, color: MUTED });
        cursor -= 10;
      }
    }

    page.drawText(String(qty), { x: 360, y, size: 10, font, color: INK });
    const unitText = money(unit, currency);
    const amountText = money(amount, currency);
    page.drawText(unitText, {
      x: 455 - font.widthOfTextAtSize(unitText, 10),
      y,
      size: 10,
      font,
      color: INK,
    });
    page.drawText(amountText, {
      x: PAGE_W - MARGIN - 8 - bold.widthOfTextAtSize(amountText, 10),
      y,
      size: 10,
      font: bold,
      color: INK,
    });

    y = Math.min(cursor, y - blockH);
    page.drawRectangle({
      x: MARGIN,
      y: y + 6,
      width: PAGE_W - MARGIN * 2,
      height: 0.6,
      color: LINE,
    });
    y -= 8;
  }

  y -= 8;
  const totalsX = 340;
  const drawTotalRow = (label: string, value: string, emphasize = false) => {
    page.drawText(label, {
      x: totalsX,
      y,
      size: emphasize ? 11 : 10,
      font: emphasize ? bold : font,
      color: INK,
    });
    page.drawText(value, {
      x: PAGE_W - MARGIN - (emphasize ? bold : font).widthOfTextAtSize(value, emphasize ? 12 : 10),
      y,
      size: emphasize ? 12 : 10,
      font: emphasize ? bold : font,
      color: INK,
    });
    y -= emphasize ? 20 : 16;
  };

  drawTotalRow("Subtotal", money(input.subtotal, currency));
  const taxName = clean(input.taxLabel, "Tax");
  const taxMeta = [
    input.taxRate > 0 ? `${(input.taxRate * 100).toFixed(0)}%` : null,
    input.taxCountry || null,
  ]
    .filter(Boolean)
    .join(" · ");
  drawTotalRow(taxMeta ? `${taxName} (${taxMeta})` : taxName, money(input.taxAmount, currency));
  page.drawRectangle({
    x: totalsX - 8,
    y: y - 4,
    width: PAGE_W - MARGIN - (totalsX - 8),
    height: 28,
    color: SOFT,
  });
  y -= 2;
  drawTotalRow("Total paid", money(input.total, currency), true);

  y -= 10;
  page.drawText("Payment details", { x: MARGIN, y, size: 11, font: bold, color: INK });
  y -= 18;
  y = drawLabelValue(page, font, bold, MARGIN, y, "Status", clean(input.status), 220);
  y = drawLabelValue(page, font, bold, MARGIN, y, "Paid at", fmtDate(input.paidAt), 220);
  y = drawLabelValue(page, font, bold, MARGIN, y, "Created", fmtDate(input.createdAt), 220);
  y = drawLabelValue(
    page,
    font,
    bold,
    MARGIN,
    y,
    "Method",
    clean(input.paymentMethod, "—").replaceAll("_", " "),
    220,
  );
  if (input.stripePaymentIntent) {
    y = drawLabelValue(page, font, bold, MARGIN, y, "Payment intent", input.stripePaymentIntent, 480);
  }
  if (input.stripeSessionId) {
    y = drawLabelValue(page, font, bold, MARGIN, y, "Checkout session", input.stripeSessionId, 480);
  }
  y = drawLabelValue(
    page,
    font,
    bold,
    MARGIN,
    y,
    "Fulfillment",
    clean(input.deliveryStatus, "Digital delivery after confirmed payment").replaceAll("_", " "),
    480,
  );

  page.drawRectangle({
    x: MARGIN,
    y: 70,
    width: PAGE_W - MARGIN * 2,
    height: 0.6,
    color: LINE,
  });
  const footer = [
    "Official BVS Radio purchase receipt for a digital product. No goods were shipped.",
    "Access is released to the purchaser’s BVS account library/downloads after payment confirmation.",
    `Order page: https://bvsradio.com/account/orders/${encodeURIComponent(input.reference)}`,
    "© 2026 BVS Radio. All rights reserved. · contact@bvsradio.com",
  ];
  let footerY = 56;
  for (const line of footer) {
    page.drawText(line, {
      x: MARGIN,
      y: footerY,
      size: 7.5,
      font,
      color: MUTED,
    });
    footerY -= 10;
  }

  return pdf.save();
}

export function receiptPdfFilename(reference: string) {
  const safe = String(reference || "order").replace(/[^A-Za-z0-9._-]+/g, "_");
  return `BVS-Receipt-${safe}.pdf`;
}
