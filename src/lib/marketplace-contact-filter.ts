const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/i;
// Nine or more digits, optionally separated, so prices, years and dates pass.
const PHONE = /(?:\+|\b)\d(?:[\s().-]{0,2}\d){8,}\b/;
const HANDLE = /(?:^|[\s(])@[a-z0-9_.]{3,}/i;
const PLATFORM =
  /\b(?:whats\s?app|wa\.me|t\.me|telegram|snapchat|instagram\.com|facebook\.com|tiktok\.com|paypal\.me|paypal\.com|cash\.app)\b|\b(?:on|my|via|dm(?: me)?(?: on)?)\s+(?:instagram|insta|ig|facebook|fb|tiktok)\b/i;

const CONTACT_RULES: Array<[RegExp, string]> = [
  [EMAIL, "an email address"],
  [PHONE, "a phone number"],
  [HANDLE, "a social media handle"],
  [PLATFORM, "an outside messaging or social app"],
];

/** Returns the buyer- or seller-facing refusal, or null when the text is allowed. */
export function offPlatformContactIssue(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string" || !value.trim()) continue;
    for (const [pattern, label] of CONTACT_RULES) {
      if (pattern.test(value)) {
        return `Please remove ${label}. All Marketplace contact stays on BVS so we can help with disputes and refunds.`;
      }
    }
  }
  return null;
}
