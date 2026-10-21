"use client"

import Link from "next/link"

import {
  FormAlert,
  primaryButtonClass,
} from "@/components/account/account-shell"
import { useAppForm, validateOnSubmitThenChange } from "@/components/form"
import { useResetPassword } from "@/features/customer/hooks"
import { resetPasswordSchema } from "@/features/customer/schema"
import { FORGOT_PASSWORD_PATH, SIGN_IN_PATH } from "@/lib/seo/routes"

export function ResetPasswordForm({
  token,
  email,
}: {
  token: string
  email: string
}) {
  const reset = useResetPassword()
  const form = useAppForm({
    defaultValues: { password: "", confirm: "" },
    validationLogic: validateOnSubmitThenChange(),
    validators: { onDynamic: resetPasswordSchema },
    onSubmit: async ({ value }) => {
      try {
        await reset.mutateAsync({ token, email, password: value.password })
      } catch {
        // Shown below the form.
      }
    },
  })

  if (reset.isSuccess) {
    return (
      <p role="status" className="text-[15px]">
        Your password has been changed.{" "}
        <Link href={SIGN_IN_PATH} className="underline underline-offset-4">
          Sign in
        </Link>{" "}
        with your new password.
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
      <form.AppField name="password">
        {(field) => (
          <field.TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            description="At least 8 characters."
          />
        )}
      </form.AppField>
      <form.AppField name="confirm">
        {(field) => (
          <field.TextField
            label="Repeat new password"
            type="password"
            autoComplete="new-password"
            required
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton
          size="lg"
          className={primaryButtonClass}
          pendingLabel="Saving…"
        >
          Save password
        </form.SubmitButton>
      </form.AppForm>
      {reset.isError && (
        <FormAlert>
          This link has expired or was already used.{" "}
          <Link
            href={FORGOT_PASSWORD_PATH}
            className="underline underline-offset-4"
          >
            Request a new one
          </Link>
          .
        </FormAlert>
      )}
    </form>
  )
}
