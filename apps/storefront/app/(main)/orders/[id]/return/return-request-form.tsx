"use client"

import Image from "next/image"
import Link from "next/link"
import { useId, useState } from "react"

import {
  FormAlert,
  primaryButtonClass,
} from "@/components/account/account-shell"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useRequestReturn } from "@/features/orders/hooks"
import { orderPath } from "@/lib/seo/routes"

import { ReturnAccessRequest } from "./return-access-request"

export type ReturnableItem = {
  id: string
  title: string
  variant: string | null
  thumbnail: string | null
  /** How many can still be returned. */
  max: number
  returnBy: string | null
}

const selectClass =
  "h-8 rounded-none border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"

export function ReturnRequestForm({
  orderId,
  items,
  reasons,
  access,
}: {
  orderId: string
  items: ReturnableItem[]
  reasons: { id: string; label: string }[]
  /** A guest's token from the emailed return link; null when signed in. */
  access: string | null
}) {
  const id = useId()
  const request = useRequestReturn(orderId)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [reasonId, setReasonId] = useState("")
  const [note, setNote] = useState("")
  const [problem, setProblem] = useState<string | null>(null)

  const chosen = items
    .filter((item) => (quantities[item.id] ?? 0) > 0)
    .map((item) => ({ id: item.id, quantity: quantities[item.id] }))

  if (request.isSuccess) {
    return (
      <div role="status" className="flex flex-col gap-4 text-[15px]">
        <p>
          Return requested. We&apos;ve emailed you a confirmation and will be in
          touch to arrange collection or drop-off. Your refund follows once the
          items reach us.
        </p>
        <Link
          href={orderPath(orderId)}
          className="self-start underline underline-offset-4"
        >
          Back to your order
        </Link>
      </div>
    )
  }

  const submit = () => {
    if (!chosen.length) {
      setProblem("Choose at least one item to return.")
      return
    }
    setProblem(null)
    request.mutate({
      items: chosen.map((item) => ({
        ...item,
        reason_id: reasonId || null,
      })),
      note: note.trim() || null,
      access,
    })
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className="flex flex-col gap-6"
    >
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 text-[13px] font-medium">
          What are you returning?
        </legend>
        {items.map((item) => {
          const selected = (quantities[item.id] ?? 0) > 0
          return (
            <div key={item.id} className="flex items-start gap-3">
              <input
                id={`${id}-${item.id}`}
                type="checkbox"
                checked={selected}
                onChange={(event) =>
                  setQuantities((current) => ({
                    ...current,
                    [item.id]: event.target.checked ? 1 : 0,
                  }))
                }
                className="mt-1 size-4 accent-foreground"
              />
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
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={`${id}-${item.id}`}
                  className="text-[15px] leading-snug"
                >
                  {item.title}
                </label>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {[item.variant, item.returnBy && `Return by ${item.returnBy}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {selected && item.max > 1 && (
                <select
                  aria-label={`How many of ${item.title}`}
                  value={quantities[item.id]}
                  onChange={(event) =>
                    setQuantities((current) => ({
                      ...current,
                      [item.id]: Number(event.target.value),
                    }))
                  }
                  className={selectClass}
                >
                  {Array.from({ length: item.max }, (_, index) => (
                    <option key={index + 1} value={index + 1}>
                      {index + 1}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )
        })}
      </fieldset>

      {reasons.length > 0 && (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-reason`} className="text-[13px] font-medium">
            Reason (optional)
          </label>
          <select
            id={`${id}-reason`}
            value={reasonId}
            onChange={(event) => setReasonId(event.target.value)}
            className={selectClass}
          >
            <option value="">Choose a reason</option>
            {reasons.map((reason) => (
              <option key={reason.id} value={reason.id}>
                {reason.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-note`} className="text-[13px] font-medium">
          Anything we should know? (optional)
        </label>
        <Textarea
          id={`${id}-note`}
          rows={3}
          maxLength={1000}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={request.isPending}
        aria-busy={request.isPending || undefined}
        className={`self-start ${primaryButtonClass}`}
      >
        {request.isPending ? "Sending request…" : "Request return"}
      </Button>
      {(problem || request.isError) && (
        <FormAlert>
          {problem ??
            request.error?.message ??
            "We couldn't send the request. Please try again."}
        </FormAlert>
      )}
      {access && request.isError && (
        <ReturnAccessRequest orderId={orderId} again />
      )}
    </form>
  )
}
