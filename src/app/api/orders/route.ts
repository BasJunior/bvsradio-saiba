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
import {
  getPaynow,
  humanizePaynowError,
  normalizeZwPhone,
  paynowAuthEmail,
  paynowEnabled,
} from "@/lib/paynow";
import { createDownloadToken, resolveProductAsset } from "@/lib/products";
import { recordServerEvent } from "@/lib/analytics-server";
import { calculateTax, stripeAutomaticTaxEnabled } from "@/lib/tax";
import { recordOrderSnapshot, resolveCommerceItems } from "@/lib/commerce-ledger";

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

async function currentUserId(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!token || !url || !anon) return undefined
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!response.ok) return undefined
  const user = await response.json() as { id?: string }
  return user.id
}

export async function POST(req: Request) {
  try {
    const customerUserId = await currentUserId(req);
    const payload = parseBody(await req.json());
    if (!payload) {
      return NextResponse.json({ error: "Invalid order payload." }, { status: 400 });
    }
    if (payload.items.length === 0) {
      return NextResponse.json({ error: "Add at least one item before checkout." }, { status: 400 });
    }

    let trustedItems;
    try {
      trustedItems = await resolveCommerceItems(payload.items);
    } catch {
      return NextResponse.json({ error: "One or more products are no longer available." }, { status: 409 });
    }

    // Net subtotal from line items (authoritative)
    const subtotal = Number(
      trustedItems
        .reduce((sum, item) => sum + item.price * item.quantity, 0)
        .toFixed(2),
    );
    if (subtotal <= 0) {
      return NextResponse.json({ error: "Order total must be greater than zero." }, { status: 400 });
    }

    // Customer checkout only accepts live rails (Paynow web + Stripe card).
    // Manual WhatsApp / bank / PayPal / EcoCash-push labels are not orderable here.
    const method = String(payload.paymentMethod || "").toLowerCase();
    const allowedCheckout = new Set(["paynow", "paynow_redirect", "card", "stripe"]);
    if (!allowedCheckout.has(method) && payload.createStripeSession !== true) {
      return NextResponse.json(
        {
          error:
            "Choose Paynow or international card to pay online. For invoices or studio bank details, contact BVS.",
        },
        { status: 400 },
      );
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
      customerUserId,
      createdAt: new Date().toISOString(),
      customer: {
        ...payload.customer,
        country: tax.countryCode,
        vatId: vatId || undefined,
      },
      items: trustedItems,
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
    if (!supabase.saved) {
      return NextResponse.json({ error: "Checkout is temporarily unavailable. No payment was started." }, { status: 503 });
    }
    try {
      await recordOrderSnapshot(reference, trustedItems);
    } catch {
      return NextResponse.json({ error: "Checkout is temporarily unavailable. No payment was started." }, { status: 503 });
    }

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
            customer_user_id: customerUserId || "",
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
            : "Order created. Continue to secure card payment.",
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
        // Web redirect: omit customer email in test mode (see paynowAuthEmail).
        // Mobile EcoCash still needs a valid email — pin merchant email when set.
        const authEmail = wantsEcoCashPush
          ? paynowAuthEmail(order.customer.email) || order.customer.email || ""
          : paynowAuthEmail(order.customer.email);
        const payment = paynow.createPayment(reference, authEmail);
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

        let paynowFailure: string | null = null;

        try {
          if (wantsEcoCashPush) {
            const phone =
              normalizeZwPhone(order.customer.whatsapp || "") ||
              normalizeZwPhone((payload as { phone?: string }).phone || "");
            if (phone && authEmail) {
              const response = await paynow.sendMobile(payment, phone, "ecocash");
              if (response?.success) {
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
              paynowFailure =
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (response as any)?.error || "EcoCash push was not accepted by Paynow.";
              console.error("Paynow sendMobile failed", paynowFailure);
            }
            // fall through to redirect checkout if push failed / no ZW phone
          }

          const response = await paynow.send(payment);
          const redirectUrl =
            response?.redirectUrl ||
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (response as any)?.browserurl ||
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (response as any)?.browserUrl;
          if (response?.success && redirectUrl) {
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
              checkoutUrl: String(redirectUrl),
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
          paynowFailure =
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (response as any)?.error || paynowFailure || "Paynow did not return a payment link.";
          console.error("Paynow send failed", paynowFailure, {
            success: response?.success,
            hasRedirect: Boolean(redirectUrl),
          });
        } catch (paynowErr) {
          console.error("Paynow error", paynowErr);
          paynowFailure =
            paynowErr instanceof Error ? paynowErr.message : "Paynow request failed";
          await recordServerEvent("payment_error", { provider: "paynow", stage: "checkout_creation" });
        }

        // Explicit Paynow/EcoCash choice must not silently become WhatsApp-only.
        if (wantsPaynow || payload.paymentMethod === "paynow_ecocash" || payload.paymentMethod === "ecocash") {
          await recordServerEvent("payment_error", {
            provider: "paynow",
            stage: "checkout_no_redirect",
          });
          try {
            await saveOrderLocal(order);
          } catch {
            /* ignore */
          }
          return NextResponse.json(
            {
              error: humanizePaynowError(paynowFailure),
              reference,
              paymentMode: "paynow_failed",
              paynowReady: true,
              detail: process.env.NODE_ENV === "development" ? paynowFailure : undefined,
            },
            { status: 502 },
          );
        }
      }
    }

    await notifyOwnerNewOrder(order);

    const whatsapp = process.env.NEXT_PUBLIC_BVS_WHATSAPP || "+491706580888";
    const orderEmail = process.env.BVS_ORDER_EMAIL || "contact@bvsradio.com";
    const waLink = whatsapp
      ? `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
          `Hi BVS, I placed order ${reference} ($${order.total.toFixed(2)}). Email: ${order.customer.email}`,
        )}`
      : null;

    // Prepare download tokens once paid (preview links only after paid — stored for staff)
    const downloadHints: string[] = [];
    for (const item of order.items) {
      const asset = await resolveProductAsset(item.id, item.title);
      if (asset) {
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
        : "Order created. Complete payment using the steps below.",
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
    console.error("Order creation failed", error);
    await recordServerEvent("payment_error", { provider: "checkout", stage: "order_creation" });
    return NextResponse.json({ error: "Order creation failed. Please try again or contact BVS with your cart." }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const ref = new URL(req.url).searchParams.get("ref");
  if (!ref) {
    return NextResponse.json({ error: "Missing ref" }, { status: 400 });
  }
  const { loadOrder } = await import("@/lib/orders");
  const order = await loadOrder(ref);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  return NextResponse.json({
    reference: order.reference,
    status: order.status,
    deliveryStatus: order.deliveryStatus,
    subtotal: order.subtotal,
    taxAmount: order.taxAmount || 0,
    taxRate: order.taxRate || 0,
    taxLabel: order.taxLabel,
    total: order.total,
    currency: order.currency || "USD",
    paymentMethod: order.paymentMethod,
  });
}
