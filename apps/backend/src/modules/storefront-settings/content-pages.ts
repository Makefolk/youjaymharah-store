/** Pages whose text staff write in the admin (Settings › Pages). */
export const CONTENT_PAGES = ["about", "privacy", "terms"] as const;
export type ContentPage = (typeof CONTENT_PAGES)[number];

/**
 * Plain text: paragraphs separated by a blank line, `## ` starting a heading
 * and `- ` a bullet point. Null when not written yet.
 */
export type ContentPages = Record<ContentPage, string | null>;

export function completeContentPages(stored: unknown): ContentPages {
  const value = (stored ?? {}) as Record<string, unknown>;
  return Object.fromEntries(
    CONTENT_PAGES.map((page) => [
      page,
      typeof value[page] === "string" && (value[page] as string).trim()
        ? value[page]
        : null,
    ]),
  ) as ContentPages;
}
