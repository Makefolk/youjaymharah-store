import { parsePageText } from "@/lib/help/page-text"

/** Renders a page written in Settings › Pages. */
export function PageText({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-muted-foreground">
      {parsePageText(text).map((block, index) =>
        block.kind === "heading" ? (
          <h2
            key={index}
            className="mt-6 border-b border-border/70 pb-3 text-[15px] font-medium text-foreground first:mt-0"
          >
            {block.text}
          </h2>
        ) : block.kind === "list" ? (
          <ul key={index} className="list-disc space-y-1.5 pl-5">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={index}>{block.text}</p>
        ),
      )}
    </div>
  )
}
