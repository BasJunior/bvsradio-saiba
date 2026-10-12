import { notFound } from "next/navigation";
import FeedMemberProfile from "@/components/feed/FeedMemberProfile";
export default async function MemberPage({ params }: { params: Promise<{ id: string; surface: string }> }) {
  const { id, surface } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  return <FeedMemberProfile id={id} surface={surface} />;
}
