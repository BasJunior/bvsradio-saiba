import { redirect } from "next/navigation";

/** Legacy / SEO alias → journal */
export default function ArticlesAliasPage() {
  redirect("/blog");
}
