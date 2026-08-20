export type PayoutValidationInput = {
  available: number;
  minimum: number;
  requested?: number | null;
  hasOpenRequest?: boolean;
};

export type PayoutValidation =
  | { ok: true; amount: number }
  | { ok: false; code: string; message: string };

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

/** Mirrors the database guard for instant UI feedback; SQL remains authoritative. */
export function validatePayoutRequest(input: PayoutValidationInput): PayoutValidation {
  const available = Math.round((Number(input.available) || 0) * 100) / 100;
  const minimum = Math.max(0, Math.round((Number(input.minimum) || 25) * 100) / 100);
  const raw = input.requested == null ? available : Number(input.requested);
  const amount = Math.round(raw * 100) / 100;

  if (input.hasOpenRequest) {
    return { ok: false, code: "PAYOUT_ALREADY_OPEN", message: "You already have a payout request in progress." };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, code: "PAYOUT_AMOUNT_INVALID", message: "Enter a valid payout amount." };
  }
  if (amount < minimum) {
    return { ok: false, code: "PAYOUT_BELOW_MINIMUM", message: `The minimum payout is ${money(minimum)}.` };
  }
  if (amount > available) {
    return { ok: false, code: "PAYOUT_EXCEEDS_AVAILABLE", message: `Only ${money(available)} is available for payout.` };
  }
  return { ok: true, amount };
}

export function payoutErrorMessage(raw: string) {
  if (raw.includes("PAYOUT_ALREADY_OPEN")) return "You already have a payout request in progress.";
  if (raw.includes("PAYOUT_BELOW_MINIMUM")) return "Your available balance is below the payout minimum.";
  if (raw.includes("PAYOUT_EXCEEDS_AVAILABLE")) return "The requested amount exceeds your available balance.";
  if (raw.includes("PAYOUT_METHOD_INVALID")) return "Choose an active payout method that belongs to your account.";
  return "Could not create the payout request. Please try again.";
}
