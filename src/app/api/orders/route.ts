import { NextResponse } from "next/server";
import {
  notifyOwnerNewOrder,
  orderReference,
  paymentInstructions,
  saveOrderLocal,
  saveOrderToSupabase,
  type Customer,
  type OrderItem,
  type StoredOrder,
} from "@/lib/orders";
import { getStripe, siteUrl, stripeEnabled } from "@/lib/stripe";
import { getPaynow, normalizeZwPhone, paynowEnabled } from "@/lib/paynow";
import { createDownloadToken, resolveProductFile } from "@/lib/products";
import { recordServerEvent } from "@/lib/analytics-server";
import { calculateTax, stripeAutomaticTaxEnabled } from "@/lib/tax";

function isOrderItem(item: unknown): item is OrderItem {
  if (!item || typeof item !== "object") return false;
  const c = item as Partial<OrderItem>;
  return (
    c.id !== undefined &&
    typeof c.title === "string" &&
    typeof c.type === "string" &&
    typeof c.price === "number" &&
    typeof c.quantity === "number"
  );
}

type OrderBody = {
  customer: Customer;
  items: OrderItem[];
  paymentMethod: string;
  projectNotes?: string;
  /** Client hint only — server recomputes */
  subtotal?: number;
  total?: number;
  countryCode?: string;
  vatId?: string;
  createStripeSession?: boolean;
};

function parseBody(payload: unknown): OrderBody | null {
  if (!payload || typeof payload !== "object") return null;
  const c = payload as Partial<OrderBody>;
  if (
    !c.customer ||
    typeof c.customer.name !== "string" ||
    typeof c.customer.email !== "string" ||
    !Array.isArray(c.items) ||
    !c.items.every(isOrderItem) ||
    typeof c.paymentMethod !== "string"
  ) {
    return null;
  }
  return c as OrderBody;
}

