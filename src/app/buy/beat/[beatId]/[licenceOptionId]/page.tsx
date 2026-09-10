import { redirect } from "next/navigation";

export default async function LegacyBeatBuyPage({
  params,
}: {
  params: Promise<{ beatId: string; licenceOptionId: string }>;
}) {
  const { beatId, licenceOptionId } = await params;
  redirect(
    `/buy?beat=${encodeURIComponent(String(beatId || ""))}&licence=${encodeURIComponent(String(licenceOptionId || ""))}`,
  );
}
