import CreatorReleaseWorkspace from "@/components/CreatorReleaseWorkspace";

export default async function CreatorReleaseWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CreatorReleaseWorkspace releaseKey={id} />;
}
