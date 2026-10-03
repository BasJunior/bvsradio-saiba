export const notificationDefaults = { releases: true, shows: true, creator_work: true, orders: true, community: false, marketing: false };
export function operationNotificationEnabled(kind: string, preferences: Partial<typeof notificationDefaults>) {
  const category = ["order", "payout", "premium"].includes(kind) ? "orders" : ["show", "episode"].includes(kind) ? "shows" : "creator_work";
  return preferences[category] !== false;
}
