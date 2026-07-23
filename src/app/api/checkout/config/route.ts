import { NextResponse } from "next/server";
import { stripeEnabled } from "@/lib/stripe";
import { paynowEnabled } from "@/lib/paynow";
import { TAX_COUNTRIES, stripeAutomaticTaxEnabled } from "@/lib/tax";

export async function GET() {
  return NextResponse.json({
    stripeEnabled: stripeEnabled(),
    paynowEnabled: paynowEnabled(),
    currency: "USD",
    whatsapp: process.env.NEXT_PUBLIC_BVS_WHATSAPP || "+4917664006205",
    orderEmail: process.env.BVS_ORDER_EMAIL || "contact@bvsradio.com",
    tax: {
      enabled: true,
      mode: stripeAutomaticTaxEnabled() ? "stripe_automatic" : "region_table",
      automatic: stripeAutomaticTaxEnabled(),
      provider: stripeAutomaticTaxEnabled()
        ? "stripe_tax"
        : stripeEnabled()
          ? "bvs_region_rates"
          : "bvs_region_rates",
      note: "Tax is estimated from your billing country. Server recalculates at order time.",
      countries: TAX_COUNTRIES.map((c) => ({
        code: c.code,
        name: c.name,
        ratePercent: Math.round(c.rate * 1000) / 10,
        label: c.label,
      })),
    },
    methods: {
      card: stripeEnabled(),
      paynow: paynowEnabled(),
      ecocash: paynowEnabled(),
      mobile_money: true,
      manual_bank: true,
      paypal: true,
    },
  });
}
