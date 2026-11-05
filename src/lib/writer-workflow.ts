/** Shared, framework-free rules for BVS human-reviewed editorial submissions. */
export const editableArticleStatuses = new Set(["draft", "changes_requested"]);

export function cleanWriterText(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

export function canSubmitWriterArticle(applicationStatus: string | null | undefined, staff = false): boolean {
  return staff || applicationStatus === "approved";
}

export function validWriterCoverPath(path: string, userId: string): boolean {
  return /^writer-covers\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path)
    && path.startsWith(`writer-covers/${userId}/`);
}

export function publishedArticleSlug(title: string, articleId: string): string {
  const stem = title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70).replace(/-$/g, "");
  return `${stem || "bvs-story"}-${articleId.slice(0, 8).toLowerCase()}`;
}

export function safeWriterPortfolio(value: unknown): string | null {
  const text = cleanWriterText(value, 500);
  if (!text) return null;
  try {
    const url = new URL(text);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
}
