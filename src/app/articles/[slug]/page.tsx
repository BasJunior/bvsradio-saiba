import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ slug: string }> };

/** Legacy /articles/:slug → /blog/:slug */
export default async function ArticleAliasPage({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/blog/${slug}`);
}
