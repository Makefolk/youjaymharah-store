import { crossOriginRefused, isSameOrigin } from "@/lib/http/same-origin"
import { authFailure } from "@/lib/medusa/auth"
import { isUnauthorized } from "@/lib/medusa/errors"
import { requestSdk } from "@/lib/medusa/server"
import {
  clearAuthToken,
  clearCartId,
  clearWishlistId,
  getAuthToken,
} from "@/lib/medusa/session"

/**
 * "Sign out of all devices": Medusa refuses every token issued to the
 * account until now, then this browser signs out like /api/auth/logout.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return crossOriginRefused()
  }

  const token = await getAuthToken()

  if (token) {
    try {
      await requestSdk(request).client.fetch("/store/customers/me/sessions", {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      })
    } catch (error) {
      // Already ended elsewhere: nothing left to end, so just sign out here.
      if (!isUnauthorized(error)) {
        return authFailure(error, "Could not sign out your other devices.")
      }
    }
  }

  await clearAuthToken()
  await clearCartId()
  await clearWishlistId()

  return Response.json({ success: true })
}
