import { DEFAULT_LOCALE } from "@/lib/medusa/price"

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return ""
  return new Date(value).toLocaleDateString(DEFAULT_LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}
