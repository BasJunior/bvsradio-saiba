/**
 * Digital-goods tax estimates by buyer country.
 * Prices on the site are treated as tax-exclusive (net); tax is added at checkout.
 * Server always recomputes — never trust client totals alone.
 *
 * Stripe Tax (automatic) can be enabled later via STRIPE_AUTOMATIC_TAX=true
 * when Tax is configured in the Stripe Dashboard.
 */

export type TaxBreakdown = {
  countryCode: string;
  countryName: string;
  /** Display name of the tax (VAT, GST, etc.) */
  taxLabel: string;
  /** Rate as fraction, e.g. 0.19 */
  rate: number;
  /** Percentage for display, e.g. 19 */
  ratePercent: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: string;
  /** How tax was determined */
  mode: "standard" | "zero_rated" | "reverse_charge" | "unknown_region";
  note: string;
};

type CountryTax = {
  code: string;
  name: string;
  rate: number;
  label: string;
};

/** Common buyer regions for BVS (digital downloads + services). */
export const TAX_COUNTRIES: CountryTax[] = [
  { code: "DE", name: "Germany", rate: 0.19, label: "VAT" },
  { code: "AT", name: "Austria", rate: 0.2, label: "VAT" },
  { code: "BE", name: "Belgium", rate: 0.21, label: "VAT" },
  { code: "BG", name: "Bulgaria", rate: 0.2, label: "VAT" },
  { code: "HR", name: "Croatia", rate: 0.25, label: "VAT" },
  { code: "CY", name: "Cyprus", rate: 0.19, label: "VAT" },
  { code: "CZ", name: "Czechia", rate: 0.21, label: "VAT" },
  { code: "DK", name: "Denmark", rate: 0.25, label: "VAT" },
  { code: "EE", name: "Estonia", rate: 0.22, label: "VAT" },
  { code: "FI", name: "Finland", rate: 0.255, label: "VAT" },
  { code: "FR", name: "France", rate: 0.2, label: "VAT" },
  { code: "GR", name: "Greece", rate: 0.24, label: "VAT" },
  { code: "HU", name: "Hungary", rate: 0.27, label: "VAT" },
  { code: "IE", name: "Ireland", rate: 0.23, label: "VAT" },
  { code: "IT", name: "Italy", rate: 0.22, label: "VAT" },
  { code: "LV", name: "Latvia", rate: 0.21, label: "VAT" },
  { code: "LT", name: "Lithuania", rate: 0.21, label: "VAT" },
  { code: "LU", name: "Luxembourg", rate: 0.17, label: "VAT" },
  { code: "MT", name: "Malta", rate: 0.18, label: "VAT" },
  { code: "NL", name: "Netherlands", rate: 0.21, label: "VAT" },
  { code: "PL", name: "Poland", rate: 0.23, label: "VAT" },
  { code: "PT", name: "Portugal", rate: 0.23, label: "VAT" },
  { code: "RO", name: "Romania", rate: 0.19, label: "VAT" },
  { code: "SK", name: "Slovakia", rate: 0.2, label: "VAT" },
  { code: "SI", name: "Slovenia", rate: 0.22, label: "VAT" },
  { code: "ES", name: "Spain", rate: 0.21, label: "VAT" },
  { code: "SE", name: "Sweden", rate: 0.25, label: "VAT" },
  { code: "GB", name: "United Kingdom", rate: 0.2, label: "VAT" },
  { code: "CH", name: "Switzerland", rate: 0.081, label: "VAT" },
  { code: "NO", name: "Norway", rate: 0.25, label: "VAT" },
  { code: "ZW", name: "Zimbabwe", rate: 0.15, label: "VAT" },
  { code: "ZA", name: "South Africa", rate: 0.15, label: "VAT" },
  { code: "NG", name: "Nigeria", rate: 0.075, label: "VAT" },
  { code: "KE", name: "Kenya", rate: 0.16, label: "VAT" },
  { code: "US", name: "United States", rate: 0, label: "Sales tax" },
  { code: "CA", name: "Canada", rate: 0.05, label: "GST" },
  { code: "AU", name: "Australia", rate: 0.1, label: "GST" },
  { code: "NZ", name: "New Zealand", rate: 0.15, label: "GST" },
  { code: "AE", name: "United Arab Emirates", rate: 0.05, label: "VAT" },
  { code: "OTHER", name: "Other / not listed", rate: 0, label: "Tax" },
];

const byCode = new Map(TAX_COUNTRIES.map((c) => [c.code, c]));

const EU_CODES = new Set(
  TAX_COUNTRIES.filter((c) =>
    [
      "DE", "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "GR", "HU",
      "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
    ].includes(c.code),
  ).map((c) => c.code),
);

