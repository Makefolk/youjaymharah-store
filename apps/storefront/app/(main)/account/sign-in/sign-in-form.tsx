"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import {
  FormAlert,
  primaryButtonClass,
} from "@/components/account/account-shell"
import { useAppForm, validateOnSubmitThenChange } from "@/components/form"
import { useLogin } from "@/features/customer/hooks"
import { signInSchema } from "@/features/customer/schema"
import { errorStatus } from "@/lib/medusa/errors"

export function SignInForm({
  next,
  forgotHref,
}: {
  next: string
  forgotHref: string
}) {
  const router = useRouter()
  const login = useLogin()
  const form = useAppForm({
    defaultValues: { email: "", password: "" },
    validationLogic: validateOnSubmitThenChange(),
    validators: { onDynamic: signInSchema },
    onSubmit: async ({ value }) => {
      try {
        await login.mutateAsync({
          email: value.email.trim(),
          password: value.password,
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
      <form.AppField name="password">
        {(field) => (
          <field.TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            required
          />
        )}
      </form.AppField>
      <Link
        href={forgotHref}
        className="-mt-2 self-start text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Forgot your password?
      </Link>
      <form.AppForm>
        <form.SubmitButton
          size="lg"
          className={primaryButtonClass}
          pendingLabel="Signing in…"
        >
          Sign in
        </form.SubmitButton>
      </form.AppForm>
      {login.isError && (
        <FormAlert>
          {errorStatus(login.error) === 401
            ? "That email and password don't match an account."
            : "We couldn't sign you in. Please try again."}
        </FormAlert>
      )}
    </form>
  )
}
