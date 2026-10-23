"use client"

import { useEffect } from "react"

/**
 * Holds the page still while `active`, so it doesn't scroll under a menu.
 *
 * Base UI's modal lock only sets `overflow: hidden`, which iOS Safari ignores
 * for touch scrolling once its toolbar has collapsed. Pinning the body with
 * `position: fixed` at the current offset works everywhere; the offset is
 * restored on release, so the page reopens exactly where it was.
 */
export function usePageScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return

    const { body, documentElement: html } = document
    const scrollY = window.scrollY
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      scrollBehavior: html.style.scrollBehavior,
    }

    Object.assign(body.style, {
      position: "fixed",
      top: `-${scrollY}px`,
      left: "0",
      right: "0",
      width: "100%",
      overflow: "hidden",
    })

    return () => {
      Object.assign(body.style, {
        position: previous.position,
        top: previous.top,
        left: previous.left,
        right: previous.right,
        width: previous.width,
        overflow: previous.overflow,
      })
      // Jump straight back rather than smooth-scrolling from the top.
      html.style.scrollBehavior = "auto"
      window.scrollTo(0, scrollY)
      html.style.scrollBehavior = previous.scrollBehavior
    }
  }, [active])
}
