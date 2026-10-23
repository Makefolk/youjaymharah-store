import { revalidateTag } from "next/cache"

import { readJsonBody } from "@/lib/http/request-body"
import { hasRevalidateSecret, isRevalidatableTag } from "@/lib/http/revalidate"

/**
 * Called by the backend after an admin save (notify-storefront.ts), so the
 * change shows on the next visit instead of when the cache expires. Needs
 * STOREFRONT_REVALIDATE_SECRET, shared with the backend, in
 * `x-revalidate-secret`. Refreshes only the cache tags the storefront uses.
 */
export async function POST(request: Request): Promise<Response> {
  if (
    !hasRevalidateSecret(
      request.headers.get("x-revalidate-secret"),
      process.env.STOREFRONT_REVALIDATE_SECRET,
    )
  ) {
    return Response.json({ message: "Unauthorized." }, { status: 401 })
  }

  const body = await readJsonBody<{ tags?: unknown }>(request)
  if (body instanceof Response) return body

  const tags = Array.isArray(body?.tags) ? body.tags : []
  if (!tags.length || tags.length > 50 || !tags.every(isRevalidatableTag)) {
    return Response.json({ message: "Unknown cache tags." }, { status: 400 })
  }

  // Stale while revalidating: the next visit gets the old page once while
  // the fresh one loads, rather than waiting for it.
  for (const tag of new Set(tags)) revalidateTag(tag, "max")

  return Response.json({ revalidated: tags })
}
