"use client"

import type { HttpTypes } from "@medusajs/types"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useId, useState, type ReactNode } from "react"

import { FormAlert } from "@/components/account/account-shell"
import { useAppForm, validateOnSubmitThenChange } from "@/components/form"
import { Button } from "@/components/ui/button"
import { useCart } from "@/features/cart/hooks"
import {
  usePaymentProviders,
  useSaveCheckoutDetails,
  useSetShippingMethod,
  useShippingOptions,
  useStartPayment,
} from "@/features/checkout/hooks"
import { checkoutDetailsSchema } from "@/features/checkout/schema"
import { useCustomer } from "@/features/customer/hooks"
import {
  describeCompletionError,
  getCheckoutStep,
  getLineTotal,
  getPaymentOption,
  getPaymentOptions,
  NIGERIAN_STATES,
} from "@/lib/medusa/checkout"
import { formatPrice } from "@/lib/medusa/price"
import {
  contactPath,
  orderConfirmationPath,
  SHOPPING_BAG_PATH,
} from "@/lib/seo/routes"
import { cn } from "@/lib/util/cn"

type Cart = HttpTypes.StoreCart

const IS_DEVELOPMENT = process.env.NODE_ENV === "development"

const actionClass = "h-10 px-5 tracking-[0.06em] uppercase"

/**
 * Details, delivery and payment on one page, each opening once the one
 * before is done. Every step saves to the cart straight away, so a shopper
 * who leaves and comes back (or returns from an abandoned payment) carries
 * on where they were.
 */
export function CheckoutFlow({
  paymentProblem,
}: {
  paymentProblem: string | null
}) {
  const { data: cart } = useCart()

  if (!cart?.items?.length) {
    return (
      <p className="mt-6 text-[15px] text-muted-foreground">
        Your bag is empty.{" "}
        <Link href={SHOPPING_BAG_PATH} className="underline underline-offset-4">
          Back to your bag
        </Link>
      </p>
    )
  }

  return <Checkout cart={cart} paymentProblem={paymentProblem} />
}

function Checkout({
  cart,
  paymentProblem,
}: {
  cart: Cart
  paymentProblem: string | null
}) {
  const step = getCheckoutStep(cart)
  const [editingDetails, setEditingDetails] = useState(step === "details")
  const detailsDone = step !== "details" && !editingDetails

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
      <div className="flex flex-col">
        {paymentProblem && (
          <p
            role="alert"
            className="mb-6 border-l-2 border-gold pl-3 text-[15px]"
          >
            Your payment didn&apos;t go through, so no order was placed. Your
            bag is just as you left it; try again below.
          </p>
        )}

        <Step number={1} title="Contact and delivery address" open>
          {detailsDone ? (
            <DetailsSummary
              cart={cart}
              onEdit={() => setEditingDetails(true)}
            />
          ) : (
            <DetailsForm cart={cart} onSaved={() => setEditingDetails(false)} />
          )}
        </Step>

        <Step number={2} title="Delivery" open={detailsDone}>
          <DeliveryOptions cart={cart} />
        </Step>

        <Step
          number={3}
          title="Payment"
          open={detailsDone && step === "payment"}
        >
          <Payment cart={cart} />
        </Step>
      </div>

      <OrderSummary cart={cart} />
    </div>
  )
}

function Step({
  number,
  title,
  open,
  children,
}: {
  number: number
  title: string
  open: boolean
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby={`checkout-step-${number}`}
      className="border-t border-border/70 py-6 first:border-t-0 first:pt-0"
    >
      <h2
        id={`checkout-step-${number}`}
        className={cn(
          "text-[15px] font-medium",
          !open && "text-muted-foreground",
        )}
      >
        {number}. {title}
      </h2>
      {open && <div className="mt-5">{children}</div>}
    </section>
  )
}

