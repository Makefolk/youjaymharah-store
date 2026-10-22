import { crossOriginRefused, isSameOrigin } from "@/lib/http/same-origin"
import {
  authFailure,
  completeSignIn,
  extraStepRequired,
} from "@/lib/medusa/auth"
import { requestSdk } from "@/lib/medusa/server"
import { readJsonBody } from "@/lib/http/request-body"

const optionalString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined

/** Creates an email-and-password customer and signs them in. */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return crossOriginRefused()
  }

  const body = await readJsonBody<Record<string, unknown>>(request)
  if (body instanceof Response) return body
  const sdk = requestSdk(request)

  if (typeof body?.email !== "string" || typeof body.password !== "string") {
    return Response.json(
      { message: "Email and password are required." },
      { status: 400 },
    )
  }

  const credentials = { email: body.email, password: body.password }

  try {
    const registrationToken = await sdk.auth.register(
      "customer",
      "emailpass",
      credentials,
    )

    if (typeof registrationToken !== "string") {
      return extraStepRequired()
    }

    await sdk.store.customer.create(
      {
        email: credentials.email,
        first_name: optionalString(body.first_name),
        last_name: optionalString(body.last_name),
      },
      {},
      { authorization: `Bearer ${registrationToken}` },
    )

    // The registration token was issued before the customer existed, so it
    // carries no customer. Signing in again returns one that does.
    const token = await sdk.auth.login("customer", "emailpass", credentials)

    if (typeof token !== "string") {
      return extraStepRequired()
    }

    await completeSignIn(token)

    return Response.json({ success: true })
  } catch (error) {
    return authFailure(error, "Could not create the account. Please try again.")
  }
}
