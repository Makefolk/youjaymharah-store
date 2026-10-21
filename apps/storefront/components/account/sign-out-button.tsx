"use client"

import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useLogout } from "@/features/customer/hooks"

export function SignOutButton() {
  const router = useRouter()
  const logout = useLogout()

  return (
    <Button
      variant="outline"
      size="lg"
      disabled={logout.isPending}
      onClick={() =>
        logout.mutate(undefined, { onSuccess: () => router.push("/") })
      }
      className="px-4 tracking-[0.06em] uppercase"
    >
      {logout.isPending ? "Signing out…" : "Sign out"}
    </Button>
  )
}
