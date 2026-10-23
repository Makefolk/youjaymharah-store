"use client"

import {
  FormAlert,
  primaryButtonClass,
} from "@/components/account/account-shell"
import { useAppForm, validateOnSubmitThenChange } from "@/components/form"
import { BrandLoader } from "@/components/layout/brand-loader"
import { toast } from "@/components/ui/toaster"
import {
  useChangePassword,
  useSetPassword,
  useSignInMethods,
} from "@/features/customer/hooks"
import {
  changePasswordSchema,
  setPasswordSchema,
} from "@/features/customer/schema"

/**
 * Change the password, or, for an account that only signs in with Google,
 * add one so it can sign in with email too.
 */
export function PasswordSection() {
  const methods = useSignInMethods()

  if (methods.isPending) {
    return <BrandLoader />
  }
  if (methods.isError) {
    return (
      <FormAlert>
        We couldn&apos;t load your sign-in details. Please refresh the page.
      </FormAlert>
    )
  }
  return methods.data.has_password ? (
    <ChangePasswordForm />
  ) : (
    <SetPasswordForm />
  )
}

function ChangePasswordForm() {
  const change = useChangePassword()
  const form = useAppForm({
    defaultValues: { current_password: "", password: "", confirm: "" },
    validationLogic: validateOnSubmitThenChange(),
    validators: { onDynamic: changePasswordSchema },
    onSubmit: async ({ value, formApi }) => {
      try {
        await change.mutateAsync({
          current_password: value.current_password,
          new_password: value.password,
        })
        formApi.reset()
        toast.success("Your password is changed", {
          description: "Any other devices are now signed out.",
        })
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
      className="flex max-w-md flex-col gap-5"
    >
      <form.AppField name="current_password">
        {(field) => (
          <field.TextField
            label="Current password"
            type="password"
            autoComplete="current-password"
          />
        )}
      </form.AppField>
      <form.AppField name="password">
        {(field) => (
          <field.TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            description="At least 8 characters."
          />
        )}
      </form.AppField>
      <form.AppField name="confirm">
        {(field) => (
          <field.TextField
            label="New password again"
            type="password"
            autoComplete="new-password"
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton
          size="lg"
          className={`self-start ${primaryButtonClass}`}
          pendingLabel="Changing…"
        >
          Change password
        </form.SubmitButton>
      </form.AppForm>
      {change.isError && (
        <FormAlert>
          {change.error.message ||
            "We couldn't change your password. Please try again."}
        </FormAlert>
      )}
    </form>
  )
}

function SetPasswordForm() {
  const set = useSetPassword()
  const form = useAppForm({
    defaultValues: { password: "", confirm: "" },
    validationLogic: validateOnSubmitThenChange(),
    validators: { onDynamic: setPasswordSchema },
    onSubmit: async ({ value }) => {
      try {
        await set.mutateAsync(value.password)
        toast.success("Password added", {
          description: "You can now sign in with your email too.",
        })
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
      className="flex max-w-md flex-col gap-5"
    >
      <p className="text-[13px] text-muted-foreground">
        You sign in with Google. Add a password to sign in with your email as
        well.
      </p>
      <form.AppField name="password">
        {(field) => (
          <field.TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            description="At least 8 characters."
          />
        )}
      </form.AppField>
      <form.AppField name="confirm">
        {(field) => (
          <field.TextField
            label="Password again"
            type="password"
            autoComplete="new-password"
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton
          size="lg"
          className={`self-start ${primaryButtonClass}`}
          pendingLabel="Saving…"
        >
          Add password
        </form.SubmitButton>
      </form.AppForm>
      {set.isError && (
        <FormAlert>
          {set.error.message ||
            "We couldn't add your password. Please try again."}
        </FormAlert>
      )}
    </form>
  )
}
