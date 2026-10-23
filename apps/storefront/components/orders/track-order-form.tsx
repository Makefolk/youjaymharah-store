"use client"

import {
  FormAlert,
  primaryButtonClass,
} from "@/components/account/account-shell"
import { useAppForm, validateOnSubmitThenChange } from "@/components/form"
import { useOrderLookup } from "@/features/orders/hooks"
import { orderLookupSchema } from "@/features/orders/schema"
import { errorStatus } from "@/lib/medusa/errors"

/**
 * Emails the order's link to the order's address. The answer is the same
 * whether or not the number and email match, so it can't be used to find
 * out who has ordered here.
 */
export function TrackOrderForm() {
  const lookup = useOrderLookup()
  const form = useAppForm({
    defaultValues: { order_number: "", email: "" },
    validationLogic: validateOnSubmitThenChange(),
    validators: { onDynamic: orderLookupSchema },
    onSubmit: async ({ value }) => {
      const parsed = orderLookupSchema.parse(value)
      try {
        await lookup.mutateAsync({
          display_id: parsed.order_number,
          email: parsed.email,
        })
      } catch {
        // Shown below the form.
      }
    },
  })

  if (lookup.isSuccess) {
    return (
      <div role="status" className="border-l-2 border-gold pl-3">
        <p className="text-[15px] font-medium">Check your email</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          If that order number and email match an order, we&apos;ve emailed a
          link to it. It can take a few minutes; check your spam folder too.
        </p>
      </div>
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
      <form.AppField name="order_number">
        {(field) => (
          <field.TextField
            label="Order number"
            inputMode="numeric"
            placeholder="1042"
            required
          />
        )}
      </form.AppField>
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
          Email me the link
        </form.SubmitButton>
      </form.AppForm>
      {lookup.isError && (
        <FormAlert>
          {errorStatus(lookup.error) === 429
            ? "Too many attempts. Wait a minute and try again."
            : "Something went wrong. Please try again."}
        </FormAlert>
      )}
    </form>
  )
}
