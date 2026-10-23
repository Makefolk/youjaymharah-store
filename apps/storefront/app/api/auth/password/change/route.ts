import { readJsonBody } from "@/lib/http/request-body"
import { crossOriginRefused, isSameOrigin } from "@/lib/http/same-origin"
import { authFailure } from "@/lib/medusa/auth"
import { requestSdk } from "@/lib/medusa/server"
import { getAuthToken, setAuthToken } from "@/lib/medusa/session"

/**
 * Changes the signed-in customer's password. Medusa ends every earlier
 * sign-in, this browser's included, and answers with a fresh token, which
 * goes into the httpOnly cookie here so browser code never sees it. The
 * Medusa proxy refuses this path for the same reason.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return crossOriginRefused()
  }

  const body = await readJsonBody<{
    current_password?: unknown
    new_password?: unknown
  }>(request)
  if (body instanceof Response) return body

  const token = await getAuthToken()
  if (!token) {
    return Response.json({ message: "Please sign in again." }, { status: 401 })
  }

  try {
    const result = await requestSdk(request).client.fetch<{ token: string }>(
      "/store/customers/me/password/change",
      {
        method: "POST",
        body: {
          current_password: body?.current_password,
          new_password: body?.new_password,
        },
        headers: { authorization: `Bearer ${token}` },
      },
    )
    await setAuthToken(result.token)

    return Response.json({ success: true })
  } catch (error) {
    return authFailure(
      error,
      "Could not change your password. Please try again.",
    )
  }
}
