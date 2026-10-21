"use client"

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
} from "@phosphor-icons/react"
import Image from "next/image"
import { useEffect, useState, type MouseEvent } from "react"

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type { ProductImage } from "@/lib/medusa/variants"
import { cn } from "@/lib/util/cn"

const iconButton =
  "flex size-11 items-center justify-center bg-background/90 text-foreground transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-30"

/**
 * Full-screen photos: swipe, arrow keys or buttons to move, thumbnails to
 * jump, and on a pointer device a click to zoom in and follow the cursor.
 * Phones zoom with the usual pinch.
 */
export function ProductLightbox({
  images,
  title,
  open,
  startIndex,
  onOpenChange,
}: {
  images: ProductImage[]
  title: string
  open: boolean
  startIndex: number
  onOpenChange: (open: boolean) => void
}) {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(startIndex)
  const [zoomed, setZoomed] = useState(false)
  const [origin, setOrigin] = useState("50% 50%")

  useEffect(() => {
    if (!api) return
    const onSelect = () => {
      setCurrent(api.selectedScrollSnap())
      setZoomed(false)
    }
    api.on("select", onSelect)
    return () => {
      api.off("select", onSelect)
    }
  }, [api])

  // Dragging would fight panning while zoomed in.
  useEffect(() => {
    api?.reInit({ watchDrag: !zoomed })
  }, [api, zoomed])

  const follow = (event: MouseEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - box.left) / box.width) * 100
    const y = ((event.clientY - box.top) / box.height) * 100
    setOrigin(`${x}% ${y}%`)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setZoomed(false)
      }}
    >
      <DialogContent className="inset-0 top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 bg-background p-0 sm:max-w-none sm:p-0">
        <DialogTitle className="sr-only">{title} photos</DialogTitle>
        <p className="absolute top-4 left-4 z-10 text-[13px] text-muted-foreground tabular-nums">
          {current + 1} / {images.length}
        </p>

        <Carousel
          setApi={setApi}
          opts={{ startIndex, loop: images.length > 1 }}
          className="min-h-0 flex-1"
          aria-label={`${title} photos`}
        >
          <CarouselContent className="ml-0 h-[calc(100dvh-6rem)]">
            {images.map((image, index) => (
              <CarouselItem
                key={image.id ?? image.url}
                className="relative h-full pl-0"
              >
                <button
                  type="button"
                  aria-label={zoomed ? "Zoom out" : "Zoom in"}
                  onClick={(event) => {
                    follow(event)
                    setZoomed((value) => !value)
                  }}
                  onPointerMove={zoomed ? follow : undefined}
                  className={cn(
                    "relative block h-full w-full overflow-hidden",
                    zoomed ? "cursor-zoom-out" : "cursor-zoom-in",
                  )}
                >
                  <Image
                    src={image.url}
                    alt={`${title}, photo ${index + 1} of ${images.length}`}
                    fill
                    sizes="100vw"
                    quality={90}
                    priority={index === startIndex}
                    style={{ transformOrigin: origin }}
                    className={cn(
                      "object-contain transition-transform duration-300 ease-out motion-reduce:transition-none",
                      zoomed && index === current && "scale-[2.2]",
                    )}
                  />
                </button>
              </CarouselItem>
            ))}
          </CarouselContent>

          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={() => api?.scrollPrev()}
                className={cn(
                  iconButton,
                  "absolute top-1/2 left-4 -translate-y-1/2 max-sm:hidden",
                )}
              >
                <ArrowLeftIcon className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={() => api?.scrollNext()}
                className={cn(
                  iconButton,
                  "absolute top-1/2 right-4 -translate-y-1/2 max-sm:hidden",
                )}
              >
                <ArrowRightIcon className="size-5" />
              </button>
            </>
          )}
        </Carousel>

        <div className="flex h-24 shrink-0 items-center justify-center gap-2 overflow-x-auto px-4">
          {images.length > 1 &&
            images.map((image, index) => (
              <button
                key={image.id ?? image.url}
                type="button"
                aria-label={`Show photo ${index + 1}`}
                aria-current={index === current || undefined}
                onClick={() => api?.scrollTo(index)}
                className={cn(
                  "relative aspect-3/4 h-16 shrink-0 bg-muted transition-opacity",
                  index === current
                    ? "outline-1 outline-offset-2 outline-foreground"
                    : "opacity-60 hover:opacity-100",
                )}
              >
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </button>
            ))}
          <button
            type="button"
            onClick={() => setZoomed((value) => !value)}
            aria-label={zoomed ? "Zoom out" : "Zoom in"}
            className={cn(iconButton, "ml-2 max-sm:hidden")}
          >
            {zoomed ? (
              <MagnifyingGlassMinusIcon className="size-5" />
            ) : (
              <MagnifyingGlassPlusIcon className="size-5" />
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
