import { NextResponse } from "next/server";
import { stripeEnabled } from "@/lib/stripe";
import { paynowEnabled } from "@/lib/paynow";

export async function GET() {
  return NextResponse.json({
    stripeEnabled: stripeEnabled(),
    paynowEnabled: paynowEnabled(),
    currency: "USD",
    whatsapp: process.env.NEXT_PUBLIC_BVS_WHATSAPP || "+4917664006205",
    orderEmail: process.env.BVS_ORDER_EMAIL || "abiaschivayo3@gmail.com",
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
