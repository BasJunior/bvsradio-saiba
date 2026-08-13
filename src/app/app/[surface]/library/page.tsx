import { notFound } from "next/navigation";
import LibraryView from "@/components/library/LibraryView";

export default async function AppLibraryPage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  return <LibraryView />;
}
