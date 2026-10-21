import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"

import { completeSignIn } from "@/lib/medusa/auth"
import { sdk } from "@/lib/medusa/server"
import { takeSignInNext } from "@/lib/medusa/session"
import { safeNextPath, SIGN_IN_PATH } from "@/lib/seo/routes"

/**
 * Where Google sends the customer back (the backend's GOOGLE_CALLBACK_URL).
 *
 * 1. Exchanges Google's code for a Medusa token.
 * 2. Calls the backend's /store/customers/social, which links the sign-in to an
 *    existing account with the same verified email, or creates a customer.
 * 3. Refreshes the token: the one from step 1 can predate the customer, and a
 *    refreshed token carries it.
 */
export async function GET(request: NextRequest): Promise<never> {
  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state")

  // Where the customer started, e.g. checkout; the account page otherwise.
  const next = safeNextPath(await takeSignInNext())
  const failed = (error: string) =>
    `${SIGN_IN_PATH}?error=${error}&next=${encodeURIComponent(next)}`
  let destination = next

  if (!code || !state) {
    destination = failed("google_cancelled")
  } else {
    try {
      const callbackToken = await sdk.auth.callback("customer", "google", {
        code,
        state,
      })

      if (typeof callbackToken !== "string") {
        throw new TypeError("Google sign-in asked for an extra step.")
      }

      const authorization = { authorization: `Bearer ${callbackToken}` }

      await sdk.client.fetch("/store/customers/social", {
        method: "POST",
        headers: authorization,
        body: {},
      })

      const { token } = await sdk.auth.refresh(authorization)

      await completeSignIn(token)
    } catch (error) {
      console.error("Google sign-in could not complete", error)
      destination = failed("google_failed")
    }
  }

  // Outside the try: redirect() works by throwing, and a catch would swallow it.
  redirect(destination)
}
