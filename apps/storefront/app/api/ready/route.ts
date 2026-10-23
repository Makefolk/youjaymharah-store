import { MEDUSA_BACKEND_URL } from "@/lib/medusa/server"
import { PUBLISHABLE_KEY } from "@/lib/medusa/constants"

export async function GET(): Promise<Response> {
  let ready = false
  try {
    if (PUBLISHABLE_KEY) {
      const headers = { "x-publishable-api-key": PUBLISHABLE_KEY }
      const signal = AbortSignal.timeout(5000)
      const [health, regions, catalog] = await Promise.all([
        fetch(new URL("/health", MEDUSA_BACKEND_URL), {
          signal,
          cache: "no-store",
        }),
        fetch(new URL("/store/regions?limit=100", MEDUSA_BACKEND_URL), {
          signal,
          headers,
          cache: "no-store",
        }),
        fetch(
          new URL("/store/products?limit=1&fields=id", MEDUSA_BACKEND_URL),
          {
            signal,
            headers,
            cache: "no-store",
          },
        ),
      ])
      if (health.ok && regions.ok && catalog.ok) {
        const [body, products] = (await Promise.all([
          regions.json(),
          catalog.json(),
        ])) as [
          {
            regions?: { countries?: { iso_2: string }[] }[]
          },
          { products?: unknown[] },
        ]
        ready = Boolean(
          Array.isArray(products.products) &&
          body.regions?.some((region) =>
            region.countries?.some((country) => country.iso_2 === "ng"),
          ),
        )
      }
    }
  } catch {
    ready = false
  }
  return Response.json(
    { status: ready ? "ok" : "unavailable" },
    {
      status: ready ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  )
}
