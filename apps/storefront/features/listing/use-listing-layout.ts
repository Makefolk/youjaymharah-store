"use client"

import { VIEWS, type ListingView } from "@/lib/medusa/listing"

const STORAGE_KEY = "listing-view"

/**
 * The last layout the shopper picked, remembered in this browser so a
 * listing opened without `?view=` can start in it. The URL is what the page
 * renders from; this only fills it in.
 */
export function readRememberedView(): ListingView | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return VIEWS.includes(stored as ListingView)
      ? (stored as ListingView)
      : null
  } catch {
    return null
  }
}

export function rememberView(view: ListingView) {
  try {
    window.localStorage.setItem(STORAGE_KEY, view)
  } catch {
    // Storage unavailable: the URL still carries the choice for this visit.
  }
}
