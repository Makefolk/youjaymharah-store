import { z } from "zod"

/**
 * The backend validates `email` with zod's `z.email()` as well, so the form
 * rejects exactly what the API would. Trimmed first: a pasted address often
 * brings a trailing space with it.
 */
export const newsletterSignupSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .pipe(z.email("Enter a valid email address, like name@example.com.")),
})

export type NewsletterSignupValues = z.input<typeof newsletterSignupSchema>

export const newsletterConfirmSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, "Enter your first name.")
    .max(100, "Use 100 characters or fewer."),
})
