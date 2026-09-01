const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const CONTACT_APP_PATTERN = /\b(?:whats?app|telegram|signal)\b.{0,24}(?:@?[a-z0-9_.-]{3,}|\+?[\d\s().-]{8,})/i;
const PHONE_CANDIDATE_PATTERN = /(?:^|\D)(\+?[\d][\d\s().-]{6,}[\d])(?:\D|$)/g;
export function publicRoomSafetyMessage(input: string) {
  if (EMAIL_PATTERN.test(input) || CONTACT_APP_PATTERN.test(input)) return "For safety, please don't post personal contact details in public Rooms.";
  for (const match of input.matchAll(PHONE_CANDIDATE_PATTERN)) { const digits=(match[1]||"").replace(/\D/g,""); if(digits.length>=8&&digits.length<=15) return "For safety, please don't post personal contact details in public Rooms."; }
  return null;
}
