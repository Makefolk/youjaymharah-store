"use client"

import { useRouter } from "next/navigation"

import {
  FormAlert,
  primaryButtonClass,
} from "@/components/account/account-shell"
import { useAppForm, validateOnSubmitThenChange } from "@/components/form"
import { useOrderLookup } from "@/features/orders/hooks"
import { orderLookupSchema } from "@/features/orders/schema"
import { errorStatus, isNotFound } from "@/lib/medusa/errors"
import { orderPath } from "@/lib/seo/routes"

export function TrackOrderForm() {
  const router = useRouter()
  const lookup = useOrderLookup()
  const form = useAppForm({
    defaultValues: { order_number: "", email: "" },
    validationLogic: validateOnSubmitThenChange(),
    validators: { onDynamic: orderLookupSchema },
    onSubmit: async ({ value }) => {
      const parsed = orderLookupSchema.parse(value)
      try {
        const { order } = await lookup.mutateAsync({
          display_id: parsed.order_number,
          email: parsed.email,
        })
        router.push(orderPath(order.id))
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
          pendingLabel="Finding your order…"
        >
          Find order
        </form.SubmitButton>
      </form.AppForm>
      {lookup.isError && (
        <FormAlert>
          {isNotFound(lookup.error)
            ? "We couldn't find an order with that number and email. Check both against your confirmation email."
            : errorStatus(lookup.error) === 429
              ? "Too many attempts. Wait a minute and try again."
              : "Something went wrong. Please try again."}
        </FormAlert>
      )}
    </form>
  )
}
