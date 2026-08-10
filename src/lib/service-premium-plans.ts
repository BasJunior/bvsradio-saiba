export type ServicePremiumPlanId = "service_pro" | "studio";
export type ServiceBillingInterval = "month" | "year";

export function parseServicePremiumPlanId(raw?: string | null): ServicePremiumPlanId | null {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "service_pro" || value === "service-pro" || value === "pro") return "service_pro";
  if (value === "studio") return "studio";
  return null;
}

export function normalizeServiceBillingInterval(raw?: string | null): ServiceBillingInterval {
  return String(raw || "").toLowerCase() === "year" ? "year" : "month";
}

export function servicePremiumPriceUsd(planId: ServicePremiumPlanId, interval: ServiceBillingInterval): number {
  if (planId === "studio") return interval === "year" ? 150 : 15;
  return interval === "year" ? 80 : 8;
}

export function servicePremiumLabel(planId: ServicePremiumPlanId): string {
  return planId === "studio" ? "BVS Studio Membership" : "BVS Service Pro";
}

export function servicePremiumSku(planId: ServicePremiumPlanId, interval: ServiceBillingInterval): string {
  return `service-premium:${planId}:${interval}`;
}

export function servicePremiumReference(): string {
  return `BVS-SVC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase()}`;
}

export function servicePremiumPeriodEndIso(interval: ServiceBillingInterval, from = new Date()): string {
  const next = new Date(from);
  if (interval === "year") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next.toISOString();
}

export function parseServicePremiumOrderItem(
  items: Array<{ type?: string; id?: string | number; title?: string; price?: number; quantity?: number }>,
) {
  for (const item of items || []) {
    const type = String(item.type || "").toLowerCase();
    const id = String(item.id || "");
    if (type !== "service_premium" && !id.startsWith("service-premium:")) continue;
    const parts = id.split(":");
    const planId = parseServicePremiumPlanId(parts[1] || item.title);
    if (!planId) return null;
    const interval = normalizeServiceBillingInterval(parts[2]);
    const amount = (Number(item.price) || 0) * (Number(item.quantity) || 1);
    return { planId, interval, amount };
  }
  return null;
}
