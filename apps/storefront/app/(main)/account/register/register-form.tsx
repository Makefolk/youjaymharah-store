"use client"

import { useRouter } from "next/navigation"

import {
  FormAlert,
  primaryButtonClass,
} from "@/components/account/account-shell"
import { useAppForm, validateOnSubmitThenChange } from "@/components/form"
import { toast } from "@/components/ui/toaster"
import {
  useRegister,
  useSendVerificationEmail,
} from "@/features/customer/hooks"
import { registerSchema } from "@/features/customer/schema"
import { errorStatus } from "@/lib/medusa/errors"

export function RegisterForm({ next }: { next: string }) {
  const router = useRouter()
  const register = useRegister()
  const sendVerification = useSendVerificationEmail()
  const form = useAppForm({
    defaultValues: { first_name: "", last_name: "", email: "", password: "" },
    validationLogic: validateOnSubmitThenChange(),
    validators: { onDynamic: registerSchema },
    onSubmit: async ({ value }) => {
      try {
        await register.mutateAsync({
          email: value.email.trim(),
          password: value.password,
          first_name: value.first_name.trim() || undefined,
          last_name: value.last_name.trim() || undefined,
        })
        // Not awaited: the account works before the email is verified.
        // The promise, not mutate's callbacks: those are skipped once this
        // form unmounts on the redirect.
        sendVerification
          .mutateAsync()
          .then(({ sent, email }) => {
            if (sent)
              toast.success("Check your inbox", {
                description: `We've sent a link to verify ${email}.`,
              })
          })
          .catch(() => {
            // The account page offers to send it again.
          })
        router.replace(next)
      } catch {
        // Shown below the form.
      }
    },
  })

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void form.handleSubmit()
      }}
      className="flex flex-col gap-5"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <form.AppField name="first_name">
          {(field) => (
            <field.TextField label="First name" autoComplete="given-name" />
          )}
        </form.AppField>
        <form.AppField name="last_name">
          {(field) => (
            <field.TextField label="Last name" autoComplete="family-name" />
          )}
        </form.AppField>
      </div>
      <form.AppField name="email">
        {(field) => (
          <field.TextField
            label="Email"
            type="email"
            autoComplete="email"
            required
            description="Use the email you order with, so your orders appear in your account."
          />
        )}
      </form.AppField>
      <form.AppField name="password">
        {(field) => (
          <field.TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            description="At least 8 characters."
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton
          size="lg"
          className={primaryButtonClass}
          pendingLabel="Creating account…"
        >
          Create account
        </form.SubmitButton>
      </form.AppForm>
      {register.isError && (
        <FormAlert>
          {errorStatus(register.error) === 401 ||
          /exist/i.test(register.error.message)
            ? "There's already an account with this email. Sign in instead, or reset your password."
            : register.error.message ||
              "We couldn't create your account. Please try again."}
        </FormAlert>
      )}
    </form>
  )
}
