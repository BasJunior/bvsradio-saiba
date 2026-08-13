import { promises as fs } from "fs";
import path from "path";

export type OrderItem = {
  id: string | number;
  title: string;
  artist?: string;
  type: string;
  price: number;
  quantity: number;
  delivery?: string;
  sourceUrl?: string;
  /** Selected beat_licence_options.id when purchasing a beat */
  licence_option_id?: string;
};

export type Customer = {
  name: string;
  email: string;
  whatsapp?: string;
  /** ISO country code used for tax (e.g. DE, ZW) */
  country?: string;
  /** Optional EU VAT ID for reverse charge */
  vatId?: string;
};

export type StoredOrder = {
  reference: string;
  customerUserId?: string;
  createdAt: string;
  customer: Customer;
  items: OrderItem[];
  paymentMethod: string;
  projectNotes?: string;
  subtotal: number;
  /** Tax in major currency units */
  taxAmount: number;
  taxRate: number;
  taxMode: string;
  taxLabel?: string;
  taxCountry?: string;
  taxNote?: string;
  total: number;
  currency: string;
  status: "pending_payment" | "paid" | "cancelled" | "fulfilled";
  deliveryStatus: string;
  stripeSessionId?: string;
  stripePaymentIntent?: string;
  paynowPollUrl?: string;
  paynowInstructions?: string;
  source: string;
};

const ORDERS_DIR = path.join(process.cwd(), "data", "orders");

export function orderReference() {
  return `BVS-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase()}`;
}

export async function ensureOrdersDir() {
  await fs.mkdir(ORDERS_DIR, { recursive: true });
}

export async function saveOrderLocal(order: StoredOrder) {
  await ensureOrdersDir();
  const file = path.join(ORDERS_DIR, `${order.reference}.json`);
  await fs.writeFile(file, JSON.stringify(order, null, 2), "utf8");
  return file;
}

export async function loadOrderLocal(reference: string): Promise<StoredOrder | null> {
  try {
    const file = path.join(ORDERS_DIR, `${reference}.json`);
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as StoredOrder;
  } catch {
    return null;
  }
}

export async function updateOrderLocal(
  reference: string,
  patch: Partial<StoredOrder>,
): Promise<StoredOrder | null> {
  const existing = await loadOrderLocal(reference);
  if (!existing) return null;
  const next = { ...existing, ...patch };
  await saveOrderLocal(next);
  return next;
}

type SupabaseOrderRow = {
  reference: string;
  customer_user_id?: string | null;
  customer_name: string;
  customer_email: string;
  customer_whatsapp?: string | null;
  payment_method: string;
  project_notes?: string | null;
  items?: OrderItem[] | null;
  subtotal?: number | null;
  tax_amount?: number | null;
  tax_rate?: number | null;
  tax_mode?: string | null;
  tax_country?: string | null;
  total?: number | null;
  currency?: string | null;
  status?: string | null;
  delivery_status?: string | null;
  stripe_session_id?: string | null;
  stripe_payment_intent?: string | null;
  created_at?: string | null;
};

function supabaseConfigured() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey || supabaseUrl.includes("your-project")) {
    return null;
  }
  return { supabaseUrl, serviceKey };
}

function rowToOrder(row: SupabaseOrderRow): StoredOrder {
  const status = (row.status || "pending_payment") as StoredOrder["status"];
  return {
    reference: row.reference,
    customerUserId: row.customer_user_id || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    customer: {
      name: row.customer_name,
      email: row.customer_email,
      whatsapp: row.customer_whatsapp || undefined,
      country: row.tax_country || undefined,
    },
    items: Array.isArray(row.items) ? row.items : [],
    paymentMethod: row.payment_method,
    projectNotes: row.project_notes || undefined,
    subtotal: Number(row.subtotal || 0),
    taxAmount: Number(row.tax_amount || 0),
    taxRate: Number(row.tax_rate || 0),
    taxMode: row.tax_mode || "unknown",
    taxCountry: row.tax_country || undefined,
    total: Number(row.total || 0),
    currency: row.currency || "usd",
    status,
    deliveryStatus: row.delivery_status || "awaiting_payment",
    stripeSessionId: row.stripe_session_id || undefined,
    stripePaymentIntent: row.stripe_payment_intent || undefined,
    source: "web",
  };
}

