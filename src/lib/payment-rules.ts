/** Paynow is for Zimbabwean buyers only; every other buyer pays through Stripe. */
export function paynowAllowedForCountry(country: unknown) {
  return String(country || "").trim().toUpperCase() === "ZW";
}

/** Premium uses Stripe until BVS_PREMIUM_PAYNOW=true is set after legal review. */
export function premiumPaynowAllowed() {
  return process.env.BVS_PREMIUM_PAYNOW === "true";
}
