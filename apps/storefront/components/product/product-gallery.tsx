"use client"

import Image from "next/image"
import { useEffect, useState } from "react"

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel"
import type { ProductImage } from "@/lib/medusa/variants"

import { ProductLightbox } from "./product-lightbox"

/**
 * The product's photos for the chosen colour. Desktop shows them all in a
 * two-column grid, the first full width; phones swipe through them full
 * bleed. Any photo opens the full-screen viewer at that photo.
 */
export function ProductGallery({
  images,
  title,
}: {
  images: ProductImage[]
  title: string
}) {
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState(0)
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!api) return
    const onSelect = () => setCurrent(api.selectedScrollSnap())
    api.on("select", onSelect)
    return () => {
      api.off("select", onSelect)
    }
  }, [api])

  const show = (index: number) => {
    setStart(index)
    setOpen(true)
  }

  if (!images.length) {
    return <div className="aspect-3/4 bg-muted" aria-hidden />
  }

  const alt = (index: number) =>
    images.length > 1
      ? `${title}, photo ${index + 1} of ${images.length}`
      : title

  return (
    <>
      {/* Phones and small tablets */}
      <div className="relative -mx-5 sm:-mx-6 md:hidden">
        <Carousel
          setApi={setApi}
          opts={{ loop: images.length > 1 }}
          aria-label={`${title} photos`}
        >
          <CarouselContent className="ml-0">
            {images.map((image, index) => (
              <CarouselItem key={image.id ?? image.url} className="pl-0">
                <button
                  type="button"
                  onClick={() => show(index)}
                  className="relative block aspect-3/4 w-full bg-muted"
                  aria-label={`View ${alt(index)} full screen`}
                >
                  <Image
                    src={image.url}
                    alt={alt(index)}
                    fill
                    priority={index === 0}
                    sizes="100vw"
                    className="object-cover"
                  />
                </button>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        {images.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center gap-1.5">
            {images.map((image, index) => (
              <button
                key={image.id ?? image.url}
                type="button"
                aria-label={`Show photo ${index + 1}`}
                aria-current={index === current || undefined}
                onClick={() => api?.scrollTo(index)}
                className={`pointer-events-auto h-0.5 w-5 transition-colors ${
                  index === current ? "bg-ink" : "bg-ink/25"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tablets and desktop */}
      <ul className="hidden grid-cols-2 gap-1 md:grid">
        {images.map((image, index) => (
          <li
            key={image.id ?? image.url}
            className={
              index === 0 || (index === images.length - 1 && index % 2 === 1)
                ? "col-span-2"
                : undefined
            }
          >
            <button
              type="button"
              onClick={() => show(index)}
              className="group relative block aspect-3/4 w-full cursor-zoom-in overflow-hidden bg-muted"
              aria-label={`View ${alt(index)} full screen`}
            >
              <Image
                src={image.url}
                alt={alt(index)}
                fill
                priority={index === 0}
                sizes={
                  index === 0
                    ? "(min-width: 1024px) 58vw, 100vw"
                    : "(min-width: 1024px) 29vw, 50vw"
                }
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.015] motion-reduce:transform-none"
              />
            </button>
          </li>
        ))}
      </ul>

      <ProductLightbox
        images={images}
        title={title}
        open={open}
        startIndex={start}
        onOpenChange={setOpen}
      />
    </>
  )
}
