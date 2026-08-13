import "server-only";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const headers = {
  apikey: service,
  Authorization: `Bearer ${service}`,
  "Content-Type": "application/json",
};

export async function initializePaidCreatorServiceOrder(reference: string) {
  if (!url || !service || !reference)
    return { created: false, reason: "not_configured" };
  const orderResponse = await fetch(
    `${url}/rest/v1/orders?reference=eq.${encodeURIComponent(reference)}&status=in.(paid,fulfilled)&select=id,reference,customer_user_id,project_notes&limit=1`,
    { headers, cache: "no-store" },
  );
  const order = orderResponse.ok ? (await orderResponse.json())[0] : null;
  if (!order?.id || !order.customer_user_id)
    return { created: false, reason: "order_not_ready" };
  const lineResponse = await fetch(
    `${url}/rest/v1/commerce_order_items?order_id=eq.${order.id}&product_type_snapshot=eq.creator_service&select=unit_amount,quantity,title_snapshot,seller_user_id_snapshot,commerce_products!inner(source_id)&limit=1`,
    { headers, cache: "no-store" },
  );
  const line = lineResponse.ok ? (await lineResponse.json())[0] : null;
  const listingId = line?.commerce_products?.source_id;
  if (!line?.seller_user_id_snapshot || !listingId)
    return { created: false, reason: "not_creator_service" };
  const listingResponse = await fetch(
    `${url}/rest/v1/creator_marketplace_listings?id=eq.${listingId}&select=id,packages,turnaround_days,revisions_included&limit=1`,
    { headers, cache: "no-store" },
  );
  const listing = listingResponse.ok ? (await listingResponse.json())[0] : null;
  if (!listing) return { created: false, reason: "listing_missing" };
  const response = await fetch(
    `${url}/rest/v1/creator_service_orders?on_conflict=order_id`,
    {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "resolution=ignore-duplicates,return=representation",
      },
      body: JSON.stringify({
        order_id: order.id,
        order_reference: order.reference,
        listing_id: listing.id,
        buyer_user_id: order.customer_user_id,
        seller_user_id: line.seller_user_id_snapshot,
        title_snapshot: line.title_snapshot,
        package_snapshot: Array.isArray(listing.packages)
          ? listing.packages[0] || {}
          : {},
        brief: String(order.project_notes || "").slice(0, 5000),
        amount_usd: Number(line.unit_amount) * Number(line.quantity || 1),
        revisions_included: Number(listing.revisions_included || 0),
        seller_due_at: new Date(
          Date.now() +
            Math.max(1, Number(listing.turnaround_days || 7)) * 86400000,
        ).toISOString(),
      }),
    },
  );
  return {
    created: response.ok,
    reason: response.ok ? undefined : "service_order_save_failed",
  };
}

export async function releaseCompletedCreatorService(orderId: string) {
  if (!url || !service) return false;
  const response = await fetch(
    `${url}/rest/v1/rpc/release_creator_service_earnings`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ p_service_order_id: orderId }),
    },
  );
  return response.ok && (await response.json()) === true;
}
