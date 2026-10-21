import "server-only"

import { sdk } from "@/lib/medusa/server"

import { fetchListingPage, type ListingArgs } from "./fetch"

/** The first page for the server render; reads no cookies. */
export function fetchListingPageOnServer(args: ListingArgs, offset: number) {
  return fetchListingPage(sdk, args, offset)
}
