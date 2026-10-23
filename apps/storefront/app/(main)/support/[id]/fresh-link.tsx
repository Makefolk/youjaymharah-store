"use client"

import { FormAlert } from "@/components/account/account-shell"
import { Button } from "@/components/ui/button"
import { useRequestSupportLink } from "@/features/support/hooks"
import { errorStatus } from "@/lib/medusa/errors"

/** For an expired or cancelled link: a new one, to the request's email. */
export function FreshLink({ requestId }: { requestId: string }) {
  const send = useRequestSupportLink(requestId)

  if (send.isSuccess) {
    return (
      <p role="status" className="text-[15px] text-muted-foreground">
        If this request is ours, we&apos;ve emailed a fresh link to the address
        it was made with. It can take a few minutes.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="outline"
        size="lg"
        disabled={send.isPending}
        onClick={() => send.mutate()}
        className="self-start px-4 tracking-[0.06em] uppercase"
      >
        {send.isPending ? "Sending…" : "Email me a fresh link"}
      </Button>
      {send.isError && (
        <FormAlert>
          {errorStatus(send.error) === 429
            ? "Too many requests. Wait a minute and try again."
            : "Something went wrong. Please try again."}
        </FormAlert>
      )}
    </div>
  )
}
