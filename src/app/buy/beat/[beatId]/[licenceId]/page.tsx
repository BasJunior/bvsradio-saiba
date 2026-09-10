import { redirect } from "next/navigation";

export default async function LegacyBeatBuyPage({
  params,
}: {
  params: Promise<{ beatId: string; licenceId: string }>;
}) {
  const { beatId, licenceId } = await params;
  redirect(
    `/buy?beat=${encodeURIComponent(String(beatId || ""))}&licence=${encodeURIComponent(String(licenceId || ""))}`,
  );
}
