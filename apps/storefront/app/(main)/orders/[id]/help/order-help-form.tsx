"use client"

import { useId, useState } from "react"

import {
  FormAlert,
  primaryButtonClass,
} from "@/components/account/account-shell"
import { PhotoPicker } from "@/components/support/photo-picker"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useOrderHelp, type OrderHelpKind } from "@/features/support/hooks"
import type { PhotoUpload } from "@/lib/help/photos"
import { cn } from "@/lib/util/cn"

const KINDS: { kind: OrderHelpKind; label: string; hint: string }[] = [
  {
    kind: "cancel",
    label: "Cancel my order",
    hint: "We can cancel it until it's sent. Tell us whether it's all of it or some items.",
  },
  {
    kind: "change_address",
    label: "Change the delivery address",
    hint: "Give the full new address and a phone number. We can change it until it's sent.",
  },
  {
    kind: "exchange",
    label: "Exchange for another size",
    hint: "Tell us the item and the size you'd like instead.",
  },
  {
    kind: "damaged",
    label: "Something arrived damaged or faulty",
    hint: "Tell us what's wrong; photos help us sort it quickly.",
  },
  {
    kind: "missing",
    label: "Something is missing or wrong",
    hint: "Tell us what you expected and what arrived; a photo of the parcel helps.",
  },
  {
    kind: "order",
    label: "Something else about this order",
    hint: "Ask us anything about it.",
  },
]

const PHOTO_KINDS: OrderHelpKind[] = ["damaged", "missing", "exchange"]

/**
 * The structured "I need something done" form. It never changes the order
 * itself: a person checks and replies to the order's email first.
 */
export function OrderHelpForm({
  orderId,
  orderKey,
  initialKind,
}: {
  orderId: string
  orderKey: string | null
  initialKind: string | null
}) {
  const id = useId()
  const help = useOrderHelp(orderId, orderKey)
  const [kind, setKind] = useState<OrderHelpKind | null>(
    KINDS.find((option) => option.kind === initialKind)?.kind ?? null,
  )
  const [message, setMessage] = useState("")
  const [photos, setPhotos] = useState<PhotoUpload[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const chosen = KINDS.find((option) => option.kind === kind)

  if (help.isSuccess) {
    return (
      <div role="status" className="flex flex-col gap-3 text-[15px]">
        <p className="font-medium">
          Thanks. Your reference is {help.data.reference}.
        </p>
        <p className="text-muted-foreground">
          We&apos;ve emailed {help.data.sent_to} a confirmation with a link to
          follow your request, and we&apos;ll reply there. Nothing about your
          order changes until we&apos;ve been in touch.
        </p>
      </div>
    )
  }

  const submit = () => {
    if (!kind) return setProblem("Choose what you need help with.")
    if (message.trim().length < 10)
      return setProblem("Tell us a little more, at least a sentence.")
    setProblem(null)
    help.mutate({ kind, message: message.trim(), photos })
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
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13px] font-medium">
          What do you need?
        </legend>
        {KINDS.map((option) => (
          <label
            key={option.kind}
            className={cn(
              "flex cursor-pointer items-center gap-3 border px-4 py-3 text-[13px] transition-colors",
              kind === option.kind
                ? "border-foreground"
                : "border-border hover:border-foreground/40",
            )}
          >
            <input
              type="radio"
              name="kind"
              value={option.kind}
              checked={kind === option.kind}
              onChange={() => setKind(option.kind)}
              className="size-4 accent-foreground"
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-message`} className="text-[13px] font-medium">
          Details
        </label>
        {chosen && (
          <span className="text-[13px] text-muted-foreground">
            {chosen.hint}
          </span>
        )}
        <Textarea
          id={`${id}-message`}
          rows={5}
          maxLength={4000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>

      {kind && PHOTO_KINDS.includes(kind) && (
        <PhotoPicker photos={photos} onChange={setPhotos} />
      )}

      <Button
        type="submit"
        size="lg"
        disabled={help.isPending}
        className={`self-start ${primaryButtonClass}`}
      >
        {help.isPending ? "Sending…" : "Send"}
      </Button>
      {(problem || help.isError) && (
        <FormAlert>
          {problem ??
            (help.error?.message ||
              "We couldn't send your request. Please try again.")}
        </FormAlert>
      )}
    </form>
  )
}
