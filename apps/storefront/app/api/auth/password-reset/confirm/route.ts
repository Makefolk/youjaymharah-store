import { crossOriginRefused, isSameOrigin } from "@/lib/http/same-origin"
import { authFailure } from "@/lib/medusa/auth"
import { requestSdk } from "@/lib/medusa/server"
import { readJsonBody } from "@/lib/http/request-body"

/**
 * Sets a new password with the token from the reset email. The customer
 * signs in afterwards, so the token never becomes a session.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return crossOriginRefused()
  }

  const body = await readJsonBody<{
    token?: unknown
    email?: unknown
    password?: unknown
  }>(request)
  if (body instanceof Response) return body
  const sdk = requestSdk(request)

  if (
    typeof body?.token !== "string" ||
    typeof body.email !== "string" ||
    typeof body.password !== "string"
  ) {
    return Response.json(
      { message: "The reset link and a new password are required." },
      { status: 400 },
    )
  }

  try {
    await sdk.auth.updateProvider(
      "customer",
      "emailpass",
      { email: body.email, password: body.password },
      body.token,
    )

    return Response.json({ success: true })
  } catch (error) {
    return authFailure(
      error,
      "Could not change the password. Request a new link and try again.",
    )
  }
}
