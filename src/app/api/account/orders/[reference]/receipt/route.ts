import { NextResponse } from "next/server";
import { authUserId, serviceHeaders } from "@/lib/storage-upload";
import {
  buildOrderReceiptPdf,
  receiptPdfFilename,
  type ReceiptPdfInput,
} from "@/lib/order-receipt-pdf";

export const runtime = "nodejs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

type OrderItem = {
  id?: string | number;
  sourceId?: string;
  title?: string;
  artist?: string;
  quantity?: number;
  price?: number;
  unitAmount?: number;
  type?: string;
  productType?: string;
  sku?: string;
  delivery?: string;
  licenceSummary?: string;
  licence?: string;
};

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !url || !service) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const user = await authUserId(url, service, token);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const reference = (await params).reference.trim().slice(0, 100);
  if (!reference) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const response = await fetch(
    `${url}/rest/v1/orders?reference=eq.${encodeURIComponent(reference)}&customer_user_id=eq.${user.id}&select=reference,status,delivery_status,subtotal,tax_amount,tax_rate,tax_mode,tax_country,total,currency,payment_method,items,created_at,paid_at,customer_name,customer_email,stripe_payment_intent,stripe_session_id&limit=1`,
    { headers: serviceHeaders(service), cache: "no-store" },
  );
  const rows = response.ok ? await response.json() : [];
  const order = rows[0];
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const status = String(order.status || "").toLowerCase();
  if (!["paid", "fulfilled"].includes(status)) {
    return NextResponse.json(
      { error: "Receipt PDF is available after payment is confirmed." },
      { status: 409 },
    );
  }

  const items = (Array.isArray(order.items) ? order.items : []) as OrderItem[];
  const input: ReceiptPdfInput = {
    reference: order.reference,
    status: order.status,
    deliveryStatus: order.delivery_status,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    paymentMethod: order.payment_method,
    subtotal: asNumber(order.subtotal),
    taxAmount: asNumber(order.tax_amount),
    taxRate: asNumber(order.tax_rate),
    taxLabel: "VAT / tax",
    taxCountry: order.tax_country,
    taxMode: order.tax_mode,
    total: asNumber(order.total),
    currency: order.currency || "USD",
    createdAt: order.created_at,
    paidAt: order.paid_at || order.created_at,
    stripePaymentIntent: order.stripe_payment_intent,
    stripeSessionId: order.stripe_session_id,
    items: items.map((item) => ({
      title: item.title || "BVS item",
      artist: item.artist || null,
      type: item.type || item.productType || null,
      sku: item.sku || (item.id != null ? String(item.id) : null),
      quantity: Math.max(1, asNumber(item.quantity, 1)),
      unitAmount: asNumber(item.unitAmount ?? item.price),
      delivery: item.delivery || null,
      licenceSummary: item.licenceSummary || item.licence || null,
    })),
  };

  try {
    const pdfBytes = await buildOrderReceiptPdf(input);
    const filename = receiptPdfFilename(reference);
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("order receipt pdf", reference, error);
    return NextResponse.json(
      { error: "Could not generate receipt PDF." },
      { status: 500 },
    );
  }
}
