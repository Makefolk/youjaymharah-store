import type { ReactNode } from "react"

/** The narrow reading column the help pages share. */
export function HelpPage({
  title,
  intro,
  children,
}: {
  title: string
  intro?: ReactNode
  children: ReactNode
}) {
  return (
    <main className="container-wrapper max-w-2xl px-5 py-12 sm:px-6 sm:py-16">
      <h1 className="text-2xl font-medium tracking-[-0.01em]">{title}</h1>
      {intro && (
        <p className="mt-3 text-[15px] text-muted-foreground">{intro}</p>
      )}
      <div className="mt-10 flex flex-col gap-10 text-[15px] leading-relaxed">
        {children}
      </div>
    </main>
  )
}

export function HelpSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="border-b border-border/70 pb-3 text-[15px] font-medium">
        {title}
      </h2>
      <div className="flex flex-col gap-3 text-muted-foreground">
        {children}
      </div>
    </section>
  )
}

export const helpLinkClass = "text-foreground underline underline-offset-4"
