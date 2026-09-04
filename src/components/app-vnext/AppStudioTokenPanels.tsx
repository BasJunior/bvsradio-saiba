"use client";

import CreatorInsights from "@/components/CreatorInsights";
import StudioMoneySummary from "@/components/StudioMoneySummary";
import CreatorServiceOrders from "@/components/CreatorServiceOrders";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";

function Gate({ children }: { children: (token: string) => React.ReactNode }) {
  const { token, loading, signedIn, isCreator } = useAppSession();
  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-white/[.04]" />;
  if (!signedIn || !token) return <p className="rounded-2xl border border-white/10 p-5 text-sm text-text-secondary">Sign in to open this Studio view.</p>;
  if (!isCreator) return <p className="rounded-2xl border border-white/10 p-5 text-sm text-text-secondary">A BVS creator role is required for this Studio view.</p>;
  return <>{children(token)}</>;
}

export function AppStudioInsightsPanel() {
  return <Gate>{(token) => <CreatorInsights token={token} />}</Gate>;
}

export function AppStudioMoneyPanel() {
  return <Gate>{(token) => <StudioMoneySummary token={token} />}</Gate>;
}

export function AppStudioOrdersPanel() {
  return <Gate>{(token) => <CreatorServiceOrders token={token} />}</Gate>;
}
