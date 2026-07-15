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
  subtotal: number;
  total: number;
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
    typeof c.paymentMethod !== "string" ||
    typeof c.subtotal !== "number" ||
    typeof c.total !== "number"
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
    if (payload.total <= 0) {
      return NextResponse.json({ error: "Order total must be greater than zero." }, { status: 400 });
    }

    const reference = orderReference();
    const wantsCard =
      payload.paymentMethod === "card" ||
      payload.paymentMethod === "stripe" ||
      payload.createStripeSession === true;

    const order: StoredOrder = {
      reference,
      createdAt: new Date().toISOString(),
      customer: payload.customer,
      items: payload.items,
      paymentMethod: payload.paymentMethod,
      projectNotes: payload.projectNotes,
      subtotal: payload.subtotal,
      total: payload.total,
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
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: order.customer.email,
          client_reference_id: reference,
          metadata: {
            reference,
            customer_name: order.customer.name,
            whatsapp: order.customer.whatsapp || "",
          },
          line_items: order.items.map((item) => ({
            quantity: item.quantity,
            price_data: {
              currency: "usd",
              unit_amount: Math.round(item.price * 100),
              product_data: {
                name: item.title,
                description: `${item.type}${item.artist ? ` · ${item.artist}` : ""} · ${reference}`,
              },
            },
          })),
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
              nextSteps: paymentInstructions("paynow", reference, order.total),
              paynowReady: true,
            });
          }
        } catch (paynowErr) {
          console.error("Paynow error", paynowErr);
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
      nextSteps: paymentInstructions(order.paymentMethod, reference, order.total),
      stripeReady: stripeEnabled(),
      paynowReady: paynowEnabled(),
      hasProductFiles: downloadHints.length > 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Order creation failed.";
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
    total: order.total,
    paymentMethod: order.paymentMethod,
    items: order.items.map((i) => ({ title: i.title, price: i.price, quantity: i.quantity })),
  });
}
