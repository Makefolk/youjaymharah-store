"use client"

import { FormAlert } from "@/components/account/account-shell"
import { toast } from "@/components/ui/toaster"
import {
  useMarketingPreference,
  useSetMarketingPreference,
} from "@/features/marketing/hooks"

const STATUS_TEXT = {
  subscribed: "You get our newsletter: new collections and invitations.",
  pending:
    "Almost there: open the email we sent you and confirm to start receiving the newsletter.",
  unsubscribed: "You don't get our newsletter.",
  none: "You don't get our newsletter.",
} as const

/**
 * The newsletter switch. Turning it on usually waits for the confirmation
 * email, so the status shown is the server's, not the switch's.
 */
export function NewsletterPreference() {
  const preference = useMarketingPreference()
  const set = useSetMarketingPreference()

  if (preference.isPending) {
    return <p className="text-[13px] text-muted-foreground">Loading…</p>
  }
  if (preference.isError) {
    return <FormAlert>We couldn&apos;t load your email preferences.</FormAlert>
  }

  const { status, available, consent_text } = preference.data
  const on = status === "subscribed" || status === "pending"

  if (!available && !on) {
    return (
      <p className="text-[15px] text-muted-foreground">
        Our newsletter isn&apos;t open for sign-ups right now.
      </p>
    )
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <p className="text-[15px]">{STATUS_TEXT[status]}</p>
      {!on && consent_text && (
        <p className="text-[13px] text-muted-foreground">{consent_text}</p>
      )}
      <button
        type="button"
        disabled={set.isPending}
        onClick={() =>
          set.mutate(!on, {
            onSuccess: (marketing) =>
              marketing.status === "pending"
                ? toast.success("Check your inbox", {
                    description:
                      "Confirm your subscription from the email we sent.",
                  })
                : toast.info(
                    marketing.status === "subscribed"
                      ? "You're subscribed"
                      : "You're unsubscribed",
                  ),
            onError: () => toast.error("Couldn't update your preference"),
          })
        }
        className="self-start text-[12px] font-medium tracking-[0.12em] uppercase underline underline-offset-4 disabled:opacity-60"
      >
        {set.isPending ? "Saving…" : on ? "Unsubscribe" : "Subscribe"}
      </button>
      {set.isError && (
        <FormAlert>
          {set.error.message || "We couldn't update your preference."}
        </FormAlert>
      )}
    </div>
  )
}
