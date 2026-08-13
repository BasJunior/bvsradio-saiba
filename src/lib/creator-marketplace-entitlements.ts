import "server-only";
import { resolveSellerMarketplacePolicy } from "@/lib/seller-marketplace-policy";

export type MarketplaceEntitlements = {
  planId: string;
  productListingLimit: number | null;
  serviceListingLimit: number | null;
  servicePackageLimit: number;
  addonsEnabled: boolean;
  bundlesEnabled: boolean;
  customToolsEnabled: boolean;
};

export async function creatorMarketplaceEntitlements(
  userId: string,
): Promise<MarketplaceEntitlements> {
  const [productPolicy, servicePolicy] = await Promise.all([
    resolveSellerMarketplacePolicy(userId, "creator_product", 10),
    resolveSellerMarketplacePolicy(userId, "service", 50),
  ]);
  const productPlan = productPolicy.planId.toLowerCase();
  const servicePlan = servicePolicy.planId.toLowerCase();
  const productListingLimit =
    productPlan.includes("producer_pro") ||
    productPlan.includes("creator_complete")
      ? null
      : productPlan.includes("producer_plus")
        ? 150
        : 25;
  const serviceListingLimit =
    servicePlan === "studio"
      ? null
      : servicePlan.includes("service_pro")
        ? 5
        : 1;
  return {
    planId: productPlan.includes("creator_complete")
      ? productPolicy.planId
      : servicePlan !== "service_free"
        ? servicePolicy.planId
        : productPolicy.planId,
    productListingLimit,
    serviceListingLimit,
    servicePackageLimit:
      servicePlan === "studio"
        ? 20
        : servicePlan.includes("service_pro")
          ? 5
          : 1,
    addonsEnabled:
      servicePlan === "studio" ||
      servicePlan.includes("service_pro") ||
      productPlan.includes("producer_plus") ||
      productPlan.includes("producer_pro") ||
      productPlan.includes("creator_complete"),
    bundlesEnabled:
      productPlan.includes("producer_plus") ||
      productPlan.includes("producer_pro") ||
      productPlan.includes("creator_complete"),
    customToolsEnabled:
      productPlan.includes("producer_pro") ||
      productPlan.includes("creator_complete") ||
      servicePlan === "studio",
  };
}
