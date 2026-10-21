"use client"

import { useMutation } from "@tanstack/react-query"
import { useId, useState, type ReactNode } from "react"

import {
  FormAlert,
  primaryButtonClass,
} from "@/components/account/account-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toaster"
import { useCustomer } from "@/features/customer/hooks"
import { getBrowserSdk } from "@/lib/medusa/browser"

export const TOPICS = [
  "An order",
  "Delivery",
  "A return or refund",
  "A product or sizing",
  "Something else",
] as const

export type Topic = (typeof TOPICS)[number]

const selectClass =
  "h-10 w-full rounded-none border border-input bg-transparent px-3 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"

/** Sends to the support inbox; replies come to the email given here. */
export function ContactForm({
  responseTime,
  initialTopic = "",
  initialOrderNumber = "",
}: {
  responseTime: string | null
  /** From the link that brought the shopper here, e.g. an order page. */
  initialTopic?: Topic | ""
  initialOrderNumber?: string
}) {
  const id = useId()
  const customer = useCustomer()
  // Null until edited, so a signed-in customer's details fill in.
  const [name, setName] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [topic, setTopic] = useState<Topic | "">(initialTopic)
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber)
  const [message, setMessage] = useState("")
  const [website, setWebsite] = useState("")
  const [problem, setProblem] = useState<string | null>(null)

  const signedIn = customer.data
  const nameValue =
    name ??
    [signedIn?.first_name, signedIn?.last_name].filter(Boolean).join(" ")
  const emailValue = email ?? signedIn?.email ?? ""

  const send = useMutation({
    mutationFn: () =>
      getBrowserSdk().client.fetch<{ sent: true }>("/store/contact", {
        method: "POST",
        body: {
          name: nameValue.trim(),
          email: emailValue.trim(),
          topic: topic || null,
          order_number: orderNumber.trim() || null,
          message: message.trim(),
          website,
        },
      }),
    onSuccess: () =>
      toast.success("Message sent", {
        description: "We've emailed you a copy.",
      }),
  })

  if (send.isSuccess) {
    return (
      <div role="status" className="flex flex-col gap-3 text-[15px]">
        <p className="font-medium">Thanks, your message is on its way.</p>
        <p className="text-muted-foreground">
          {responseTime
            ? `We usually reply ${responseTime}, to ${emailValue.trim()}.`
            : `We'll reply to ${emailValue.trim()} as soon as we can.`}{" "}
          We&apos;ve emailed you a copy; reply to it if you think of anything
          else.
        </p>
      </div>
    )
  }

  const submit = () => {
    if (!nameValue.trim()) return setProblem("Tell us your name.")
    if (!/^\S+@\S+\.\S+$/.test(emailValue.trim()))
      return setProblem("Enter an email we can reply to.")
    if (orderNumber.trim() && !/^#?\d{1,10}$/.test(orderNumber.trim()))
      return setProblem(
        "Enter the order number from your order email, like 1042.",
      )
    if (message.trim().length < 10)
      return setProblem("Tell us a little more, at least a sentence.")
    setProblem(null)
    send.mutate()
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className="flex flex-col gap-5"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor={`${id}-name`}>
          <Input
            id={`${id}-name`}
            autoComplete="name"
            maxLength={100}
            value={nameValue}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="Email" htmlFor={`${id}-email`}>
          <Input
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            value={emailValue}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="What it's about" htmlFor={`${id}-topic`} optional>
          <select
            id={`${id}-topic`}
            value={topic}
            onChange={(event) => setTopic(event.target.value as Topic | "")}
            className={selectClass}
          >
            <option value="">Choose one</option>
            {TOPICS.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>
        <Field label="Order number" htmlFor={`${id}-order`} optional>
          <Input
            id={`${id}-order`}
            inputMode="numeric"
            placeholder="e.g. 1042"
            value={orderNumber}
            onChange={(event) => setOrderNumber(event.target.value)}
          />
        </Field>
      </div>
      <Field label="Message" htmlFor={`${id}-message`}>
        <Textarea
          id={`${id}-message`}
          rows={6}
          maxLength={4000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      </Field>
      {/* For bots only: people never see it, so anything typed here marks spam. */}
      <div
        aria-hidden
        className="absolute -left-[9999px] h-px w-px overflow-hidden"
      >
        <label htmlFor={`${id}-website`}>Website</label>
        <input
          id={`${id}-website`}
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>
      <Button
        type="submit"
        size="lg"
        disabled={send.isPending}
        className={`self-start ${primaryButtonClass}`}
      >
        {send.isPending ? "Sending…" : "Send message"}
      </Button>
      {(problem || send.isError) && (
        <FormAlert>
          {problem ??
            "We couldn't send your message. Please try again in a minute, or email us directly."}
        </FormAlert>
      )}
    </form>
  )
}

function Field({
  label,
  htmlFor,
  optional = false,
  children,
}: {
  label: string
  htmlFor: string
  optional?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-[13px] font-medium">
        {label}
        {optional && (
          <span className="font-normal text-muted-foreground"> (optional)</span>
        )}
      </label>
      {children}
    </div>
  )
}
