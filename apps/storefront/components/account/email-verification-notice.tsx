"use client"

import { toast } from "@/components/ui/toaster"
import {
  useEmailVerification,
  useSendVerificationEmail,
} from "@/features/customer/hooks"

/**
 * Until the account's email is verified, its guest orders stay out of the
 * account (anyone can register any address), so say so and offer the link.
 */
export function EmailVerificationNotice() {
  const state = useEmailVerification()
  const send = useSendVerificationEmail()

  if (!state.data || state.data.verified) return null

  return (
    <div className="mt-8 flex flex-col gap-3 bg-secondary px-5 py-4 text-secondary-foreground sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <p className="text-[13px] leading-relaxed">
        Verify {state.data.email} to bring orders you placed as a guest into
        your account.
      </p>
      <button
        type="button"
        disabled={send.isPending}
        onClick={() =>
          send.mutate(undefined, {
            onSuccess: ({ sent, email }) =>
              sent
                ? toast.success("Check your inbox", {
                    description: `We've sent a link to ${email}. It works for 15 minutes.`,
                  })
                : toast.info("Your email is already verified"),
            onError: () =>
              toast.error("Couldn't send the email", {
                description: "Please try again in a minute.",
              }),
          })
        }
        className="shrink-0 self-start text-[12px] font-medium tracking-[0.12em] uppercase underline underline-offset-4 disabled:opacity-60 sm:self-auto"
      >
        {send.isPending ? "Sending…" : "Send link"}
      </button>
    </div>
  )
}