export async function POST(req: Request) {
  try {
    const payload = parseBody(await req.json());
    if (!payload) {
      return NextResponse.json({ error: "Invalid order payload." }, { status: 400 });
    }
    if (payload.items.length === 0) {
      return NextResponse.json({ error: "Add at least one item before checkout." }, { status: 400 });
    }

    // Net subtotal from line items (authoritative)
    const subtotal = Number(
      payload.items
        .reduce((sum, item) => sum + item.price * item.quantity, 0)
        .toFixed(2),
    );
    if (subtotal <= 0) {
      return NextResponse.json({ error: "Order total must be greater than zero." }, { status: 400 });
    }

    const countryCode =
      payload.countryCode ||
      payload.customer.country ||
      "OTHER";
    const vatId = payload.vatId || payload.customer.vatId || "";
    const tax = calculateTax({
      subtotal,
      countryCode,
      vatId,
      currency: "USD",
    });

    const reference = orderReference();
    const wantsCard =
      payload.paymentMethod === "card" ||
      payload.paymentMethod === "stripe" ||
      payload.createStripeSession === true;

    const order: StoredOrder = {
      reference,
      createdAt: new Date().toISOString(),
      customer: {
        ...payload.customer,
        country: tax.countryCode,
        vatId: vatId || undefined,
      },
      items: payload.items,
      paymentMethod: payload.paymentMethod,
      projectNotes: payload.projectNotes,
      subtotal: tax.subtotal,
      taxAmount: tax.taxAmount,
      taxRate: tax.rate,
      taxMode: tax.mode,
      taxLabel: tax.taxLabel,
      taxCountry: tax.countryCode,
      taxNote: tax.note,
      total: tax.total,
      currency: "usd",
      status: "pending_payment",
      deliveryStatus: "awaiting_payment",
      source: "web",
    };

    let localPath: string | null = null;
    try {
      localPath = await saveOrderLocal(order);
    } catch {
      localPath = null;
    }

    const supabase = await saveOrderToSupabase(order);

    // Card path: Stripe Checkout
    if (wantsCard && stripeEnabled()) {
      const stripe = getStripe();
      if (stripe) {
        const useStripeTax = stripeAutomaticTaxEnabled();
        const lineItems = order.items.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(item.price * 100),
            product_data: {
              name: item.title,
              description: `${item.type}${item.artist ? ` · ${item.artist}` : ""} · ${reference}`,
            },
          },
        }));
        // When Stripe Tax is not enabled, add calculated regional tax as its own line
        if (!useStripeTax && order.taxAmount > 0) {
          lineItems.push({
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: Math.round(order.taxAmount * 100),
              product_data: {
                name: `${order.taxLabel || "Tax"} (${order.taxCountry || ""})`,
                description: order.taxNote || `Tax for order ${reference}`,
              },
            },
          });
        }
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: order.customer.email,
          client_reference_id: reference,
          metadata: {
            reference,
            customer_name: order.customer.name,
            whatsapp: order.customer.whatsapp || "",
            tax_country: order.taxCountry || "",
            tax_amount: String(order.taxAmount),
          },
          line_items: lineItems,
          ...(useStripeTax
            ? {
                automatic_tax: { enabled: true },
                billing_address_collection: "required" as const,
              }
            : {
                automatic_tax: { enabled: false },
              }),
          success_url: `${siteUrl()}/checkout/success?ref=${encodeURIComponent(reference)}&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${siteUrl()}/checkout?cancelled=1&ref=${encodeURIComponent(reference)}`,
        });

        order.stripeSessionId = session.id;
        try {
          await saveOrderLocal(order);
        } catch {
          /* ignore */
        }

        await notifyOwnerNewOrder(order);

        return NextResponse.json({
          reference,
          status: order.status,
          savedLocal: Boolean(localPath),
          savedSupabase: supabase.saved,
          persistenceMessage: localPath
            ? "Order saved. Redirecting to secure card payment."
            : `Order created. ${supabase.reason}`,
          checkoutUrl: session.url,
          paymentMode: "stripe",
          subtotal: order.subtotal,
          taxAmount: order.taxAmount,
          taxRate: order.taxRate,
          taxMode: order.taxMode,
          taxLabel: order.taxLabel,
          taxCountry: order.taxCountry,
          taxNote: order.taxNote,
          total: order.total,
          nextSteps: paymentInstructions("card", reference, order.total),
        });
      }
    }

    if (wantsCard && !stripeEnabled()) {
      order.paymentMethod = paynowEnabled() ? "paynow" : "ecocash";
    }

    // Paynow web redirect (all methods incl. EcoCash on their page)
    const wantsPaynow =
      payload.paymentMethod === "paynow" ||
      payload.paymentMethod === "paynow_redirect" ||
      (payload.paymentMethod === "ecocash" && !payload.customer.whatsapp);

    // Paynow EcoCash express (push to ZW phone)
    const wantsEcoCashPush =
      payload.paymentMethod === "ecocash" || payload.paymentMethod === "paynow_ecocash";

    if (paynowEnabled() && (wantsPaynow || wantsEcoCashPush)) {
      const paynow = getPaynow();
      if (paynow) {
        paynow.returnUrl = `${siteUrl()}/checkout/success?ref=${encodeURIComponent(reference)}`;
        const payment = paynow.createPayment(reference, order.customer.email);
        for (const item of order.items) {
          payment.add(
            `${item.title} (${item.type})`,
            Number((item.price * item.quantity).toFixed(2)),
          );
        }
        if (order.taxAmount > 0) {
          payment.add(
            `${order.taxLabel || "Tax"} (${order.taxCountry || "region"})`,
            Number(order.taxAmount.toFixed(2)),
          );
        }

        try {
          if (wantsEcoCashPush) {
            const phone =
              normalizeZwPhone(order.customer.whatsapp || "") ||
              normalizeZwPhone((payload as { phone?: string }).phone || "");
            if (phone) {
              const response = await paynow.sendMobile(payment, phone, "ecocash");
              if (response.success) {
                order.paymentMethod = "ecocash";
                order.paynowPollUrl = response.pollUrl;
                order.paynowInstructions =
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (response as any).instructions ||
                  "Approve the EcoCash prompt on your phone.";
                try {
                  await saveOrderLocal(order);
                } catch {
                  /* ignore */
                }
                await notifyOwnerNewOrder(order);
                return NextResponse.json({
                  reference,
                  status: order.status,
                  savedLocal: Boolean(localPath),
                  savedSupabase: supabase.saved,
                  persistenceMessage: "Order saved. Approve EcoCash on your phone.",
                  paymentMode: "paynow_ecocash",
                  pollUrl: response.pollUrl,
                  subtotal: order.subtotal,
                  taxAmount: order.taxAmount,
                  taxRate: order.taxRate,
                  taxMode: order.taxMode,
                  taxLabel: order.taxLabel,
                  taxCountry: order.taxCountry,
                  taxNote: order.taxNote,
                  total: order.total,
                  nextSteps: paymentInstructions("ecocash", reference, order.total, {
                    paynowInstructions: order.paynowInstructions,
                  }),
                  paynowReady: true,
                });
              }
            }
            // fall through to redirect checkout if push failed / no ZW phone
          }

          const response = await paynow.send(payment);
          if (response.success && response.redirectUrl) {
            order.paymentMethod = "paynow";
            order.paynowPollUrl = response.pollUrl;
            try {
              await saveOrderLocal(order);
            } catch {
              /* ignore */
            }
            await notifyOwnerNewOrder(order);
            return NextResponse.json({
              reference,
              status: order.status,
              savedLocal: Boolean(localPath),
              savedSupabase: supabase.saved,
              persistenceMessage: "Order saved. Redirecting to Paynow.",
              checkoutUrl: response.redirectUrl,
              paymentMode: "paynow",
              pollUrl: response.pollUrl,
              subtotal: order.subtotal,
              taxAmount: order.taxAmount,
              taxRate: order.taxRate,
              taxMode: order.taxMode,
              taxLabel: order.taxLabel,
              taxCountry: order.taxCountry,
              taxNote: order.taxNote,
              total: order.total,
              nextSteps: paymentInstructions("paynow", reference, order.total),
              paynowReady: true,
            });
          }
        } catch (paynowErr) {
          console.error("Paynow error", paynowErr);
          await recordServerEvent("payment_error", { provider: "paynow", stage: "checkout_creation" });
          // continue to manual
        }
      }
    }

    await notifyOwnerNewOrder(order);

    const whatsapp = process.env.NEXT_PUBLIC_BVS_WHATSAPP || "+4917664006205";
    const orderEmail = process.env.BVS_ORDER_EMAIL || "abiaschivayo3@gmail.com";
    const waLink = whatsapp
      ? `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
          `Hi BVS, I placed order ${reference} ($${order.total.toFixed(2)}). Email: ${order.customer.email}`,
        )}`
      : null;

    // Prepare download tokens once paid (preview links only after paid — stored for staff)
    const downloadHints: string[] = [];
    for (const item of order.items) {
      const file = await resolveProductFile(item.id, item.title);
      if (file) {
        const token = createDownloadToken(reference, String(item.id));
        downloadHints.push(`${item.title}: /api/download?token=${token}`);
      }
    }

    return NextResponse.json({
      reference,
      status: order.status,
      savedLocal: Boolean(localPath),
      savedSupabase: supabase.saved,
      persistenceMessage: localPath
        ? "Order saved. Complete payment using the steps below."
        : `Order reference created. ${supabase.reason}`,
      paymentMode: "manual",
      whatsappLink: waLink,
      orderEmail,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      taxRate: order.taxRate,
      taxMode: order.taxMode,
      taxLabel: order.taxLabel,
      taxCountry: order.taxCountry,
      taxNote: order.taxNote,
      total: order.total,
      nextSteps: paymentInstructions(order.paymentMethod, reference, order.total),
      stripeReady: stripeEnabled(),
      paynowReady: paynowEnabled(),
      hasProductFiles: downloadHints.length > 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Order creation failed.";
    await recordServerEvent("payment_error", { provider: "checkout", stage: "order_creation" });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const ref = new URL(req.url).searchParams.get("ref");
  if (!ref) {
    return NextResponse.json({ error: "Missing ref" }, { status: 400 });
  }
  const { loadOrderLocal } = await import("@/lib/orders");
  const order = await loadOrderLocal(ref);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  return NextResponse.json({
    reference: order.reference,
    status: order.status,
    subtotal: order.subtotal,
    taxAmount: order.taxAmount || 0,
    taxRate: order.taxRate || 0,
    taxLabel: order.taxLabel,
    taxCountry: order.taxCountry,
    taxNote: order.taxNote,
    total: order.total,
    paymentMethod: order.paymentMethod,
    items: order.items.map((i) => ({ title: i.title, price: i.price, quantity: i.quantity })),
  });
}
