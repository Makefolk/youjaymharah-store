import { z } from "zod"

/** The order number as printed on the confirmation: "1042" or "#1042". */
export const orderNumber = z
  .string()
  .trim()
  .min(1, "Enter your order number.")
  .transform((value) => value.replace(/^#/, "").trim())
  .pipe(
    z
      .string()
      .regex(/^\d{1,12}$/, "Use the number from your confirmation, like 1042.")
      .transform(Number),
  )

export const orderLookupSchema = z.object({
  order_number: orderNumber,
  email: z
    .string()
    .trim()
    .min(1, "Enter the email you ordered with.")
    .pipe(z.email("Enter a valid email address, like name@example.com.")),
})
