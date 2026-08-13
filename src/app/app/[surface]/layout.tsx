import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "BVS Radio App",
  description: "The curated BVS Radio mobile edition.",
  robots: { index: false, follow: true },
};

export default async function AppSurfaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ surface: string }>;
}) {
  const { surface } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  return children;
}
