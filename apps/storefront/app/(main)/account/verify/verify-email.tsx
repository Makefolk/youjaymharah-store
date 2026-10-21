"use client"

import Link from "next/link"

import {
  FormAlert,
  primaryButtonClass,
} from "@/components/account/account-shell"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toaster"
import {
  useCustomer,
  useSendVerificationEmail,
  useVerifyEmail,
} from "@/features/customer/hooks"
import { ACCOUNT_PATH, SIGN_IN_PATH } from "@/lib/seo/routes"

/**
 * Asks for a click instead of verifying on load: some mail providers open
 * every link in an email to scan it, which would spend the single-use token
 * before the customer arrives.
 */
export function VerifyEmail({ token }: { token: string | null }) {
  const verify = useVerifyEmail()
  const customer = useCustomer()
  const send = useSendVerificationEmail()

  if (verify.isSuccess) {
    return (
      <div className="flex flex-col gap-6">
        <p role="status" className="text-[15px]">
          {verify.data.email} is verified. Orders you placed as a guest with
          this email will appear in your account in a moment.
        </p>
        <Button
          size="lg"
          className={primaryButtonClass}
          render={<Link href={ACCOUNT_PATH} />}
          nativeButton={false}
        >
          Go to your account
        </Button>
      </div>
    )
  }

  const sendNewLink = () =>
    send.mutate(undefined, {
      onSuccess: ({ sent, email }) =>
        sent
          ? toast.success("Check your inbox", {
              description: `We've sent a new link to ${email}.`,
            })
          : toast.info("Your email is already verified"),
      onError: () =>
        toast.error("Couldn't send the email", {
          description: "Please try again in a minute.",
        }),
    })

  const recovery = customer.data ? (
    <Button
      variant="outline"
      size="lg"
      className={primaryButtonClass}
      disabled={send.isPending}
      onClick={sendNewLink}
    >
      {send.isPending ? "Sending…" : "Send a new link"}
    </Button>
  ) : (
    <p className="text-[15px] text-muted-foreground">
      <Link
        href={`${SIGN_IN_PATH}?next=${encodeURIComponent(ACCOUNT_PATH)}`}
        className="text-foreground underline underline-offset-4"
      >
        Sign in
      </Link>{" "}
      to send a new link from your account.
    </p>
  )

  if (!token) {
    return (
      <div className="flex flex-col gap-6">
        <p className="text-[15px] text-muted-foreground">
          This link isn&apos;t complete. Open it again from the email, or send a
          new one.
        </p>
        {recovery}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[15px] text-muted-foreground">
        Confirm this is your email address. Orders you placed as a guest with it
        will then appear in your account.
      </p>
      {verify.isError && (
        <FormAlert>
          This link has expired or was already used. Links work once, for 15
          minutes.
        </FormAlert>
      )}
      {verify.isError ? (
        recovery
      ) : (
        <Button
          size="lg"
          className={primaryButtonClass}
          disabled={verify.isPending}
          onClick={() => verify.mutate(token)}
        >
          {verify.isPending ? "Verifying…" : "Verify my email"}
        </Button>
      )}
    </div>
  )
}