function DetailsSummary({ cart, onEdit }: { cart: Cart; onEdit: () => void }) {
  const address = cart.shipping_address
  return (
    <div className="flex items-start justify-between gap-4 text-[13px]">
      <div className="leading-relaxed text-muted-foreground">
        <p className="text-foreground">{cart.email}</p>
        <p>
          {[address?.first_name, address?.last_name].filter(Boolean).join(" ")}
          {address?.phone ? ` · ${address.phone}` : ""}
        </p>
        <p>
          {[
            address?.address_1,
            address?.address_2,
            address?.city,
            address?.province,
          ]
            .filter(Boolean)
            .join(", ")}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 underline underline-offset-4"
      >
        Change
      </button>
    </div>
  )
}

function DetailsForm({ cart, onSaved }: { cart: Cart; onSaved: () => void }) {
  const { data: customer } = useCustomer()
  const save = useSaveCheckoutDetails()
  const address = cart.shipping_address
  const countryCode =
    address?.country_code ?? cart.region?.countries?.[0]?.iso_2 ?? "ng"

  const saved = customer?.addresses ?? []
  // An untouched checkout starts from the account's default address.
  const start =
    address?.address_1 || !saved.length
      ? address
      : (saved.find((entry) => entry.is_default_shipping) ?? saved[0])

  const form = useAppForm({
    defaultValues: {
      email: cart.email ?? customer?.email ?? "",
      first_name: start?.first_name ?? customer?.first_name ?? "",
      last_name: start?.last_name ?? customer?.last_name ?? "",
      phone: start?.phone ?? customer?.phone ?? "",
      address_1: start?.address_1 ?? "",
      address_2: start?.address_2 ?? "",
      city: start?.city ?? "",
      province: start?.province ?? "",
    },
    validationLogic: validateOnSubmitThenChange(),
    validators: { onDynamic: checkoutDetailsSchema },
    onSubmit: async ({ value }) => {
      try {
        await save.mutateAsync({ ...value, countryCode })
        onSaved()
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
      {saved.length > 1 && (
        <SavedAddressPicker
          addresses={saved}
          onPick={(picked) => {
            for (const key of [
              "first_name",
              "last_name",
              "phone",
              "address_1",
              "address_2",
              "city",
              "province",
            ] as const) {
              form.setFieldValue(key, picked[key] ?? "")
            }
          }}
        />
      )}
      <form.AppField name="email">
        {(field) => (
          <field.TextField
            label="Email"
            type="email"
            autoComplete="email"
            required
            description="For your order confirmation and delivery updates."
          />
        )}
      </form.AppField>
      <div className="grid gap-5 sm:grid-cols-2">
        <form.AppField name="first_name">
          {(field) => (
            <field.TextField
              label="First name"
              autoComplete="given-name"
              required
            />
          )}
        </form.AppField>
        <form.AppField name="last_name">
          {(field) => (
            <field.TextField
              label="Last name"
              autoComplete="family-name"
              required
            />
          )}
        </form.AppField>
      </div>
      <form.AppField name="phone">
        {(field) => (
          <field.TextField
            label="Phone"
            type="tel"
            autoComplete="tel"
            required
            description="The rider calls this number on delivery."
          />
        )}
      </form.AppField>
      <form.AppField name="address_1">
        {(field) => (
          <field.TextField
            label="Street address"
            autoComplete="address-line1"
            required
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
              required
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
              required
            />
          )}
        </form.AppField>
      </div>
      <form.AppForm>
        <form.SubmitButton
          size="lg"
          className={cn("self-start", actionClass)}
          pendingLabel="Saving…"
        >
          Continue to delivery
        </form.SubmitButton>
      </form.AppForm>
      {save.isError && (
        <FormAlert>
          {save.error.message ||
            "We couldn't save your details. Please try again."}
        </FormAlert>
      )}
    </form>
  )
}

function DeliveryOptions({ cart }: { cart: Cart }) {
  const options = useShippingOptions(cart.id, true)
  const setMethod = useSetShippingMethod()
  const chosen = setMethod.isPending
    ? setMethod.variables
    : cart.shipping_methods?.[0]?.shipping_option_id

  if (options.isPending) {
    return (
      <p className="text-[13px] text-muted-foreground">
        Loading delivery options…
      </p>
    )
  }

  if (options.isError || !options.data?.length) {
    return (
      <FormAlert>
        We can&apos;t deliver to this address yet. Check the state, or{" "}
        <Link
          href={contactPath({ topic: "Delivery" })}
          className="underline underline-offset-4"
        >
          message us
        </Link>{" "}
        and we&apos;ll arrange it.
      </FormAlert>
    )
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">Delivery option</legend>
      {options.data.map((option) => (
        <label
          key={option.id}
          className={cn(
            "flex cursor-pointer items-center justify-between gap-4 border px-4 py-3 text-[13px] transition-colors",
            chosen === option.id
              ? "border-foreground"
              : "border-border hover:border-foreground/40",
          )}
        >
          <span className="flex items-center gap-3">
            <input
              type="radio"
              name="shipping-option"
              value={option.id}
              checked={chosen === option.id}
              disabled={setMethod.isPending}
              onChange={() => setMethod.mutate(option.id)}
              className="size-4 accent-foreground"
            />
            {option.name}
          </span>
          <span className="tabular-nums">
            {formatPrice(Number(option.amount ?? 0), cart.currency_code)}
          </span>
        </label>
      ))}
      {setMethod.isError && (
        <FormAlert>
          {setMethod.error.message ||
            "We couldn't choose that option. Please try again."}
        </FormAlert>
      )}
    </fieldset>
  )
}

function Payment({ cart }: { cart: Cart }) {
  const router = useRouter()
  const providers = usePaymentProviders(cart.region_id ?? undefined)
  const start = useStartPayment()
  const options = getPaymentOptions(providers.data ?? [], IS_DEVELOPMENT)
  const [choice, setChoice] = useState<string | null>(null)
  const providerId = choice ?? options[0] ?? null
  const leaving = start.isSuccess && start.data.kind === "redirect"

  if (providers.isPending) {
    return (
      <p className="text-[13px] text-muted-foreground">
        Loading payment options…
      </p>
    )
  }

  if (!options.length) {
    return (
      <FormAlert>
        Online payment isn&apos;t available right now. Please try again later.
      </FormAlert>
    )
  }

  const pay = async () => {
    if (!providerId || !cart.email) return
    try {
      const result = await start.mutateAsync({
        cart,
        providerId,
        payer: {
          email: cart.email,
          first_name: cart.shipping_address?.first_name,
          last_name: cart.shipping_address?.last_name,
          phone: cart.shipping_address?.phone,
        },
      })
      if (result.kind === "redirect") {
        window.location.assign(result.url)
      } else {
        router.push(orderConfirmationPath(result.order.id))
      }
    } catch {
      // Shown below the button.
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Payment method</legend>
        {options.map((id) => {
          const option = getPaymentOption(id)
          return (
            <label
              key={id}
              className={cn(
                "flex cursor-pointer items-start gap-3 border px-4 py-3 text-[13px] transition-colors",
                providerId === id
                  ? "border-foreground"
                  : "border-border hover:border-foreground/40",
              )}
            >
              <input
                type="radio"
                name="payment-provider"
                value={id}
                checked={providerId === id}
                onChange={() => setChoice(id)}
                className="mt-0.5 size-4 accent-foreground"
              />
              <span>
                <span className="block">{option.label}</span>
                {option.detail && (
                  <span className="mt-1 block text-muted-foreground">
                    {option.detail}
                  </span>
                )}
              </span>
            </label>
          )
        })}
      </fieldset>
      <p className="text-[13px] text-muted-foreground">
        You&apos;ll finish paying on the provider&apos;s secure page, then come
        back here for your confirmation.
      </p>
      <Button
        size="lg"
        disabled={!providerId || start.isPending || leaving}
        aria-busy={start.isPending || leaving || undefined}
        onClick={pay}
        className={cn("self-start", actionClass)}
      >
        {start.isPending || leaving
          ? "Opening payment…"
          : `Pay ${formatPrice(Number(cart.total), cart.currency_code)}`}
      </Button>
      {start.isError && (
        <FormAlert>{describeCompletionError(start.error.message)}</FormAlert>
      )}
    </div>
  )
}

function OrderSummary({ cart }: { cart: Cart }) {
  const rows: [string, string][] = [
    [
      "Subtotal",
      formatPrice(
        Number(cart.item_subtotal ?? cart.subtotal ?? 0),
        cart.currency_code,
      ),
    ],
  ]
  if (Number(cart.discount_total) > 0) {
    rows.push([
      "Discount",
      `−${formatPrice(Number(cart.discount_total), cart.currency_code)}`,
    ])
  }
  rows.push([
    "Delivery",
    cart.shipping_methods?.length
      ? formatPrice(Number(cart.shipping_total ?? 0), cart.currency_code)
      : "Chosen at the next step",
  ])
  if (Number(cart.tax_total) > 0) {
    rows.push(["Tax", formatPrice(Number(cart.tax_total), cart.currency_code)])
  }

  return (
    <aside
      aria-labelledby="checkout-summary"
      className="lg:sticky lg:top-24 lg:self-start"
    >
      <div className="flex items-baseline justify-between border-b border-border/70 pb-3">
        <h2 id="checkout-summary" className="text-[15px] font-medium">
          Your bag
        </h2>
        <Link
          href={SHOPPING_BAG_PATH}
          className="text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Edit
        </Link>
      </div>
      <ul className="divide-y divide-border/70">
        {(cart.items ?? []).map((item) => (
          <li key={item.id} className="flex gap-3 py-4">
            {item.thumbnail ? (
              <Image
                src={item.thumbnail}
                alt=""
                width={48}
                height={60}
                className="aspect-4/5 w-12 shrink-0 bg-muted object-cover"
              />
            ) : (
              <div className="aspect-4/5 w-12 shrink-0 bg-muted" />
            )}
            <div className="min-w-0 flex-1 text-[13px]">
              <p>{item.product_title ?? item.title}</p>
              <p className="mt-1 text-muted-foreground">
                {[item.variant_title, `Qty ${item.quantity}`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <p className="shrink-0 text-[13px] tabular-nums">
              {formatPrice(getLineTotal(item), cart.currency_code)}
            </p>
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-2 border-t border-border/70 pt-4 text-[13px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="tabular-nums">{value}</dd>
          </div>
        ))}
        <div className="mt-1 flex justify-between gap-4 border-t border-border/70 pt-3 text-[15px] font-medium">
          <dt>Total</dt>
          <dd className="tabular-nums">
            {formatPrice(Number(cart.total), cart.currency_code)}
          </dd>
        </div>
      </dl>
    </aside>
  )
}

/** For signed-in customers with several saved addresses (Account › Addresses). */
function SavedAddressPicker({
  addresses,
  onPick,
}: {
  addresses: HttpTypes.StoreCustomerAddress[]
  onPick: (address: HttpTypes.StoreCustomerAddress) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-medium">
        Use a saved address
      </label>
      <select
        id={id}
        defaultValue=""
        onChange={(event) => {
          const picked = addresses.find((a) => a.id === event.target.value)
          if (picked) onPick(picked)
        }}
        className="h-8 w-full rounded-none border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
      >
        <option value="">Choose one</option>
        {addresses.map((address) => (
          <option key={address.id} value={address.id}>
            {[address.address_1, address.city, address.province]
              .filter(Boolean)
              .join(", ")}
          </option>
        ))}
      </select>
    </div>
  )
}
