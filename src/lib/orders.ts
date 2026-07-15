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
};

export type Customer = {
  name: string;
  email: string;
  whatsapp?: string;
};

export type StoredOrder = {
  reference: string;
  createdAt: string;
  customer: Customer;
  items: OrderItem[];
  paymentMethod: string;
  projectNotes?: string;
  subtotal: number;
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

export async function saveOrderToSupabase(order: StoredOrder) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey || supabaseUrl.includes("your-project")) {
    return { saved: false, reason: "Supabase not configured (optional)." };
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        reference: order.reference,
        customer_name: order.customer.name,
        customer_email: order.customer.email,
        customer_whatsapp: order.customer.whatsapp || null,
        payment_method: order.paymentMethod,
        project_notes: order.projectNotes || null,
        items: order.items,
        subtotal: order.subtotal,
        total: order.total,
        status: order.status,
        delivery_status: order.deliveryStatus,
        stripe_session_id: order.stripeSessionId || null,
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

/** Notify BVS owner (Telegram bot or custom webhook). Never throws. */
export async function notifyOwnerNewOrder(order: StoredOrder) {
  const lines = [
    `🦅 BVS new order ${order.reference}`,
    `${order.customer.name} · ${order.customer.email}`,
    order.customer.whatsapp ? `WhatsApp: ${order.customer.whatsapp}` : null,
    `Total: $${order.total.toFixed(2)} · ${order.paymentMethod} · ${order.status}`,
    ...order.items.map(
      (i) => `• ${i.title} ($${i.price} × ${i.quantity}) [${i.type}]`,
    ),
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
}

export function paymentInstructions(
  method: string,
  reference: string,
  total: number,
  extra?: { paynowInstructions?: string; pollUrl?: string },
) {
  const whatsapp =
    process.env.NEXT_PUBLIC_BVS_WHATSAPP || process.env.BVS_WHATSAPP || "+4917664006205";
  const orderEmail = process.env.BVS_ORDER_EMAIL || "abiaschivayo3@gmail.com";
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