/** Load order from local FS first, then Supabase (production source of truth). */
export async function loadOrder(reference: string): Promise<StoredOrder | null> {
  const local = await loadOrderLocal(reference);
  if (local) return local;

  const cfg = supabaseConfigured();
  if (!cfg) return null;

  try {
    const url = `${cfg.supabaseUrl}/rest/v1/orders?reference=eq.${encodeURIComponent(reference)}&select=*&limit=1`;
    const response = await fetch(url, {
      headers: {
        apikey: cfg.serviceKey,
        Authorization: `Bearer ${cfg.serviceKey}`,
      },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as SupabaseOrderRow[];
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rowToOrder(rows[0]);
  } catch {
    return null;
  }
}

/** Update local + Supabase status after payment. Returns best-effort merged order. */
export async function updateOrder(
  reference: string,
  patch: Partial<StoredOrder>,
): Promise<StoredOrder | null> {
  const local = await updateOrderLocal(reference, patch);

  const cfg = supabaseConfigured();
  let remote: StoredOrder | null = null;
  if (cfg) {
    try {
      const body: Record<string, unknown> = {};
      if (patch.status !== undefined) body.status = patch.status;
      if (patch.deliveryStatus !== undefined) body.delivery_status = patch.deliveryStatus;
      if (patch.stripeSessionId !== undefined) body.stripe_session_id = patch.stripeSessionId;
      if (patch.stripePaymentIntent !== undefined) {
        body.stripe_payment_intent = patch.stripePaymentIntent;
      }
      if (patch.taxAmount !== undefined) body.tax_amount = patch.taxAmount;
      if (patch.taxRate !== undefined) body.tax_rate = patch.taxRate;
      if (patch.taxMode !== undefined) body.tax_mode = patch.taxMode;
      if (patch.taxCountry !== undefined) body.tax_country = patch.taxCountry;
      if (Object.keys(body).length > 0) {
        body.updated_at = new Date().toISOString();
        const response = await fetch(
          `${cfg.supabaseUrl}/rest/v1/orders?reference=eq.${encodeURIComponent(reference)}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              apikey: cfg.serviceKey,
              Authorization: `Bearer ${cfg.serviceKey}`,
              Prefer: "return=representation",
            },
            body: JSON.stringify(body),
          },
        );
        if (response.ok) {
          const rows = (await response.json()) as SupabaseOrderRow[];
          if (Array.isArray(rows) && rows[0]) remote = rowToOrder(rows[0]);
        }
      }
    } catch {
      /* ignore remote patch failure */
    }
  }

  if (local) return local;
  if (remote) return { ...remote, ...patch };
  const existing = await loadOrder(reference);
  if (!existing) return null;
  return { ...existing, ...patch };
}

export async function saveOrderToSupabase(order: StoredOrder) {
  const cfg = supabaseConfigured();
  if (!cfg) {
    return { saved: false, reason: "Supabase not configured (optional)." };
  }

  try {
    const response = await fetch(`${cfg.supabaseUrl}/rest/v1/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: cfg.serviceKey,
        Authorization: `Bearer ${cfg.serviceKey}`,
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        reference: order.reference,
        customer_user_id: order.customerUserId || null,
        customer_name: order.customer.name,
        customer_email: order.customer.email,
        customer_whatsapp: order.customer.whatsapp || null,
        payment_method: order.paymentMethod,
        project_notes: order.projectNotes || null,
        items: order.items,
        subtotal: order.subtotal,
        tax_amount: order.taxAmount,
        tax_rate: order.taxRate,
        tax_mode: order.taxMode,
        tax_country: order.taxCountry || null,
        total: order.total,
        currency: order.currency,
        status: order.status,
        delivery_status: order.deliveryStatus,
        stripe_session_id: order.stripeSessionId || null,
        stripe_payment_intent: order.stripePaymentIntent || null,
      }),
    });

    if (!response.ok) {
      return { saved: false, reason: await response.text() };
    }

    return { saved: true, reason: "Saved to Supabase." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase error";
    return { saved: false, reason: message };
  }
}

function orderItemLines(order: StoredOrder): string[] {
  return order.items.map(
    (i) => `• ${i.title} ($${Number(i.price).toFixed(2)} × ${i.quantity}) [${i.type}]`,
  );
}

/** Customer receipt after paid (or pending manual) order. Never throws. */
export async function notifyCustomerOrderEmail(
  order: StoredOrder,
  kind: "paid" | "received" = "paid",
) {
  const to = (order.customer.email || "").trim();
  if (!to) return;

  try {
    const { sendBvsEmail, wrapBvsEmailHtml } = await import("@/lib/mailer");
    const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://bvsradio.com").replace(/\/$/, "");
    const orderUrl = `${site}/account/orders/${encodeURIComponent(order.reference)}`;
    const isPaid = kind === "paid" || order.status === "paid" || order.status === "fulfilled";
    const subject = isPaid
      ? `BVS Radio — payment received · ${order.reference}`
      : `BVS Radio — order received · ${order.reference}`;

    const itemHtml = order.items
      .map(
        (i) =>
          `<li style="margin:0 0 6px;color:#cfcfcf">${escapeHtml(String(i.title))} — $${Number(i.price).toFixed(2)} × ${i.quantity}</li>`,
      )
      .join("");

    const deliveryNote = isPaid
      ? order.deliveryStatus === "premium_active"
        ? "Your Artist Premium period is active. Open Creator Studio → Premium desk for next steps."
        : "Digital downloads unlock on your order page when files are staged. Studio services are confirmed by BVS on WhatsApp/email."
      : "Complete payment to unlock delivery. If you already paid on Paynow, allow a minute for confirmation.";

    const text = [
      isPaid ? "Payment confirmed on BVS Radio." : "We received your BVS Radio order.",
      "",
      `Reference: ${order.reference}`,
      `Status: ${order.status}`,
      `Total: $${Number(order.total).toFixed(2)} ${order.currency || "USD"}`,
      `Method: ${order.paymentMethod}`,
      "",
      "Items:",
      ...orderItemLines(order),
      "",
      deliveryNote,
      "",
      `Order page: ${orderUrl}`,
      "Questions: contact@bvsradio.com",
    ].join("\n");

    const bodyHtml = `
      <p style="color:#cfcfcf;line-height:1.5;margin:0 0 14px">${
        isPaid
          ? "Thanks — <strong>payment is confirmed</strong>. Here is your receipt."
          : "Thanks — we received your order. Complete payment if you have not already."
      }</p>
      <p style="margin:0 0 8px;color:#fafafa"><strong>Reference:</strong> ${escapeHtml(order.reference)}</p>
      <p style="margin:0 0 8px;color:#cfcfcf"><strong>Total:</strong> $${Number(order.total).toFixed(2)} ${escapeHtml(String(order.currency || "USD"))} · ${escapeHtml(String(order.paymentMethod))} · ${escapeHtml(String(order.status))}</p>
      <ul style="padding-left:18px;margin:12px 0 18px">${itemHtml}</ul>
      <p style="color:#cfcfcf;line-height:1.5;margin:0 0 18px">${escapeHtml(deliveryNote)}</p>
      <p style="margin:0"><a href="${orderUrl}" style="display:inline-block;background:#f5c518;color:#000;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">View order</a></p>`;

    await sendBvsEmail({
      to,
      subject,
      text,
      html: wrapBvsEmailHtml({
        title: isPaid ? "Payment confirmed" : "Order received",
        bodyHtml,
      }),
    });
  } catch (err) {
    console.error("notifyCustomerOrderEmail", order.reference, err);
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/\"/g, "&" + "quot;");
}

/** Notify BVS owner (Telegram + optional webhook + owner email). Never throws. */
export async function notifyOwnerNewOrder(order: StoredOrder) {
  const lines = [
    `🦅 BVS ${order.status === "paid" || order.status === "fulfilled" ? "PAID" : "new"} order ${order.reference}`,
    `${order.customer.name} · ${order.customer.email}`,
    order.customer.whatsapp ? `WhatsApp: ${order.customer.whatsapp}` : null,
    `Subtotal: $${order.subtotal.toFixed(2)} · Tax: $${(order.taxAmount || 0).toFixed(2)} (${order.taxCountry || "—"})`,
    `Total: $${order.total.toFixed(2)} · ${order.paymentMethod} · ${order.status}`,
    `Delivery: ${order.deliveryStatus}`,
    ...orderItemLines(order),
    order.projectNotes ? `Notes: ${order.projectNotes.slice(0, 200)}` : null,
  ].filter(Boolean) as string[];

  const text = lines.join("\n");

  const webhook = process.env.ORDER_NOTIFY_WEBHOOK;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, order }),
      });
    } catch {
      /* ignore */
    }
  }

  const bot = process.env.BVS_ORDER_TELEGRAM_BOT_TOKEN;
  const chat = process.env.BVS_ORDER_TELEGRAM_CHAT_ID || "7030402014";
  if (bot) {
    try {
      await fetch(`https://api.telegram.org/bot${bot}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text }),
      });
    } catch {
      /* ignore */
    }
  }

  // Owner email copy (same inbox as SMTP_FROM / BVS_ORDER_EMAIL)
  const ownerInbox =
    (process.env.BVS_OWNER_NOTIFY_EMAIL || process.env.BVS_ORDER_EMAIL || "").trim();
  if (ownerInbox) {
    try {
      const { sendBvsEmail, wrapBvsEmailHtml } = await import("@/lib/mailer");
      const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://bvsradio.com").replace(/\/$/, "");
      await sendBvsEmail({
        to: ownerInbox,
        subject: `BVS ${order.status} · ${order.reference} · $${Number(order.total).toFixed(2)}`,
        text,
        html: wrapBvsEmailHtml({
          title: `Order ${order.reference}`,
          bodyHtml: `<pre style="white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:13px;color:#cfcfcf;margin:0">${escapeHtml(text)}</pre>
            <p style="margin:18px 0 0"><a href="${site}/account/orders/${encodeURIComponent(order.reference)}" style="color:#f5c518">Open order page</a></p>`,
        }),
      });
    } catch (err) {
      console.error("notifyOwnerNewOrder email", order.reference, err);
    }
  }
}

export function paymentInstructions(
  method: string,
  reference: string,
  total: number,
  extra?: { paynowInstructions?: string; pollUrl?: string },
) {
  const whatsapp =
    process.env.NEXT_PUBLIC_BVS_WHATSAPP || process.env.BVS_WHATSAPP || "+491706580888";
  const orderEmail = process.env.BVS_ORDER_EMAIL || "contact@bvsradio.com";
  const bank =
    process.env.BVS_BANK_DETAILS ||
    "Bank details confirmed on WhatsApp after order (BVS Radio).";
  const eco =
    process.env.BVS_ECOCASH ||
    "EcoCash via Paynow — approve the prompt on your phone, or WhatsApp BVS.";

  switch (method) {
    case "card":
    case "stripe":
      return [
        "Complete card payment on the secure Stripe page.",
        "You will return to BVS automatically after payment.",
        "Digital downloads / service scheduling start once paid.",
      ];
    case "paynow":
    case "paynow_redirect":
      return [
        "Complete payment on the Paynow page (cards, EcoCash, OneMoney, etc.).",
        "You return to BVS when done.",
        `Order ${reference} · $${total.toFixed(2)} USD equivalent.`,
      ];
    case "ecocash":
    case "paynow_ecocash":
      return [
        extra?.paynowInstructions ||
          "Check your phone for the EcoCash / Paynow prompt and approve payment.",
        `Amount: $${total.toFixed(2)} USD equivalent · Ref ${reference}`,
        eco,
        `If nothing arrives, WhatsApp ${whatsapp} or email ${orderEmail}.`,
      ];
    case "mobile_money":
      return [
        `Pay $${total.toFixed(2)} via EcoCash (Paynow) or send proof on WhatsApp.`,
        eco,
        `Reference ${reference}`,
        `WhatsApp ${whatsapp} · email ${orderEmail}`,
      ];
    case "manual_bank":
      return [
        `Bank transfer for $${total.toFixed(2)}.`,
        bank,
        `Reference: ${reference}`,
        `WhatsApp proof to ${whatsapp} or email ${orderEmail}.`,
      ];
    case "paypal":
      return [
        `PayPal $${total.toFixed(2)} — confirm address with BVS on WhatsApp (${whatsapp}).`,
        `Note: ${reference} · email ${orderEmail}`,
      ];
    default:
      return [
        `Contact BVS on WhatsApp ${whatsapp} or ${orderEmail} with reference ${reference}.`,
      ];
  }
}
