export type MarketplaceProductType =
  | "single"
  | "mix"
  | "album"
  | "beat"
  | "creator_product"
  | "creator_service"
  | "service"
  | "physical";

export type ProcessorFeePreset = {
  id: string;
  label: string;
  provider: "stripe" | "paynow" | "manual";
  percent: number;
  fixed: number;
  fixedCurrency: "USD" | "EUR";
  status: "actual_schedule" | "illustrative" | "manual";
  note: string;
};

export const MARKETPLACE_POLICY_VERSION = "2026-08-08-v1";
export const MARKETPLACE_POLICY_EFFECTIVE_AT = "2026-08-08T00:00:00Z";
export const MARKETPLACE_BASKET_TARGET_USD = 5;

export const PROCESSOR_FEE_PRESETS: ProcessorFeePreset[] = [
  {
    id: "stripe_bvs_observed_usd",
    label: "Stripe · BVS observed USD pattern",
    provider: "stripe",
    percent: 2.9,
    fixed: 0.3,
    fixedCurrency: "USD",
    status: "illustrative",
    note: "Illustrative only. Book actual Stripe settlement fee when available.",
  },
  {
    id: "paynow_visa",
    label: "Paynow · Visa",
    provider: "paynow",
    percent: 3.5,
    fixed: 0.5,
    fixedCurrency: "USD",
    status: "actual_schedule",
    note: "Paynow published merchant schedule: 3.5% + US$0.50.",
  },
  {
    id: "paynow_mastercard",
    label: "Paynow · Mastercard",
    provider: "paynow",
    percent: 3.5,
    fixed: 0.5,
    fixedCurrency: "USD",
    status: "actual_schedule",
    note: "Paynow published merchant schedule: 3.5% + US$0.50.",
  },
  {
    id: "paynow_vpayments",
    label: "Paynow · Vpayments",
    provider: "paynow",
    percent: 1,
    fixed: 0.5,
    fixedCurrency: "USD",
    status: "actual_schedule",
    note: "Paynow published merchant schedule: 1% + US$0.50.",
  },
  {
    id: "paynow_ecocash",
    label: "Paynow · EcoCash",
    provider: "paynow",
    percent: 2.5,
    fixed: 0,
    fixedCurrency: "USD",
    status: "actual_schedule",
    note: "Paynow published merchant schedule: 2.5%.",
  },
  {
    id: "paynow_onemoney",
    label: "Paynow · OneMoney",
    provider: "paynow",
    percent: 2.5,
    fixed: 0,
    fixedCurrency: "USD",
    status: "actual_schedule",
    note: "Paynow published merchant schedule: 2.5%.",
  },
  {
    id: "paynow_telecash",
    label: "Paynow · Telecash",
    provider: "paynow",
    percent: 2.5,
    fixed: 0,
    fixedCurrency: "USD",
    status: "actual_schedule",
    note: "Paynow published merchant schedule: 2.5%.",
  },
];

export type CommissionPolicyInput = {
  productType: MarketplaceProductType;
  unitAmount: number;
  sellerPlanId?: string | null;
};

/**
 * Founder-approved marketplace fee policy.
 * Commission is always calculated on pre-tax product revenue, never VAT/tax.
 */
export function marketplaceCommissionBps(
  input: CommissionPolicyInput,
): number | null {
  const plan = String(input.sellerPlanId || "").toLowerCase();

  if (input.productType === "beat" || input.productType === "creator_product") {
    if (plan.includes("producer_pro") || plan.includes("creator_complete"))
      return 300;
    if (plan.includes("producer_plus")) return 800;
    return 1500;
  }

  if (
    input.productType === "service" ||
    input.productType === "creator_service"
  ) {
    if (plan === "studio") return 500;
    if (plan.includes("service_pro")) return 800;
    return 1500;
  }

  if (input.productType === "single" || input.productType === "mix") {
    if (
      plan.includes("artist_founding") ||
      plan.includes("artist_standard") ||
      plan.includes("artist_plus") ||
      plan.includes("creator_complete")
    )
      return 1500;
    return 2000;
  }

  if (input.productType === "album") return 1500;

  // Physical commerce has not launched; do not invent a live rate.
  return null;
}

export function processorFeeFromPreset(
  totalCharged: number,
  presetId: string,
): number | null {
  const preset = PROCESSOR_FEE_PRESETS.find((item) => item.id === presetId);
  if (!preset || preset.fixedCurrency !== "USD") return null;
  const amount = Number(totalCharged);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return (
    Math.round((amount * (preset.percent / 100) + preset.fixed) * 100) / 100
  );
}

export type MarketplaceCalculationInput = {
  productPrice: number;
  taxRatePercent?: number;
  commissionBps: number;
  processorFee: number;
  processorAllocatedToSeller?: number;
};

export type MarketplaceCalculation = {
  productPrice: number;
  tax: number;
  customerTotal: number;
  commission: number;
  processorFee: number;
  processorAllocatedToSeller: number;
  sellerNet: number;
  bvsContributionAfterProcessing: number;
};

export function calculateMarketplaceEconomics(
  input: MarketplaceCalculationInput,
): MarketplaceCalculation {
  const productPrice = Math.max(0, Number(input.productPrice) || 0);
  const taxRate = Math.max(0, Number(input.taxRatePercent) || 0) / 100;
  const processorFee = Math.max(0, Number(input.processorFee) || 0);
  const processorAllocatedToSeller = Math.max(
    0,
    Number(input.processorAllocatedToSeller ?? processorFee) || 0,
  );
  const commission =
    Math.round(
      productPrice * (Math.max(0, input.commissionBps) / 10000) * 100,
    ) / 100;
  const tax = Math.round(productPrice * taxRate * 100) / 100;
  const sellerNet = Math.max(
    0,
    Math.round((productPrice - commission - processorAllocatedToSeller) * 100) /
      100,
  );
  const bvsContributionAfterProcessing =
    Math.round(
      (commission - Math.max(0, processorFee - processorAllocatedToSeller)) *
        100,
    ) / 100;

  return {
    productPrice,
    tax,
    customerTotal: Math.round((productPrice + tax) * 100) / 100,
    commission,
    processorFee,
    processorAllocatedToSeller,
    sellerNet,
    bvsContributionAfterProcessing,
  };
}

export function producerUpgradeBreakEvenUsd(
  monthlyPrice: number,
  commissionSavingsPercent: number,
) {
  if (monthlyPrice <= 0 || commissionSavingsPercent <= 0) return null;
  return (
    Math.round((monthlyPrice / (commissionSavingsPercent / 100)) * 100) / 100
  );
}

export const MARKETPLACE_POLICY_SUMMARY = {
  version: MARKETPLACE_POLICY_VERSION,
  effectiveAt: MARKETPLACE_POLICY_EFFECTIVE_AT,
  basketTargetUsd: MARKETPLACE_BASKET_TARGET_USD,
  rules: [
    "BVS commission is calculated on pre-tax product price only.",
    "VAT/sales tax is a liability and is never commissionable.",
    "Actual payment-processing cost is allocated to seller proceeds by default.",
    "BVS may subsidize processing only through an explicit, measured promotion or Premium benefit.",
    "Refunds and chargebacks reverse seller earnings before payout.",
    "Historical transactions keep the policy snapshot applied at purchase unless an authorized adjustment is recorded.",
  ],
};
