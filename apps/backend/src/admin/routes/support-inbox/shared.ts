export type SupportStatus = "open" | "awaiting_customer" | "resolved";

export type SupportRequest = {
  id: string;
  reference: string;
  kind: string;
  status: SupportStatus;
  priority: "normal" | "high";
  name: string;
  email: string;
  customer_id: string | null;
  order_id: string | null;
  order_display_id: number | null;
  assigned_to: string | null;
  created_at: string;
  last_message_at: string;
};

export type SupportMessage = {
  id: string;
  author: "customer" | "staff";
  author_name: string | null;
  body: string;
  internal: boolean;
  attachments: { files?: { url: string; name: string }[] } | null;
  created_at: string;
};

export const STATUS_LABELS: Record<
  SupportStatus,
  { label: string; color: "orange" | "blue" | "green" }
> = {
  open: { label: "Waiting on us", color: "orange" },
  awaiting_customer: { label: "Waiting on customer", color: "blue" },
  resolved: { label: "Resolved", color: "green" },
};

export const KIND_LABELS: Record<string, string> = {
  question: "A question",
  order: "An order",
  delivery: "Delivery",
  return: "A return or refund",
  product: "A product or sizing",
  cancel: "Cancel the order",
  change_address: "Change the address",
  exchange: "Exchange a size",
  damaged: "Damaged or faulty",
  missing: "Missing or wrong item",
};

export const when = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
