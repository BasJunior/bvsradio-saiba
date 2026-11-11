import type { Metadata } from "next";
import SongLab from "@/components/SongLab";

export const metadata: Metadata = {
  title: "AI Song Lab | BVS Creator Studio",
  description: "Capture vocals, shape lyrics, and prepare a song concept inside BVS Creator Studio.",
};

export default async function AiSongLabPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const query = await searchParams;
  const id = typeof query.workspace === "string" && /^[0-9a-f-]{36}$/i.test(query.workspace)
    ? query.workspace : "";
  return <SongLab initialWorkspaceId={id} />;
}
