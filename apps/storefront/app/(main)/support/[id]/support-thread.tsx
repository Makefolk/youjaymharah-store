"use client"

import { useState } from "react"

import {
  FormAlert,
  primaryButtonClass,
} from "@/components/account/account-shell"
import { formatDate } from "@/components/orders/format"
import { PhotoPicker } from "@/components/support/photo-picker"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toaster"
import { useReplyToRequest, type SupportStatus } from "@/features/support/hooks"
import type { SupportRequestDetail } from "@/features/support/server"
import type { PhotoUpload } from "@/lib/help/photos"
import { cn } from "@/lib/util/cn"

export const STATUS_TEXT: Record<SupportStatus, string> = {
  open: "With us: we'll reply by email",
  awaiting_customer: "We've replied",
  resolved: "Resolved",
}

/**
 * Photos are private: their URL is a backend path, fetched through the
 * proxy with this browser's sign-in or the request's link key.
 */
function photoSrc(url: string, access: string | null) {
  if (!url.startsWith("/store/")) return url
  return `/api/medusa${url}${access ? `?access=${encodeURIComponent(access)}` : ""}`
}

export function SupportThread({
  request,
  access,
}: {
  request: SupportRequestDetail
  access: string | null
}) {
  const reply = useReplyToRequest(request.id, access)
  const [messages, setMessages] = useState(request.messages)
  const [status, setStatus] = useState(request.status)
  const [body, setBody] = useState("")
  const [photos, setPhotos] = useState<PhotoUpload[]>([])

  const send = () => {
    if (!body.trim()) return
    reply.mutate(
      { body: body.trim(), photos },
      {
        onSuccess: (thread) => {
          setMessages(thread)
          setStatus("open")
          setBody("")
          setPhotos([])
          toast.success("Sent", { description: "We'll reply by email." })
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="text-[13px]">
        <span className="text-muted-foreground">Status: </span>
        {STATUS_TEXT[status]}
      </p>
      <ol className="flex flex-col gap-4">
        {messages.map((message) => (
          <li
            key={message.id}
            className={cn(
              "flex flex-col gap-2 p-4 text-[15px]",
              message.author === "staff"
                ? "bg-secondary text-secondary-foreground"
                : "border border-border",
            )}
          >
            <p className="text-[12px] text-muted-foreground">
              {message.author === "staff" ? "Our team" : "You"} ·{" "}
              {formatDate(message.created_at)}
            </p>
            <p className="whitespace-pre-wrap">{message.body}</p>
            {message.photos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {message.photos.map((photo) => (
                  <a
                    key={photo.url}
                    href={photoSrc(photo.url, access)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- private photos, served after an access check */}
                    <img
                      src={photoSrc(photo.url, access)}
                      alt={photo.name}
                      className="size-20 object-cover"
                    />
                  </a>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          send()
        }}
        className="flex flex-col gap-4 border-t border-border/70 pt-6"
      >
        <label htmlFor="support-reply" className="text-[13px] font-medium">
          {status === "resolved"
            ? "Need more help? Reply to reopen it"
            : "Reply"}
        </label>
        <Textarea
          id="support-reply"
          rows={4}
          maxLength={4000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        <PhotoPicker photos={photos} onChange={setPhotos} />
        <Button
          type="submit"
          size="lg"
          disabled={!body.trim() || reply.isPending}
          className={`self-start ${primaryButtonClass}`}
        >
          {reply.isPending ? "Sending…" : "Send"}
        </Button>
        {reply.isError && (
          <FormAlert>
            {reply.error.message || "We couldn't send that. Please try again."}
          </FormAlert>
        )}
      </form>
    </div>
  )
}
