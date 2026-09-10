import { redirect } from "next/navigation";

export default async function LegacyTrackBuyPage({ params }: { params: Promise<{ trackId: string }> }) {
  const trackId = String((await params).trackId || "").trim();
  redirect(`/buy?track=${encodeURIComponent(trackId)}`);
}
