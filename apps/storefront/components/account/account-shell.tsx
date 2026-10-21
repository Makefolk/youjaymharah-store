import type { ReactNode } from "react"

/** The narrow column the sign-in and password pages share. */
export function AccountShell({
  title,
  intro,
  children,
}: {
  title: string
  intro?: ReactNode
  children: ReactNode
}) {
  return (
    <main className="container-wrapper max-w-md px-5 py-16 sm:px-6 sm:py-20">
      <h1 className="text-2xl font-medium tracking-[-0.01em]">{title}</h1>
      {intro && (
        <p className="mt-3 text-[15px] text-muted-foreground">{intro}</p>
      )}
      <div className="mt-8">{children}</div>
    </main>
  )
}

/** A form-level error, announced when it appears. */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-[13px] text-destructive">
      {children}
    </p>
  )
}

export const primaryButtonClass = "h-10 px-5 tracking-[0.06em] uppercase"
