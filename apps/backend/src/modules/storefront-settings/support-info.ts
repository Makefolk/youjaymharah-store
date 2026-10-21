/**
 * How customers reach the team, as the contact page shows it. Every field is
 * optional: an unset one is left off the page rather than shown empty.
 */
export type SupportInfo = {
  /** e.g. "Monday to Friday, 9am to 6pm (WAT)". */
  hours: string | null;
  /** e.g. "within one working day". */
  response_time: string | null;
  /** In international form, e.g. +2348012345678. */
  phone: string | null;
  /** The WhatsApp number, international form; the page links to wa.me. */
  whatsapp: string | null;
  /** Delivery areas, times and costs, in the store's words; plain text. */
  delivery_information: string | null;
};

export const SUPPORT_INFO_KEYS = [
  "hours",
  "response_time",
  "phone",
  "whatsapp",
  "delivery_information",
] as const;

/** Fills the keys a stored value lacks (rows predating a field, or {}). */
export function completeSupportInfo(stored: unknown): SupportInfo {
  const value = (stored ?? {}) as Record<string, unknown>;
  return Object.fromEntries(
    SUPPORT_INFO_KEYS.map((key) => [
      key,
      typeof value[key] === "string" && value[key] ? value[key] : null,
    ]),
  ) as SupportInfo;
}
