import type { AppShareButtonProps } from "@/components/app-vnext/AppShareButton";

export type ShareCardDetails = Pick<AppShareButtonProps, "title" | "text" | "path" | "image" | "kicker">;

/** One shared composer for Feed, discovery and detail pages on every surface. */
export function openBvsShareCard(details: ShareCardDetails) {
  window.dispatchEvent(new CustomEvent<ShareCardDetails>("bvs:share-card", { detail: details }));
}
