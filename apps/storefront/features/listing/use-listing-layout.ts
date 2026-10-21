"use client"

import { useCallback, useSyncExternalStore } from "react"

import type { LayoutIndex } from "@/lib/medusa/listing"

const STORAGE_KEY = "listing-layout"
const listeners = new Set<() => void>()

/** Used when the browser refuses storage (private mode, blocked site data). */
let fallback: LayoutIndex | null = null

function read(): LayoutIndex | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === "0" || stored === "1" || stored === "2"
      ? (Number(stored) as LayoutIndex)
      : fallback
  } catch {
    return fallback
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

/**
 * The shopper's grid layout on listing pages, remembered in this browser.
 * Null until they pick one, so each screen size keeps its own default; the
 * server renders that default too.
 */
export function useListingLayout() {
  const layout = useSyncExternalStore(subscribe, read, () => null)

  const setLayout = useCallback((next: LayoutIndex) => {
    fallback = next
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      // Storage unavailable: the in-memory fallback still applies this visit.
    }
    for (const listener of listeners) listener()
  }, [])

  return [layout, setLayout] as const
}
