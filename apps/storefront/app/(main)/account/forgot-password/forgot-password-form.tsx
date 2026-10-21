"use client"

import {
  FormAlert,
  primaryButtonClass,
} from "@/components/account/account-shell"
import { useAppForm, validateOnSubmitThenChange } from "@/components/form"
import { useRequestPasswordReset } from "@/features/customer/hooks"
import { forgotPasswordSchema } from "@/features/customer/schema"

export function ForgotPasswordForm() {
  const request = useRequestPasswordReset()
  const form = useAppForm({
    defaultValues: { email: "" },
    validationLogic: validateOnSubmitThenChange(),
    validators: { onDynamic: forgotPasswordSchema },
    onSubmit: async ({ value }) => {
      try {
        await request.mutateAsync({ email: value.email.trim() })
      } catch {
        // Shown below the form.
      }
    },
  })

  if (request.isSuccess) {
    return (
      <p role="status" className="text-[15px]">
        If there&apos;s an account for {request.variables.email}, a reset link
        is on its way. It works for 15 minutes; check your spam folder if it
        doesn&apos;t arrive.
      </p>
    )
  }

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
      <form.AppField name="email">
        {(field) => (
          <field.TextField
            label="Email"
            type="email"
            autoComplete="email"
            required
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton
          size="lg"
          className={primaryButtonClass}
          pendingLabel="Sending…"
        >
          Send reset link
        </form.SubmitButton>
      </form.AppForm>
      {request.isError && (
        <FormAlert>We couldn&apos;t send the link. Please try again.</FormAlert>
      )}
    </form>
  )
}
