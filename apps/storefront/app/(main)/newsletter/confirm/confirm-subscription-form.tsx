"use client"

import { useAppForm, validateOnSubmitThenChange } from "@/components/form"
import { Button } from "@/components/ui/button"
import { useConfirmNewsletter } from "@/features/newsletter/hooks"
import { newsletterConfirmSchema } from "@/features/newsletter/schema"
import { isNotFound } from "@/lib/medusa/errors"

/** Email scanners must not confirm a subscription just by opening the link. */
export function ConfirmSubscriptionForm({
  token,
  firstName,
}: {
  token: string
  firstName: string
}) {
  const confirm = useConfirmNewsletter()
  const form = useAppForm({
    defaultValues: { first_name: firstName.trim() },
    validationLogic: validateOnSubmitThenChange(),
    validators: { onDynamic: newsletterConfirmSchema },
    onSubmit: async ({ value }) => {
      try {
        await confirm.mutateAsync({
          token,
          first_name: value.first_name.trim(),
        })
      } catch {
        // The mutation error is shown below the form.
      }
    },
  })

  if (confirm.isSuccess) {
    return (
      <p role="status" className="text-[15px]">
        You&apos;re subscribed. Welcome to The YJ Edit.
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
      className="flex flex-col gap-4"
    >
      <form.AppField name="first_name">
        {(field) => (
          <field.TextField
            label="First name"
            autoComplete="given-name"
            required
            maxLength={100}
            disabled={confirm.isPending}
          />
        )}
      </form.AppField>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            aria-busy={isSubmitting || undefined}
            className="self-start px-5 tracking-[0.06em] uppercase"
          >
            {isSubmitting ? "Confirming…" : "Confirm subscription"}
          </Button>
        )}
      </form.Subscribe>
      {confirm.isError && (
        <p role="alert" className="text-[13px] text-destructive">
          {isNotFound(confirm.error)
            ? "This link is no longer valid. Sign up again from the footer of any page."
            : "Something went wrong. Please try again."}
        </p>
      )}
    </form>
  )
}
