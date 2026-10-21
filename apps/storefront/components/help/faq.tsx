import type { ReactNode } from "react"

/** Native disclosure: works without JavaScript and is announced as expandable. */
export function Faq({
  items,
}: {
  items: { question: string; answer: ReactNode }[]
}) {
  return (
    <div className="divide-y divide-border/70 border-y border-border/70">
      {items.map((item) => (
        <details key={item.question} className="group py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium outline-offset-4 focus-visible:outline-1 [&::-webkit-details-marker]:hidden">
            {item.question}
            <span
              aria-hidden
              className="text-muted-foreground transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <div className="mt-3 max-w-[65ch] text-[15px] leading-relaxed text-muted-foreground">
            {item.answer}
          </div>
        </details>
      ))}
    </div>
  )
}
