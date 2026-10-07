"use client"

import Image from "next/image"
import Link from "next/link"
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react"
import {
  useCallback,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react"

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel"
import type { ProductImage } from "@/lib/medusa/variants"
import { cn } from "@/lib/util/cn"

const arrowClass =
  "absolute top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center bg-background/80 text-foreground transition-opacity hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover/card:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within/card:opacity-100"

export function ProductCardGallery({
  images,
  title,
  href,
  priority,
  sizes,
  api,
  setApi,
  showArrows,
  showDots,
  children,
}: {
  images: ProductImage[]
  title: string
  href: string
  priority: boolean
  sizes: string
  api: CarouselApi
  setApi: (api: CarouselApi) => void
  showArrows: boolean
  showDots: boolean
  children?: ReactNode
}) {
  const root = useRef<HTMLDivElement>(null)
  const gesture = useRef({ x: 0, y: 0, dragged: false })
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!api) return () => {}
      api.on("select", notify).on("reInit", notify)
      return () => {
        api.off("select", notify).off("reInit", notify)
      }
    },
    [api],
  )
  const current = useSyncExternalStore(
    subscribe,
    () => api?.selectedScrollSnap() ?? 0,
    () => 0,
  )

  function goTo(index: number) {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
    api?.scrollTo(index, reducedMotion)
  }

  return (
    <Carousel
      ref={root}
      setApi={setApi}
      opts={{ loop: false, align: "start" }}
      aria-label={`${title} images`}
      tabIndex={images.length > 1 ? 0 : undefined}
      className="relative bg-foreground/5 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
      onKeyDownCapture={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
        event.preventDefault()
        root.current?.focus({ preventScroll: true })
        goTo(
          Math.max(
            0,
            Math.min(
              images.length - 1,
              current + (event.key === "ArrowRight" ? 1 : -1),
            ),
          ),
        )
      }}
      onPointerDownCapture={(event) => {
        gesture.current = { x: event.clientX, y: event.clientY, dragged: false }
      }}
      onPointerMoveCapture={(event) => {
        if (
          Math.abs(event.clientX - gesture.current.x) > 6 ||
          Math.abs(event.clientY - gesture.current.y) > 6
        ) {
          gesture.current.dragged = true
        }
      }}
      onClickCapture={(event) => {
        if (event.detail > 0 && gesture.current.dragged) {
          event.preventDefault()
          event.stopPropagation()
        }
      }}
    >
      {images.length ? (
        <CarouselContent className="ml-0 touch-pan-y">
          {images.map((image, index) => (
            <CarouselItem
              key={image.url}
              className="pl-0"
              aria-label={`${index + 1} of ${images.length}`}
              aria-hidden={index !== current}
            >
              <Link
                href={href}
                tabIndex={index === current ? 0 : -1}
                aria-label={`View ${title}`}
                draggable={false}
                className="relative block aspect-3/4 outline-none focus-visible:after:absolute focus-visible:after:inset-1 focus-visible:after:z-10 focus-visible:after:border focus-visible:after:border-white focus-visible:after:outline focus-visible:after:outline-black"
              >
                <Image
                  src={image.url}
                  alt={`${title} — image ${index + 1}`}
                  fill
                  sizes={sizes}
                  loading={priority && index === 0 ? "eager" : "lazy"}
                  fetchPriority={priority && index === 0 ? "high" : undefined}
                  draggable={false}
                  className="object-cover"
                />
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
      ) : (
        <Link
          href={href}
          aria-label={`View ${title}`}
          className="flex aspect-3/4 items-center justify-center px-4 text-center text-[10px] tracking-[0.16em] text-muted-foreground uppercase"
        >
          Image coming soon
        </Link>
      )}
      {images.length > 1 && showArrows && (
        <>
          {current > 0 && (
            <button
              type="button"
              aria-label={`Previous image of ${title}`}
              className={cn(arrowClass, "left-2")}
              onClick={(event) => {
                if (
                  current === 1 &&
                  event.currentTarget.matches(":focus-visible")
                )
                  root.current?.focus({ preventScroll: true })
                goTo(current - 1)
              }}
            >
              <CaretLeftIcon aria-hidden className="size-5" />
            </button>
          )}
          {current < images.length - 1 && (
            <button
              type="button"
              aria-label={`Next image of ${title}`}
              className={cn(arrowClass, "right-2")}
              onClick={(event) => {
                if (
                  current === images.length - 2 &&
                  event.currentTarget.matches(":focus-visible")
                )
                  root.current?.focus({ preventScroll: true })
                goTo(current + 1)
              }}
            >
              <CaretRightIcon aria-hidden className="size-5" />
            </button>
          )}
        </>
      )}
      {children}
      {images.length > 1 && showDots && (
        <div
          className="absolute bottom-2 left-2 z-10 flex max-h-1/2 flex-col overflow-y-auto bg-white/75 text-black"
          role="group"
          aria-label={`Choose an image of ${title}`}
        >
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              aria-label={`Show image ${index + 1} of ${images.length}`}
              aria-current={index === current ? "true" : undefined}
              className="flex size-6 shrink-0 items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-black"
              onClick={() => goTo(index)}
            >
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full border border-current",
                  index === current && "bg-current",
                )}
              />
            </button>
          ))}
        </div>
      )}
      {images.length > 1 && (
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          Image {current + 1} of {images.length}
        </p>
      )}
    </Carousel>
  )
}
