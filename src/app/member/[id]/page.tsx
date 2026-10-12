import { AppSessionProvider } from "@/components/app-vnext/AppSessionProvider";
import FeedMemberProfile from "@/components/feed/FeedMemberProfile";
export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppSessionProvider><FeedMemberProfile id={id} surface={null} /></AppSessionProvider>;
}
