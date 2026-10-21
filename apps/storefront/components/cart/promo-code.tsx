"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useApplyPromoCode, useRemovePromoCode } from "@/features/cart/hooks"

const actionLink =
  "text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"

/** Applied codes with remove, and a field to add one. On the bag and at checkout. */
export function PromoCode({ applied }: { applied: string[] }) {
  const apply = useApplyPromoCode()
  const remove = useRemovePromoCode()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  const submit = async () => {
    const value = code.trim()
    if (!value) return
    setMessage(null)
    try {
      const cart = await apply.mutateAsync(value)
      const used = (cart.promotions ?? []).some(
        (promotion) => promotion.code?.toLowerCase() === value.toLowerCase(),
      )
      if (used) {
        setCode("")
        setOpen(false)
      } else {
        setMessage("That code isn't valid for this bag.")
      }
    } catch {
      setMessage("That code isn't valid for this bag.")
    }
  }

  return (
    <div className="mt-5 border-t border-border pt-4 text-[13px]">
      {applied.map((value) => (
        <p key={value} className="mb-2 flex items-center justify-between gap-4">
          <span>
            Code <span className="font-medium uppercase">{value}</span> applied
          </span>
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => remove.mutate(value)}
            className={actionLink}
          >
            Remove
          </button>
        </p>
      ))}
      {open ? (
        <form
          className="mt-1 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <Input
            aria-label="Promo code"
            placeholder="Promo code"
            value={code}
            autoFocus
            autoCapitalize="characters"
            onChange={(event) => setCode(event.target.value)}
            className="h-10 bg-background uppercase"
          />
          <Button
            type="submit"
            variant="outline"
            disabled={apply.isPending || !code.trim()}
            className="h-10 px-4 text-[12px] tracking-[0.06em] uppercase"
          >
            {apply.isPending ? "…" : "Apply"}
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={actionLink}
        >
          Add a promo code
        </button>
      )}
      {message && (
        <p role="alert" className="mt-2 text-destructive">
          {message}
        </p>
      )}
    </div>
  )
}
