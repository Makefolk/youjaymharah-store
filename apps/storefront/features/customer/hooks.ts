"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"

import { postJson } from "@/lib/http/post-json"
import { getBrowserSdk } from "@/lib/medusa/browser"
import { privateQueryRoots, queryKeys } from "@/lib/query/keys"

import { customerQueries, type EmailVerificationState } from "./queries"

type Success = { success: true }

export function useCustomer() {
  return useQuery(customerQueries.me())
}

/** Refetches private data and re-renders Server Components as the new customer. */
function useSignedInSync() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return async () => {
    // A guest cart has just been transferred to the customer, so it changed too.
    await Promise.all(
      privateQueryRoots.map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    )
    router.refresh()
  }
}

export function useLogin() {
  const onSignedIn = useSignedInSync()

  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      postJson<Success>("/api/auth/login", input),
    onSuccess: onSignedIn,
  })
}

export function useRegister() {
  const onSignedIn = useSignedInSync()

  return useMutation({
    mutationFn: (input: {
      email: string
      password: string
      first_name?: string
      last_name?: string
    }) => postJson<Success>("/api/auth/register", input),
    onSuccess: onSignedIn,
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: () => postJson<Success>("/api/auth/logout"),
    onSuccess: () => {
      // Removed rather than invalidated: invalidating would briefly show the
      // previous customer's data while the refetch runs.
      for (const queryKey of privateQueryRoots) {
        queryClient.removeQueries({ queryKey })
      }
      queryClient.setQueryData(queryKeys.customer.me(), null)
      router.refresh()
    },
  })
}

/** Emails a reset link. Succeeds whether or not the address has an account. */
export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (input: { email: string }) =>
      postJson<Success>("/api/auth/password-reset", input),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: { token: string; email: string; password: string }) =>
      postJson<Success>("/api/auth/password-reset/confirm", input),
  })
}

export function useEmailVerification({ enabled = true } = {}) {
  return useQuery({ ...customerQueries.emailVerification(), enabled })
}

/** Emails the signed-in customer a link to verify their account's email. */
export function useSendVerificationEmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      getBrowserSdk().client.fetch<EmailVerificationState & { sent: boolean }>(
        "/store/customers/me/email-verification",
        { method: "POST" },
      ),
    onSuccess: ({ email, verified }) =>
      queryClient.setQueryData(queryKeys.customer.emailVerification(), {
        email,
        verified,
      }),
  })
}

/**
 * Spends the token from a verification email. Works signed out; when signed
 * in, the account's orders are refetched, as guest orders join it shortly
 * after.
 */
export function useVerifyEmail() {
  const onSignedIn = useSignedInSync()

  return useMutation({
    mutationFn: (token: string) =>
      getBrowserSdk().client.fetch<{ email: string; verified: true }>(
        "/store/customers/verify-email",
        { method: "POST", body: { token } },
      ),
    onSuccess: onSignedIn,
  })
}
