import { crossOriginRefused, isSameOrigin } from "@/lib/http/same-origin"
import { requestSdk } from "@/lib/medusa/server"
import { readJsonBody } from "@/lib/http/request-body"

/**
 * Emails a password reset link. Always answers the same way, whether or not
 * the address has an account, so the form can't be used to find out who
 * shops here.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return crossOriginRefused()
  }

  const body = await readJsonBody<{
    email?: unknown
  }>(request)
  if (body instanceof Response) return body
  const sdk = requestSdk(request)

  if (typeof body?.email !== "string" || !body.email.trim()) {
    return Response.json({ message: "Email is required." }, { status: 400 })
  }

  try {
    await sdk.auth.resetPassword("customer", "emailpass", {
      identifier: body.email.trim(),
    })
  } catch (error) {
    console.error("Could not request a password reset", error)
  }

  return Response.json({ success: true })
}
