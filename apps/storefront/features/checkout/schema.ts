import { z } from "zod"

const required = (message: string) => z.string().trim().min(1, message)

/** Contact and delivery details. Medusa takes the address as-is. */
export const checkoutDetailsSchema = z.object({
  email: required("Enter your email address.").pipe(
    z.email("Enter a valid email address, like name@example.com."),
  ),
  first_name: required("Enter your first name.").max(100),
  last_name: required("Enter your last name.").max(100),
  phone: required("Enter a phone number for the delivery rider.").regex(
    /^\+?[\d\s()-]{7,20}$/,
    "Enter a phone number, like 0803 123 4567.",
  ),
  address_1: required("Enter your street address.").max(200),
  address_2: z.string().trim().max(200),
  city: required("Enter your city or town.").max(100),
  province: required("Choose your state."),
})

export type CheckoutDetails = z.input<typeof checkoutDetailsSchema>
