import { crossOriginRefused, isSameOrigin } from "@/lib/http/same-origin"
import { sdk } from "@/lib/medusa/server"

/**
 * Emails a password reset link. Always answers the same way, whether or not
 * the address has an account, so the form can't be used to find out who
 * shops here.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return crossOriginRefused()
  }

  const body = (await request.json().catch(() => null)) as {
    email?: unknown
  } | null

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
