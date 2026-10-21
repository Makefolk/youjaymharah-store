import { z } from "zod"

const email = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .pipe(z.email("Enter a valid email address, like name@example.com."))

/** Medusa accepts any password; this is the store's own minimum. */
const newPassword = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Use 128 characters or fewer.")

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
})

export const registerSchema = z.object({
  first_name: z.string().trim().max(100, "Use 100 characters or fewer."),
  last_name: z.string().trim().max(100, "Use 100 characters or fewer."),
  email,
  password: newPassword,
})

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine((values) => values.password === values.confirm, {
    path: ["confirm"],
    message: "The passwords don't match.",
  })
