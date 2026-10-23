"use client"

import { Dialog } from "@base-ui/react/dialog"
import { MagnifyingGlassIcon, XCircleIcon, XIcon } from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import Form from "next/form"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { debounce, useQueryState } from "nuqs"
import { useEffect, useRef } from "react"

import { Button } from "@/components/ui/button"
import { MIN_SUGGESTION_LENGTH, searchQueries } from "@/features/search/queries"
import { searchParams, searchUrl } from "@/features/search/search-params"
import { useDebouncedValue } from "@/features/search/use-debounced-value"
import {
  categoryPath,
  collectionPath,
  productPath,
  SEARCH_PATH,
} from "@/lib/seo/routes"
import { cn } from "@/lib/util/cn"
import { hasCollectionPage } from "@/lib/medusa/collection"

interface SearchOverlayProps {
  open: boolean
  onOpenChange: (current: boolean) => void
}

const sectionLabelClass =
  "text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase"

export function SearchOverlay({ open, onOpenChange }: SearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pathname = usePathname()
  const openedAt = useRef(pathname)
  const restored = useRef(false)
  const dismissed = useRef(false)

  // The query lives in the URL, so a refresh or a shared link reopens the
  // panel where the shopper left it. The input updates on every keystroke;
  // the URL only after a pause, and without adding history entries.
  const [term, setTerm] = useQueryState(
    "q",
    searchParams.q.withOptions({
      history: "replace",
      limitUrlUpdates: debounce(300),
    }),
  )

  const query = useDebouncedValue(term.trim())
  const ready = query.length >= MIN_SUGGESTION_LENGTH

  const suggestions = useQuery({
    ...searchQueries.suggestions(query),
    enabled: open && ready,
  })

  const trending = useQuery({
    ...searchQueries.trending(),
    enabled: open && !term,
  })

  useEffect(() => {
    if (restored.current) {
      return
    }

    // Arriving with a query reopens the panel on it, results and all. Not on
    // the results page, where `q` is the page's own search and the panel would
    // only cover it.
    restored.current = true
    if (term && pathname !== SEARCH_PATH) onOpenChange(true)
  }, [term, pathname, onOpenChange])

  useEffect(() => {
    if (openedAt.current === pathname) {
      return
    }

    // A result was followed, so the panel has served its purpose.
    openedAt.current = pathname
    onOpenChange(false)
  }, [pathname, onOpenChange])

  const results = suggestions.data
  const collections = results?.collections.filter(hasCollectionPage) ?? []
  const hasResults = Boolean(
    results &&
    (results.products.length ||
      results.categories.length ||
      collections.length),
  )

  const clear = () => {
    void setTerm(null)
    // The button that had focus is about to be replaced by the close button.
    inputRef.current?.focus()
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        // Base UI calls this only for its own dismissals -- Escape, a press
        // outside, the close button. Leaving for a result or the results page
        // closes through the prop directly and keeps the query.
        if (!next) dismissed.current = true
        onOpenChange(next)
      }}
      onOpenChangeComplete={(isOpen) => {
        if (isOpen || !dismissed.current) return
        dismissed.current = false
        // After the panel has gone, so the rows don't blink out mid-animation;
        // and off the URL, so a refresh doesn't bring back a closed search.
        void setTerm(null)
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-30 bg-scrim/40 transition-opacity duration-500 ease-out",
            "supports-backdrop-filter:backdrop-blur-xs",
            "data-ending-style:opacity-0 data-starting-style:opacity-0",
          )}
        />

        <Dialog.Popup
          initialFocus={inputRef}
          aria-label="Search"
          className={cn(
            "fixed inset-x-0 top-12 z-90 flex h-[calc(100dvh-2.5rem)] flex-col overflow-y-clip bg-background md:top-14 lg:h-[50dvh]",
            "transition-[height] duration-500 ease-out motion-reduce:transition-none",
            "data-ending-style:h-0 data-starting-style:h-0",
          )}
        >
          <Dialog.Title className="sr-only">Search the store</Dialog.Title>

          {/*
            next/form rather than a bare <form>: still a GET that works before
            hydration and leaves a shareable URL, but submitted as a client-side
            navigation, with /search prefetched while the panel is open.
          */}
          <Form
            action={SEARCH_PATH}
            role="search"
            onSubmit={(event) => {
              if (!term.trim()) {
                event.preventDefault()
                return
              }

              // Resubmitting from the results page changes only the query
              // string, so the pathname effect above would never close it.
              onOpenChange(false)
            }}
            className="container-wrapper flex shrink-0 items-center gap-3 px-5 py-4 sm:px-6 lg:pl-14"
          >
            <label htmlFor="search-input">
              <MagnifyingGlassIcon
                aria-hidden
                className="size-5 shrink-0 text-muted-foreground"
              />
              <span className="sr-only">search box</span>
            </label>

            <input
              ref={inputRef}
              name="q"
              id="search-input"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              autoComplete="off"
              placeholder="Search for a piece, a colour, a fabric"
              aria-label="Search the store"
              className="h-10 flex-1 bg-transparent text-intro outline-none placeholder:text-muted-foreground max-md:text-lg"
            />

            {term ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Clear search"
                className={"mr-1"}
                onClick={clear}
              >
                <XCircleIcon weight="fill" />
              </Button>
            ) : (
              <Dialog.Close
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Clear search"
                    className={"mr-1"}
                  />
                }
              >
                <XIcon />
              </Dialog.Close>
            )}
            {/*</Dialog.Close>*/}
          </Form>

          <div
            aria-live="polite"
            className="container-wrapper min-h-0 flex-1 overflow-y-auto py-6"
          >
            {!term && trending.data?.terms.length ? (
              <section className="space-y-4 px-5 py-4 sm:px-6 lg:pl-14">
                <h2 className={sectionLabelClass}>
                  {trending.data.source === "curated"
                    ? "Suggestions"
                    : "Trending searches"}
                </h2>

                <ul className="flex flex-wrap gap-2">
                  {trending.data.terms.map((popular) => (
                    <li key={popular}>
                      <button
                        type="button"
                        onClick={() => {
                          setTerm(popular)
                          inputRef.current?.focus()
                        }}
                        className="border px-4 py-2 text-[13px] transition-colors hover:bg-muted"
                      >
                        {popular}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {ready && hasResults && results ? (
              <div className="space-y-8 px-5 py-4 sm:px-6 lg:pl-14">
                {results.products.length > 0 && (
                  <section className="space-y-4">
                    <h2 className={sectionLabelClass}>Products</h2>

                    <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                      {results.products.map((product) => (
                        <li key={product.id}>
                          <Link
                            href={productPath(product.handle)}
                            className="group flex items-center gap-4"
                            onClick={() => onOpenChange(false)}
                          >
                            <span className="relative block h-18 w-14 shrink-0 overflow-hidden bg-muted">
                              {product.thumbnail && (
                                <Image
                                  src={product.thumbnail}
                                  alt=""
                                  fill
                                  sizes="56px"
                                  className="object-cover"
                                />
                              )}
                            </span>

                            <span className="line-clamp-2 text-sm group-hover:underline group-hover:underline-offset-4">
                              {product.title}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {(results.categories.length > 0 || collections.length > 0) && (
                  <section className="space-y-4">
                    <h2 className={sectionLabelClass}>Browse</h2>

                    <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                      {results.categories.map((category) => (
                        <li key={category.id}>
                          <Link
                            href={categoryPath(category.handle)}
                            className="underline-offset-4 hover:underline"
                            onClick={() => onOpenChange(false)}
                          >
                            {category.name}
                          </Link>
                        </li>
                      ))}

                      {collections.map((collection) => (
                        <li key={collection.id}>
                          <Link
                            href={collectionPath(collection.handle)}
                            className="underline-offset-4 hover:underline"
                            onClick={() => onOpenChange(false)}
                          >
                            {collection.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {results.count > 0 && (
                  <Link
                    href={searchUrl(SEARCH_PATH, { q: query })}
                    className="inline-flex text-sm underline underline-offset-4"
                    onClick={() => onOpenChange(false)}
                  >
                    See all {results.count} results
                  </Link>
                )}
              </div>
            ) : null}

            {ready && !hasResults && !suggestions.isPending && (
              <p className="px-5 py-4 text-sm text-muted-foreground sm:px-6 lg:pl-14">
                Nothing matches &ldquo;{query}&rdquo;.
              </p>
            )}
          </div>

          <Dialog.Close
            className={"my-4 ml-auto"}
            render={<Button variant={"outline"} />}
          >
            CLOSE
          </Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
