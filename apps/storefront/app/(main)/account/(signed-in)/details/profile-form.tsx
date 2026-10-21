"use client"

import {
  FormAlert,
  primaryButtonClass,
} from "@/components/account/account-shell"
import { useAppForm, validateOnSubmitThenChange } from "@/components/form"
import { toast } from "@/components/ui/toaster"
import { useCustomer, useUpdateProfile } from "@/features/customer/hooks"
import { profileSchema } from "@/features/customer/schema"

/** The email isn't editable here: it is how the customer signs in. */
export function ProfileForm() {
  const { data: customer } = useCustomer()
  const update = useUpdateProfile()
  const form = useAppForm({
    defaultValues: {
      first_name: customer?.first_name ?? "",
      last_name: customer?.last_name ?? "",
      phone: customer?.phone ?? "",
    },
    validationLogic: validateOnSubmitThenChange(),
    validators: { onDynamic: profileSchema },
    onSubmit: async ({ value }) => {
      try {
        await update.mutateAsync(value)
        toast.success("Your details are saved")
      } catch {
        // Shown below the form.
      }
    },
  })

  if (!customer) return null

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
      <form.AppField name="phone">
        {(field) => (
          <field.TextField
            label="Phone"
            type="tel"
            autoComplete="tel"
            description="Filled in at checkout for the delivery rider."
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton
          size="lg"
          className={`self-start ${primaryButtonClass}`}
          pendingLabel="Saving…"
        >
          Save
        </form.SubmitButton>
      </form.AppForm>
      {update.isError && (
        <FormAlert>
          We couldn&apos;t save your details. Please try again.
        </FormAlert>
      )}
    </form>
  )
}
