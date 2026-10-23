"use client"

import { useRouter } from "next/navigation"

import { FormAlert } from "@/components/account/account-shell"
import { Button } from "@/components/ui/button"
import { useSignOutEverywhere } from "@/features/customer/hooks"

/** For a lost phone or a shared computer: ends every sign-in, this one too. */
export function SignOutEverywhere() {
  const router = useRouter()
  const signOut = useSignOutEverywhere()

  return (
    <div className="flex max-w-md flex-col gap-5">
      <p className="text-[13px] text-muted-foreground">
        Signed in somewhere you no longer use? Sign out everywhere, including
        here. Changing your password does this too.
      </p>
      <Button
        variant="outline"
        size="lg"
        disabled={signOut.isPending}
        onClick={() =>
          signOut.mutate(undefined, { onSuccess: () => router.push("/") })
        }
        className="self-start px-4 tracking-[0.06em] uppercase"
      >
        {signOut.isPending ? "Signing out…" : "Sign out of all devices"}
      </Button>
      {signOut.isError && (
        <FormAlert>
          {signOut.error.message ||
            "We couldn't sign you out everywhere. Please try again."}
        </FormAlert>
      )}
    </div>
  )
}
