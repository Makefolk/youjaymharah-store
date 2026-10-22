import { crossOriginRefused, isSameOrigin } from "@/lib/http/same-origin"
import {
  authFailure,
  completeSignIn,
  extraStepRequired,
} from "@/lib/medusa/auth"
import { requestSdk } from "@/lib/medusa/server"
import { readJsonBody } from "@/lib/http/request-body"

/** Email and password sign-in. The token goes into an httpOnly cookie only. */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return crossOriginRefused()
  }

  const body = await readJsonBody<{
    email?: unknown
    password?: unknown
  }>(request)
  if (body instanceof Response) return body
  const sdk = requestSdk(request)

  if (typeof body?.email !== "string" || typeof body.password !== "string") {
    return Response.json(
      { message: "Email and password are required." },
      { status: 400 },
    )
  }

  try {
    const result = await sdk.auth.login("customer", "emailpass", {
      email: body.email,
      password: body.password,
    })

    if (typeof result !== "string") {
      return extraStepRequired()
    }

    await completeSignIn(result)

    return Response.json({ success: true })
  } catch (error) {
    return authFailure(error, "Could not sign in. Please try again.")
  }
}
