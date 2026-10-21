"use client"

import { Toast } from "@base-ui/react/toast"
import { XIcon } from "@phosphor-icons/react"
import Link from "next/link"

type ToastData = {
  /** A follow-up page, e.g. the bag after adding to it. */
  link?: { href: string; label: string }
}

/** One manager for the whole app, so any component (or hook) can toast. */
const toastManager = Toast.createToastManager<ToastData>()

type ToastOptions = {
  description?: string
  link?: ToastData["link"]
}

const show =
  (type: "success" | "error" | "info") =>
  (title: string, options: ToastOptions = {}) =>
    toastManager.add({
      title,
      description: options.description,
      type,
      // Errors stay a little longer so they can be read.
      timeout: type === "error" ? 6000 : 4000,
      priority: type === "error" ? "high" : "low",
      data: { link: options.link },
    })

/**
 * Short confirmations for actions whose result isn't otherwise visible where
 * the shopper is looking: saving to the wishlist, quick add, "Notify me".
 */
export const toast = {
  success: show("success"),
  error: show("error"),
  info: show("info"),
}

/** Mounted once in the root layout. */
export function Toaster() {
  return (
    <Toast.Provider toastManager={toastManager} limit={3}>
      <Toast.Portal>
        <Toast.Viewport className="fixed top-20 right-4 left-4 z-120 flex flex-col items-center gap-2 outline-none sm:right-6 sm:left-auto sm:w-88 sm:items-stretch">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}

function ToastList() {
  const { toasts } = Toast.useToastManager<ToastData>()

  return toasts.map((item) => (
    <Toast.Root
      key={item.id}
      toast={item}
      className="pointer-events-auto flex w-full max-w-88 items-start gap-3 bg-ink px-4 py-3.5 text-ink-foreground shadow-[0_12px_32px_-12px_rgb(0_0_0/0.45)] transition-[opacity,translate] duration-300 ease-out data-ending-style:-translate-y-1 data-ending-style:opacity-0 data-limited:opacity-0 data-starting-style:-translate-y-2 data-starting-style:opacity-0 motion-reduce:transition-none"
    >
      <span
        aria-hidden
        className={
          item.type === "error"
            ? "mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive"
            : "mt-1.5 size-1.5 shrink-0 rounded-full bg-gold-light"
        }
      />
      <Toast.Content className="min-w-0 flex-1">
        <Toast.Title className="text-[13px] leading-snug font-medium" />
        <Toast.Description className="mt-0.5 text-[12px] leading-snug text-ink-foreground/70" />
        {item.data?.link && (
          <Link
            href={item.data.link.href}
            className="mt-2 inline-block text-[12px] font-medium tracking-[0.06em] uppercase underline underline-offset-4"
          >
            {item.data.link.label}
          </Link>
        )}
      </Toast.Content>
      <Toast.Close
        aria-label="Dismiss"
        className="-mt-0.5 -mr-1 flex size-6 shrink-0 items-center justify-center text-ink-foreground/60 hover:text-ink-foreground"
      >
        <XIcon className="size-3.5" />
      </Toast.Close>
    </Toast.Root>
  ))
}
