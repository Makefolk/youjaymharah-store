import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"

import { sdk } from "@/lib/medusa/server"
import { setSignInNext } from "@/lib/medusa/session"
import { safeNextPath, SIGN_IN_PATH } from "@/lib/seo/routes"

/**
 * "Continue with Google": link or navigate to this route. It asks Medusa for
 * Google's consent-screen URL and sends the browser there.
 *
 * Google returns the customer to the backend's GOOGLE_CALLBACK_URL, which must
 * point at /api/auth/google/callback on this storefront.
 */
export async function GET(request: NextRequest): Promise<never> {
  let location: string | undefined

  await setSignInNext(safeNextPath(request.nextUrl.searchParams.get("next")))

  try {
    const result = await sdk.auth.login("customer", "google", {})

    if (typeof result !== "string" && "location" in result) {
      location = result.location
    }
  } catch (error) {
    console.error("Google sign-in could not start", error)
  }

  // Outside the try: redirect() works by throwing, and a catch would swallow it.
  redirect(location ?? `${SIGN_IN_PATH}?error=google_unavailable`)
}
