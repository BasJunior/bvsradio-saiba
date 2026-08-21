import Link from "next/link";
import { notFound } from "next/navigation";
import MobileAccountPanel from "@/components/MobileAccountPanel";

export const dynamic = "force-dynamic";

export default async function MobileAccountPage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params;
  if (surface !== "ios" && surface !== "android") notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 pb-12 pt-7 sm:px-6">
      <Link href={`/app/${surface}`} className="text-sm text-brand hover:underline">← Back to BVS Radio</Link>
      <div className="mt-6">
        <MobileAccountPanel />
      </div>
    </div>
  );
}
