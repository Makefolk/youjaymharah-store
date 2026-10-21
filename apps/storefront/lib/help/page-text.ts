export type PageBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }

/**
 * The admin's page text as blocks: a blank line ends a paragraph, "## "
 * starts a heading and "- " a bullet point. Deliberately not Markdown: staff
 * get the three things a policy page needs, and nothing can inject HTML.
 */
export function parsePageText(text: string): PageBlock[] {
  const blocks: PageBlock[] = []
  let paragraph: string[] = []

  const endParagraph = () => {
    if (paragraph.length)
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") })
    paragraph = []
  }

  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim()
    if (!line) {
      endParagraph()
    } else if (line.startsWith("## ")) {
      endParagraph()
      blocks.push({ kind: "heading", text: line.slice(3).trim() })
    } else if (/^[-•] /.test(line)) {
      endParagraph()
      const item = line.slice(2).trim()
      const last = blocks.at(-1)
      if (last?.kind === "list") last.items.push(item)
      else blocks.push({ kind: "list", items: [item] })
    } else {
      paragraph.push(line)
    }
  }
  endParagraph()
  return blocks
}
