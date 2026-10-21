"use client"

import type { HttpTypes } from "@medusajs/types"
import { useId, useState } from "react"

import {
  FormAlert,
  primaryButtonClass,
} from "@/components/account/account-shell"
import { useAppForm, validateOnSubmitThenChange } from "@/components/form"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toaster"
import { addressSchema } from "@/features/checkout/schema"
import {
  useCustomer,
  useDeleteAddress,
  useSaveAddress,
} from "@/features/customer/hooks"
import { NIGERIAN_STATES } from "@/lib/medusa/checkout"

type Address = HttpTypes.StoreCustomerAddress

const linkButton =
  "text-[13px] underline underline-offset-4 disabled:opacity-60 disabled:no-underline"

export function AddressBook() {
  const { data: customer } = useCustomer()
  const [editing, setEditing] = useState<string | "new" | null>(null)
  const addresses = [...(customer?.addresses ?? [])].sort(
    (a, b) => Number(b.is_default_shipping) - Number(a.is_default_shipping),
  )

  if (!customer) return null

  return (
    <div className="flex flex-col gap-6">
      {addresses.length === 0 && editing !== "new" && (
        <p className="text-[15px] text-muted-foreground">
          No saved addresses yet.
        </p>
      )}
      <ul className="flex flex-col divide-y divide-border/70">
        {addresses.map((address) => (
          <li key={address.id} className="py-5 first:pt-0">
            {editing === address.id ? (
              <AddressForm address={address} onDone={() => setEditing(null)} />
            ) : (
              <AddressCard
                address={address}
                onEdit={() => setEditing(address.id)}
              />
            )}
          </li>
        ))}
      </ul>
      {editing === "new" ? (
        <AddressForm
          onDone={() => setEditing(null)}
          makeDefaultByDefault={addresses.length === 0}
        />
      ) : (
        <Button
          variant="outline"
          size="lg"
          className={`self-start ${primaryButtonClass}`}
          onClick={() => setEditing("new")}
        >
          Add an address
        </Button>
      )}
    </div>
  )
}

function AddressCard({
  address,
  onEdit,
}: {
  address: Address
  onEdit: () => void
}) {
  const remove = useDeleteAddress()
  const save = useSaveAddress()
  const lines = [
    [address.first_name, address.last_name].filter(Boolean).join(" "),
    address.address_1,
    address.address_2,
    [address.city, address.province].filter(Boolean).join(", "),
    address.phone,
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <address className="text-[15px] leading-relaxed not-italic">
        {address.is_default_shipping && (
          <span className="mb-1 block text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
            Default
          </span>
        )}
        {lines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </address>
      <div className="flex shrink-0 gap-4">
        <button type="button" onClick={onEdit} className={linkButton}>
          Edit
        </button>
        {!address.is_default_shipping && (
          <button
            type="button"
            disabled={save.isPending}
            onClick={() =>
              save.mutate(
                { ...toInput(address), id: address.id, isDefault: true },
                {
                  onSuccess: () => toast.success("Default address changed"),
                  onError: () => toast.error("Couldn't change your default"),
                },
              )
            }
            className={linkButton}
          >
            Make default
          </button>
        )}
        <button
          type="button"
          disabled={remove.isPending}
          onClick={() =>
            remove.mutate(address.id, {
              onSuccess: () => toast.info("Address removed"),
              onError: () => toast.error("Couldn't remove the address"),
            })
          }
          className={linkButton}
        >
          Remove
        </button>
      </div>
    </div>
  )
}

const toInput = (address?: Address) => ({
  first_name: address?.first_name ?? "",
  last_name: address?.last_name ?? "",
  phone: address?.phone ?? "",
  address_1: address?.address_1 ?? "",
  address_2: address?.address_2 ?? "",
  city: address?.city ?? "",
  province: address?.province ?? "",
})

function AddressForm({
  address,
  onDone,
  makeDefaultByDefault = false,
}: {
  address?: Address
  onDone: () => void
  makeDefaultByDefault?: boolean
}) {
  const id = useId()
  const save = useSaveAddress()
  const [isDefault, setIsDefault] = useState(
    address?.is_default_shipping ?? makeDefaultByDefault,
  )
  const form = useAppForm({
    defaultValues: toInput(address),
    validationLogic: validateOnSubmitThenChange(),
    validators: { onDynamic: addressSchema },
    onSubmit: async ({ value }) => {
      try {
        await save.mutateAsync({ ...value, id: address?.id, isDefault })
        toast.success(address ? "Address updated" : "Address saved")
        onDone()
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
      className="flex max-w-xl flex-col gap-5"
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
          <field.TextField label="Phone" type="tel" autoComplete="tel" />
        )}
      </form.AppField>
      <form.AppField name="address_1">
        {(field) => (
          <field.TextField
            label="Street address"
            autoComplete="address-line1"
          />
        )}
      </form.AppField>
      <form.AppField name="address_2">
        {(field) => (
          <field.TextField
            label="Apartment, landmark (optional)"
            autoComplete="address-line2"
          />
        )}
      </form.AppField>
      <div className="grid gap-5 sm:grid-cols-2">
        <form.AppField name="city">
          {(field) => (
            <field.TextField
              label="City or town"
              autoComplete="address-level2"
            />
          )}
        </form.AppField>
        <form.AppField name="province">
          {(field) => (
            <field.SelectField
              label="State"
              autoComplete="address-level1"
              options={NIGERIAN_STATES}
              placeholder="Choose your state"
            />
          )}
        </form.AppField>
      </div>
      <label
        htmlFor={`${id}-default`}
        className="flex items-center gap-3 text-[13px]"
      >
        <input
          id={`${id}-default`}
          type="checkbox"
          checked={isDefault}
          onChange={(event) => setIsDefault(event.target.checked)}
          className="size-4 accent-foreground"
        />
        Use as my default delivery address
      </label>
      <div className="flex items-center gap-4">
        <form.AppForm>
          <form.SubmitButton
            size="lg"
            className={primaryButtonClass}
            pendingLabel="Saving…"
          >
            {address ? "Save changes" : "Save address"}
          </form.SubmitButton>
        </form.AppForm>
        <button type="button" onClick={onDone} className={linkButton}>
          Cancel
        </button>
      </div>
      {save.isError && (
        <FormAlert>
          We couldn&apos;t save the address. Please try again.
        </FormAlert>
      )}
    </form>
  )
}
