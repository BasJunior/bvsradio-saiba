import { NextResponse } from "next/server";
import {
  editorialIdentity,
  editorialUrl,
  serviceHeaders,
} from "@/lib/editorial-server";
import {
  MARKETPLACE_POLICY_SUMMARY,
  MARKETPLACE_POLICY_VERSION,
  PROCESSOR_FEE_PRESETS,
  marketplaceCommissionBps,
  producerUpgradeBreakEvenUsd,
} from "@/lib/marketplace-economics";

type Row = Record<string, unknown>;

async function requiredRows(path: string): Promise<Row[]> {
  const response = await fetch(editorialUrl(path), {
    headers: serviceHeaders,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`finance source ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

async function optionalRows(
  path: string,
): Promise<{ rows: Row[]; available: boolean }> {
  try {
    const response = await fetch(editorialUrl(path), {
      headers: serviceHeaders,
      cache: "no-store",
    });
    if (!response.ok) return { rows: [], available: false };
    const payload = await response.json();
    return { rows: Array.isArray(payload) ? payload : [], available: true };
  } catch {
    return { rows: [], available: false };
  }
}

function money(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function itemValue(item: unknown) {
  if (!item || typeof item !== "object") return 0;
  const row = item as Record<string, unknown>;
  return (
    money(row.price ?? row.unitAmount ?? row.unit_amount) *
    Math.max(1, money(row.quantity) || 1)
  );
}

function isMarketplaceItem(item: unknown) {
  if (!item || typeof item !== "object") return false;
  const row = item as Record<string, unknown>;
  return [
    "single",
    "mix",
    "album",
    "beat",
    "creator_product",
    "creator_service",
  ].includes(
    String(row.productType || row.product_type || row.type || "").toLowerCase(),
  );
}

function isoStartOfMonth(now: Date) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

function isoStartOfQuarter(now: Date) {
  const month = Math.floor(now.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(now.getUTCFullYear(), month, 1)).toISOString();
}

function membershipMrr(row: Row) {
  const plan = String(row.plan_id || "").toLowerCase();
  const interval = String(row.billing_interval || "").toLowerCase();
  const annual = interval === "year";
  if (plan.includes("founding")) return annual ? 90 / 12 : 9;
  if (plan.includes("standard") || plan.includes("artist"))
    return annual ? 120 / 12 : 12;
  return 0;
}

function uniqueOrderProcessorFees(rows: Row[]) {
  const byOrder = new Map<string, number>();
  for (const row of rows) {
    const key = String(row.order_id || row.order_reference || "");
    const amount = money(row.order_processor_fee_total);
    if (key && amount > 0 && !byOrder.has(key)) byOrder.set(key, amount);
  }
  return [...byOrder.values()].reduce((sum, amount) => sum + amount, 0);
}

export async function GET(request: Request) {
  const identity = await editorialIdentity(request);
  if (!identity) {
    return NextResponse.json(
      { error: "Active Editorial staff access is required." },
      { status: 403 },
    );
  }

  const now = new Date();
  const monthStart = isoStartOfMonth(now);
  const quarterStart = isoStartOfQuarter(now);

  try {
    const [
      orders,
      memberships,
      quarterLedger,
      allLedger,
      paymentEvents,
      newsletter,
      settlements,
      refundEvents,
      policyAudit,
      caseOrder,
    ] = await Promise.all([
      requiredRows(
        `orders?status=in.(paid,fulfilled)&created_at=gte.${encodeURIComponent(quarterStart)}&select=id,reference,subtotal,total,tax_amount,currency,status,payment_method,items,created_at,paid_at&order=created_at.asc&limit=5000`,
      ),
      optionalRows(
        "bvs_memberships?family=eq.artist&status=in.(active,trialing)&select=id,user_id,plan_id,billing_interval,status,provider,starts_at,ends_at&limit=5000",
      ),
      optionalRows(
        `artist_ledger_entries?effective_at=gte.${encodeURIComponent(quarterStart)}&select=direction,entry_type,amount,currency,status,effective_at,source_id,metadata&limit=10000`,
      ),
      optionalRows(
        "artist_ledger_entries?status=eq.posted&select=direction,entry_type,amount,currency&limit=20000",
      ),
      optionalRows(
        `commerce_payment_events?received_at=gte.${encodeURIComponent(quarterStart)}&select=verified,reconciled,reconciliation_error,provider,amount,currency,received_at&limit=5000`,
      ),
      optionalRows(
        "newsletter_subscribers?is_active=eq.true&select=id,subscribed_at&limit=10000",
      ),
      optionalRows(
        `commerce_seller_settlements?created_at=gte.${encodeURIComponent(quarterStart)}&select=id,order_id,order_reference,seller_user_id,provider,policy_version,seller_plan_id,gross_product_revenue,platform_fee_bps,platform_fee_amount,order_processor_fee_total,processor_fee_allocated,processor_fee_status,processor_fee_native_amount,processor_fee_native_currency,seller_net,settlement_status,breakdown,created_at&order=created_at.desc&limit=5000`,
      ),
      optionalRows(
        `commerce_refund_events?created_at=gte.${encodeURIComponent(quarterStart)}&select=id,provider,provider_event_id,order_id,order_reference,event_type,provider_amount,provider_currency,reversal_fraction,created_at&order=created_at.desc&limit=1000`,
      ),
      optionalRows(
        "marketplace_fee_policy_audit?select=id,policy_version,actor_user_id,action,details,created_at&order=created_at.desc&limit=50",
      ),
      optionalRows(
        "orders?reference=eq.BVS-20260807-9MLIC&select=id,reference,subtotal,total,tax_amount,currency,status,payment_method,created_at&limit=1",
      ),
    ]);

    const monthOrders = orders.filter(
      (order) => String(order.created_at || order.paid_at || "") >= monthStart,
    );
    const marketplaceValue = (source: Row[]) =>
      source.reduce((sum, order) => {
        const items = Array.isArray(order.items) ? order.items : [];
        return (
          sum +
          items
            .filter(isMarketplaceItem)
            .reduce((lineSum, item) => lineSum + itemValue(item), 0)
        );
      }, 0);
    const marketplaceOrders = (source: Row[]) =>
      source.filter((order) => {
        const items = Array.isArray(order.items) ? order.items : [];
        return items.some(isMarketplaceItem);
      });

    const quarterGmv = orders.reduce(
      (sum, order) => sum + money(order.subtotal),
      0,
    );
    const quarterCheckout = orders.reduce(
      (sum, order) => sum + money(order.total),
      0,
    );
    const quarterTax = orders.reduce(
      (sum, order) => sum + money(order.tax_amount),
      0,
    );
    const quarterArtistCredits = quarterLedger.rows
      .filter(
        (row) =>
          row.direction === "credit" &&
          row.entry_type === "sale_credit" &&
          row.status === "posted",
      )
      .reduce((sum, row) => sum + money(row.amount), 0);
    const pendingArtistCredits = quarterLedger.rows
      .filter(
        (row) =>
          row.direction === "credit" &&
          row.entry_type === "sale_credit" &&
          row.status === "pending",
      )
      .reduce((sum, row) => sum + money(row.amount), 0);
    const quarterRefundDebits = quarterLedger.rows
      .filter(
        (row) =>
          row.direction === "debit" &&
          ["refund_debit", "reversal_debit"].includes(String(row.entry_type)),
      )
      .reduce((sum, row) => sum + money(row.amount), 0);
    const walletLiability = allLedger.rows.reduce(
      (sum, row) =>
        sum +
        (row.direction === "credit" ? money(row.amount) : -money(row.amount)),
      0,
    );
    const reconciledEvents = paymentEvents.rows.filter(
      (row) => row.verified === true && row.reconciled === true,
    ).length;

    const platformFees = settlements.rows
      .filter((row) => row.settlement_status === "posted")
      .reduce((sum, row) => sum + money(row.platform_fee_amount), 0);
    const sellerProcessorFees = settlements.rows
      .filter((row) => row.settlement_status === "posted")
      .reduce((sum, row) => sum + money(row.processor_fee_allocated), 0);
    const actualOrderProcessorFees = uniqueOrderProcessorFees(
      settlements.rows.filter(
        (row) =>
          row.processor_fee_status === "actual" ||
          row.processor_fee_status === "schedule",
      ),
    );
    const bvsAbsorbedProcessor = Math.max(
      0,
      actualOrderProcessorFees - sellerProcessorFees,
    );

    let legacyCaseCredit: Row | null = null;
    const caseOrderRow = caseOrder.rows[0];
    if (caseOrderRow?.id) {
      const legacy = await optionalRows(
        `artist_ledger_entries?source_table=eq.orders&source_id=eq.${caseOrderRow.id}&entry_type=eq.sale_credit&select=id,artist_user_id,amount,currency,status,metadata,effective_at&limit=5`,
      );
      legacyCaseCredit = legacy.rows[0] || null;
    }

    const canMutatePolicy = [
      "founder",
      "administrator",
      "commerce_manager",
    ].includes(String(identity.role));

    const marketplaceExamples = [
      {
        id: "single_2",
        label: "$2 single · Artist Free",
        productType: "single",
        price: 2,
        sellerPlanId: "artist_free",
        revenueModel: "marketplace",
      },
      {
        id: "track_4",
        label: "$4 track / archive / mix · Artist Free",
        productType: "mix",
        price: 4,
        sellerPlanId: "artist_free",
        revenueModel: "marketplace",
      },
      {
        id: "track_4_premium",
        label: "$4 track · Artist Premium",
        productType: "mix",
        price: 4,
        sellerPlanId: "artist_standard",
        revenueModel: "marketplace",
      },
      {
        id: "album_14",
        label: "$14 album",
        productType: "album",
        price: 14,
        sellerPlanId: "artist_free",
        revenueModel: "marketplace",
      },
      {
        id: "album_19",
        label: "$19 album",
        productType: "album",
        price: 19,
        sellerPlanId: "artist_free",
        revenueModel: "marketplace",
      },
      {
        id: "beat_free",
        label: "$29 beat · Producer Free",
        productType: "beat",
        price: 29,
        sellerPlanId: "producer_free",
        revenueModel: "marketplace",
      },
      {
        id: "beat_plus",
        label: "$29 beat · Producer Plus",
        productType: "beat",
        price: 29,
        sellerPlanId: "producer_plus",
        revenueModel: "marketplace",
      },
      {
        id: "beat_pro",
        label: "$29 beat · Producer Pro",
        productType: "beat",
        price: 29,
        sellerPlanId: "producer_pro",
        revenueModel: "marketplace",
      },
      {
        id: "creator_product_free",
        label: "$15 creator product · Producer Free",
        productType: "creator_product",
        price: 15,
        sellerPlanId: "producer_free",
        revenueModel: "marketplace",
      },
      {
        id: "creator_product_plus",
        label: "$15 creator product · Producer Plus",
        productType: "creator_product",
        price: 15,
        sellerPlanId: "producer_plus",
        revenueModel: "marketplace",
      },
      {
        id: "creator_product_pro",
        label: "$15 creator product · Producer Pro",
        productType: "creator_product",
        price: 15,
        sellerPlanId: "producer_pro",
        revenueModel: "marketplace",
      },
      {
        id: "service_free",
        label: "$69 creator service · Free provider",
        productType: "creator_service",
        price: 69,
        sellerPlanId: "service_free",
        revenueModel: "marketplace",
      },
      {
        id: "service_pro",
        label: "$69 creator service · Service Pro",
        productType: "creator_service",
        price: 69,
        sellerPlanId: "service_pro",
        revenueModel: "marketplace",
      },
      {
        id: "studio",
        label: "$69 creator service · Studio",
        productType: "creator_service",
        price: 69,
        sellerPlanId: "studio",
        revenueModel: "marketplace",
      },
    ].map((item) => ({
      ...item,
      commissionBps: marketplaceCommissionBps({
        productType: item.productType as
          | "single"
          | "mix"
          | "album"
          | "beat"
          | "creator_product"
          | "creator_service",
        unitAmount: item.price,
        sellerPlanId: item.sellerPlanId,
      }),
      processorAllocation: "seller" as const,
    }));

    const exampleCards = [
      ...marketplaceExamples,
      {
        id: "artist_standard_subscription",
        label: "$12 Artist Premium · monthly",
        productType: "subscription",
        price: 12,
        sellerPlanId: "bvs",
        revenueModel: "bvs_subscription",
        commissionBps: 10000,
        processorAllocation: "bvs" as const,
        note: "BVS subscription revenue. There is no creator marketplace split; BVS absorbs the payment-processing cost.",
      },
      {
        id: "artist_founding_subscription",
        label: "$9 Founding Artist Premium · monthly",
        productType: "subscription",
        price: 9,
        sellerPlanId: "bvs",
        revenueModel: "bvs_subscription",
        commissionBps: 10000,
        processorAllocation: "bvs" as const,
        note: "Founding subscription revenue while the founding offer remains open.",
      },
      {
        id: "physical_future",
        label: "$25 future physical product example",
        productType: "physical",
        price: 25,
        sellerPlanId: "future",
        revenueModel: "future",
        commissionBps: null,
        processorAllocation: "unknown" as const,
        note: "No approved physical-goods fee yet. Shipping, returns and fulfilment economics must be designed before launch.",
      },
    ];

    const feeTable = [
      {
        client: "Artist Free",
        subscription: "$0",
        product: "Low-ticket BVS music",
        platformFee: "20%",
        processing: "Separate from creator proceeds",
      },
      {
        client: "Artist Premium",
        subscription: "$12/mo · $120/yr",
        product: "Eligible BVS music",
        platformFee: "15%",
        processing: "Separate from creator proceeds",
      },
      {
        client: "Producer Free",
        subscription: "$0",
        product: "Beat licences",
        platformFee: "15%",
        processing: "Separate from producer proceeds",
      },
      {
        client: "Producer Plus",
        subscription: "$5/mo · $50/yr",
        product: "Beat licences",
        platformFee: "8%",
        processing: "Separate from producer proceeds",
      },
      {
        client: "Producer Pro",
        subscription: "$10/mo · $100/yr",
        product: "Beat licences",
        platformFee: "3%",
        processing: "Separate from producer proceeds",
      },
      {
        client: "Creator Complete",
        subscription: "$19/mo · $190/yr · later",
        product: "Beats / eligible music",
        platformFee: "3% beats · 15% music",
        processing: "Separate from creator proceeds",
      },
      {
        client: "Service Free",
        subscription: "$0 · later",
        product: "Marketplace services",
        platformFee: "15%",
        processing: "Separate from provider proceeds",
      },
      {
        client: "Service Pro",
        subscription: "$8/mo · $80/yr · later",
        product: "Marketplace services",
        platformFee: "8%",
        processing: "Separate from provider proceeds",
      },
      {
        client: "Studio",
        subscription: "$15/mo · $150/yr · later",
        product: "Marketplace services",
        platformFee: "5%",
        processing: "Separate from provider proceeds",
      },
      {
        client: "BVS Supporter",
        subscription: "$3/mo · $30/yr · pilot",
        product: "Station support",
        platformFee: "N/A",
        processing: "BVS subscription cost",
      },
      {
        client: "Team / Label",
        subscription: "Invite pilot only",
        product: "Roster tools",
        platformFee: "Validate",
        processing: "Do not lock before unit economics",
      },
    ];

    const orderById = new Map(orders.map((order) => [String(order.id), order]));
    const recentSettlements = settlements.available
      ? settlements.rows.slice(0, 50).map((row) => {
          const order = orderById.get(String(row.order_id));
          return {
            ...row,
            order_subtotal: order?.subtotal ?? null,
            order_tax_amount: order?.tax_amount ?? null,
            order_total: order?.total ?? null,
          };
        })
      : [];

    return NextResponse.json({
      generatedAt: now.toISOString(),
      role: identity.role,
      canMutatePolicy,
      period: {
        monthStart,
        quarterStart,
        quarter: `Q${Math.floor(now.getUTCMonth() / 3) + 1} ${now.getUTCFullYear()}`,
      },
      current: {
        paidArtists: memberships.available
          ? memberships.rows.filter((row) => Boolean(row.provider)).length
          : null,
        activeArtistMemberships: memberships.available
          ? memberships.rows.length
          : null,
        subscriptionMrr: memberships.available
          ? memberships.rows
              .filter((row) => Boolean(row.provider))
              .reduce((sum, row) => sum + membershipMrr(row), 0)
          : null,
        newsletterSubscribers: newsletter.available
          ? newsletter.rows.length
          : null,
        monthMarketplaceGmv: marketplaceValue(monthOrders),
        monthMarketplaceOrders: marketplaceOrders(monthOrders).length,
        quarterMarketplaceGmv: marketplaceValue(orders),
        quarterMarketplaceOrders: marketplaceOrders(orders).length,
      },
      accounting: {
        quarterGmv,
        quarterCheckout,
        quarterTax,
        quarterArtistSaleCredits: quarterLedger.available
          ? quarterArtistCredits
          : null,
        pendingArtistSaleCredits: quarterLedger.available
          ? pendingArtistCredits
          : null,
        quarterRefundDebits: quarterLedger.available
          ? quarterRefundDebits
          : null,
        contributionBeforeProcessor: settlements.available
          ? platformFees
          : quarterLedger.available
            ? quarterGmv - quarterArtistCredits
            : null,
        walletLiability: allLedger.available ? walletLiability : null,
        processorFees: settlements.available ? actualOrderProcessorFees : null,
        sellerProcessorFees: settlements.available ? sellerProcessorFees : null,
        bvsAbsorbedProcessor: settlements.available
          ? bvsAbsorbedProcessor
          : null,
        bvsPlatformFees: settlements.available ? platformFees : null,
        contributionAfterProcessor: settlements.available
          ? platformFees - bvsAbsorbedProcessor
          : null,
        grossProfit: null,
      },
      controls: {
        paidOrders: orders.length,
        verifiedPaymentEvents: paymentEvents.available
          ? paymentEvents.rows.filter((row) => row.verified === true).length
          : null,
        reconciledPaymentEvents: paymentEvents.available
          ? reconciledEvents
          : null,
        unresolvedPaymentEvents: paymentEvents.available
          ? paymentEvents.rows.filter((row) => row.reconciled !== true).length
          : null,
        pendingProcessorSettlements: settlements.available
          ? settlements.rows.filter(
              (row) => row.settlement_status === "pending_processor",
            ).length
          : null,
        refundEvents: refundEvents.available ? refundEvents.rows.length : null,
      },
      policy: {
        ...MARKETPLACE_POLICY_SUMMARY,
        version: MARKETPLACE_POLICY_VERSION,
        processorPresets: PROCESSOR_FEE_PRESETS,
        examples: exampleCards,
        feeTable,
        audit: policyAudit.available ? policyAudit.rows : [],
        producerBreakEven: {
          freeToPlusMonthlyGmv: producerUpgradeBreakEvenUsd(5, 7),
          plusToProMonthlyGmv: producerUpgradeBreakEvenUsd(10, 5),
        },
        creatorComplete: { monthlyUsd: 19, yearlyUsd: 190, status: "later" },
      },
      recentSettlements,
      recentRefundEvents: refundEvents.available
        ? refundEvents.rows.slice(0, 50)
        : [],
      caseStudy: {
        reference: "BVS-20260807-9MLIC",
        found: Boolean(caseOrderRow),
        order: caseOrderRow || null,
        knownHistorical: {
          customerPaid: 4.76,
          productPrice: 4,
          vat: 0.76,
          proposedCommissionBps: 2000,
          bvsFee: 0.8,
          stripeFeeNative: 0.39,
          stripeFeeNativeCurrency: "EUR",
          stripeFeeApproxUsd: 0.45,
          correctSellerNetApproxUsd: 2.75,
          sourceLabel:
            "Known BVS transaction pattern; USD conversion is approximate unless settlement FX is stored.",
        },
        existingLedgerCredit: legacyCaseCredit,
        legacyWarning:
          legacyCaseCredit && money(legacyCaseCredit.amount) >= 3.99
            ? "Legacy full-price seller credit detected. Do not rewrite history automatically; record a Founder-authorized adjustment if adopted."
            : null,
      },
      guidance: {
        moneyFlow: [
          "Customer payment",
          "VAT / sales tax payable",
          "Pre-tax product revenue",
          "BVS marketplace fee",
          "Processor cost allocation",
          "Creator wallet",
          "Payout",
        ],
        tax: [
          "VAT / sales tax collected from the customer is a tax liability, not BVS revenue.",
          "BVS marketplace commission is calculated only on pre-tax product revenue.",
          "Creator personal income tax is normally the creator’s responsibility after earning or payout.",
          "Do not deduct a guessed withholding percentage until qualified Zimbabwe / Germany advice confirms an obligation.",
        ],
      },
      availability: {
        memberships: memberships.available,
        artistLedger: quarterLedger.available && allLedger.available,
        paymentEvents: paymentEvents.available,
        newsletter: newsletter.available,
        sellerSettlements: settlements.available,
        refundEvents: refundEvents.available,
        policyAudit: policyAudit.available,
        processorFees:
          settlements.available &&
          settlements.rows.some(
            (row) =>
              row.processor_fee_status === "actual" ||
              row.processor_fee_status === "schedule",
          ),
      },
    });
  } catch (error) {
    console.error(
      "Editorial finance dashboard failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "Finance statistics are temporarily unavailable." },
      { status: 503 },
    );
  }
}
