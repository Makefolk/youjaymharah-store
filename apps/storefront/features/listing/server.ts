import "server-only"

import { visitorSdk } from "@/lib/medusa/server"

import { fetchListingPage, type ListingArgs } from "./fetch"

/**
 * The first page for the server render; reads no cookies. Forwards the
 * shopper's address, since /store/catalog is rate limited per IP.
 */
export async function fetchListingPageOnServer(
  args: ListingArgs,
  offset: number,
) {
  return fetchListingPage(await visitorSdk(), args, offset)
}
