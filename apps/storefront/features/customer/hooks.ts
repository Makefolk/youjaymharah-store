"use client"

import type { HttpTypes } from "@medusajs/types"
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

/** Writes the returned customer into the cache, so every view updates at once. */
function useCustomerResult() {
  const queryClient = useQueryClient()
  return ({ customer }: { customer: HttpTypes.StoreCustomer }) =>
    queryClient.setQueryData(queryKeys.customer.me(), customer)
}

export function useUpdateProfile() {
  const onSaved = useCustomerResult()
  return useMutation({
    mutationFn: (input: {
      first_name: string
      last_name: string
      phone: string
    }) =>
      getBrowserSdk().store.customer.update({
        first_name: input.first_name.trim() || undefined,
        last_name: input.last_name.trim() || undefined,
        phone: input.phone.trim() || undefined,
      }),
    onSuccess: onSaved,
  })
}

export type AddressInput = {
  first_name: string
  last_name: string
  phone: string
  address_1: string
  address_2: string
  city: string
  province: string
}

/** Adds an address, or updates `id`'s; `isDefault` makes it the delivery default. */
export function useSaveAddress() {
  const onSaved = useCustomerResult()
  return useMutation({
    mutationFn: ({
      id,
      isDefault,
      ...address
    }: AddressInput & { id?: string; isDefault?: boolean }) => {
      const body = {
        ...address,
        address_2: address.address_2.trim() || undefined,
        country_code: "ng",
        ...(isDefault !== undefined
          ? { is_default_shipping: isDefault, is_default_billing: isDefault }
          : {}),
      }
      const sdk = getBrowserSdk()
      return id
        ? sdk.store.customer.updateAddress(id, body)
        : sdk.store.customer.createAddress(body)
    },
    onSuccess: onSaved,
  })
}

export function useDeleteAddress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      getBrowserSdk().store.customer.deleteAddress(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.customer.me() }),
  })
}

export function useSignInMethods() {
  return useQuery({
    queryKey: [...queryKeys.customer.all, "sign-in-methods"],
    queryFn: () =>
      getBrowserSdk().client.fetch<{ has_password: boolean; google: boolean }>(
        "/store/customers/me/password",
      ),
  })
}

/**
 * Changes an existing password; refused when the current one is wrong. Every
 * other device is signed out; this one stays signed in.
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { current_password: string; new_password: string }) =>
      postJson<Success>("/api/auth/password/change", input),
  })
}

/** Ends every sign-in to the account, this browser's included. */
export function useSignOutEverywhere() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: () => postJson<Success>("/api/auth/sign-out-everywhere"),
    onSuccess: () => {
      for (const queryKey of privateQueryRoots) {
        queryClient.removeQueries({ queryKey })
      }
      queryClient.setQueryData(queryKeys.customer.me(), null)
      router.refresh()
    },
  })
}

/** Adds a password to an account that signs in with Google only. */
export function useSetPassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (password: string) =>
      getBrowserSdk().client.fetch<{ success: true }>(
        "/store/customers/me/password",
        { method: "POST", body: { password } },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.customer.all, "sign-in-methods"],
      }),
  })
}