/** Map browser timezone → ISO country (best effort). */
const TZ_COUNTRY: Record<string, string> = {
  "Europe/Berlin": "DE",
  "Europe/Vienna": "AT",
  "Europe/Zurich": "CH",
  "Europe/Paris": "FR",
  "Europe/London": "GB",
  "Europe/Dublin": "IE",
  "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE",
  "Europe/Madrid": "ES",
  "Europe/Rome": "IT",
  "Europe/Lisbon": "PT",
  "Europe/Warsaw": "PL",
  "Europe/Prague": "CZ",
  "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO",
  "Europe/Copenhagen": "DK",
  "Europe/Helsinki": "FI",
  "Africa/Harare": "ZW",
  "Africa/Johannesburg": "ZA",
  "Africa/Lagos": "NG",
  "Africa/Nairobi": "KE",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Toronto": "CA",
  "Australia/Sydney": "AU",
  "Pacific/Auckland": "NZ",
  "Asia/Dubai": "AE",
};

export function normalizeCountryCode(input?: string | null): string {
  if (!input) return "OTHER";
  const code = input.trim().toUpperCase().slice(0, 8);
  if (byCode.has(code)) return code;
  return "OTHER";
}

/** Guess country from browser locale + timezone (client only). */
export function detectBrowserCountry(): string {
  if (typeof window === "undefined") return "DE";
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (TZ_COUNTRY[tz]) return TZ_COUNTRY[tz];
    const lang = navigator.language || "";
    const region = lang.split("-")[1]?.toUpperCase();
    if (region && byCode.has(region)) return region;
  } catch {
    /* ignore */
  }
  return "DE";
}

export function isEuCountry(code: string): boolean {
  return EU_CODES.has(normalizeCountryCode(code));
}

/**
 * Calculate tax on a net subtotal for digital goods.
 * Optional EU VAT ID on a non-DE EU buyer → reverse charge (0% on invoice; buyer accounts for VAT).
 */
export function calculateTax(params: {
  subtotal: number;
  countryCode?: string | null;
  /** EU VAT number for B2B reverse charge (simplified check). */
  vatId?: string | null;
  currency?: string;
}): TaxBreakdown {
  const subtotal = Math.max(0, Number(params.subtotal) || 0);
  const currency = (params.currency || "USD").toUpperCase();
  const countryCode = normalizeCountryCode(params.countryCode);
  const country = byCode.get(countryCode) || byCode.get("OTHER")!;
  const vatId = (params.vatId || "").replace(/\s+/g, "").toUpperCase();

  // Simplified reverse charge: non-empty VAT-like id + EU buyer outside DE
  const reverseCharge =
    Boolean(vatId) &&
    vatId.length >= 8 &&
    isEuCountry(countryCode) &&
    countryCode !== "DE";

  if (reverseCharge) {
    return {
      countryCode,
      countryName: country.name,
      taxLabel: country.label,
      rate: 0,
      ratePercent: 0,
      subtotal: round2(subtotal),
      taxAmount: 0,
      total: round2(subtotal),
      currency,
      mode: "reverse_charge",
      note: "EU B2B reverse charge applied (0% VAT charged; your business accounts for VAT).",
    };
  }

  if (country.rate <= 0) {
    return {
      countryCode,
      countryName: country.name,
      taxLabel: country.label,
      rate: 0,
      ratePercent: 0,
      subtotal: round2(subtotal),
      taxAmount: 0,
      total: round2(subtotal),
      currency,
      mode: countryCode === "OTHER" || countryCode === "US" ? "unknown_region" : "zero_rated",
      note:
        countryCode === "US"
          ? "No automated US state sales tax yet — total shown without sales tax."
          : countryCode === "OTHER"
            ? "Region not listed — no automated tax added. BVS may confirm any local tax if required."
            : "No tax added for this region.",
    };
  }

  const taxAmount = round2(subtotal * country.rate);
  return {
    countryCode,
    countryName: country.name,
    taxLabel: country.label,
    rate: country.rate,
    ratePercent: round2(country.rate * 100),
    subtotal: round2(subtotal),
    taxAmount,
    total: round2(subtotal + taxAmount),
    currency,
    mode: "standard",
    note: `${country.label} ${round2(country.rate * 100)}% for ${country.name} (digital goods estimate).`,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function stripeAutomaticTaxEnabled() {
  return (
    process.env.STRIPE_AUTOMATIC_TAX === "1" ||
    process.env.STRIPE_AUTOMATIC_TAX === "true"
  );
}
