import { getImageProps } from "next/image"
import Link from "next/link"
import { listCollections } from "@/lib/medusa/catalog"
import { isCollectionLinkAvailable } from "@/lib/medusa/collection"
import { getBaseURL } from "@/lib/util/env"

import {
  getHeroContent,
  getHeroStill,
  type HeroSettings,
} from "@/lib/medusa/hero"
import { HeaderOverlay } from "@/features/layout/header-overlay"
import { getStorefrontSettings } from "@/lib/medusa/storefront-settings"
import { cn } from "@/lib/util/cn"

import { HeroVideo } from "./hero-video"

/** The widths the stills are served at; the crops come from the admin. */
const DESKTOP_SIZE = { width: 2400, height: 1200 }
const MOBILE_SIZE = { width: 1080, height: 1350 }

const DESKTOP_QUERY = "(min-width: 48rem)"

/**
 * The one knob on the sticky copy. A sticky element only travels inside its
 * own section, so at exactly one screen the copy sits at the foot of the hero
 * and leaves with it; the surplus is how long it stays pinned to the bottom of
 * the viewport while the hero scrolls past.
 */
const HERO_HEIGHT = "h-[125svh] min-h-128"

const headlineClass = "font-display text-display-xl text-balance"

const ctaClass =
  "inline-flex items-center justify-center px-10 py-4 text-[13px] font-medium tracking-[0.06em] uppercase transition-colors"

/**
 * The home page hero, filled in under Settings -> Storefront -> Homepage.
 * Renders nothing when staff switch it off or leave it empty, so the page
 * simply starts at the section below.
 */
export async function Hero() {
  const { homepage } = await getStorefrontSettings()
  const content = getHeroContent(homepage.hero)

  if (!content) {
    return null
  }

  if (
    content.cta &&
    !isCollectionLinkAvailable(
      content.cta.href,
      await listCollections(),
      getBaseURL(),
    )
  )
    content.cta = null

  if (!content.hasMedia) {
    return (
      <section className="bg-muted px-5 py-32 text-center sm:px-6">
        <Copy content={content} />
      </section>
    )
  }

  return (
    <section
      className={cn(
        "relative flex flex-col text-center text-white",
        HERO_HEIGHT,
      )}
    >
      <div className="absolute inset-0 overflow-hidden">
        <HeroStill hero={homepage.hero} />
        <HeroVideo hero={homepage.hero} />

        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-t from-scrim/65 via-scrim/20 to-scrim/25"
        />
      </div>

      <HeaderOverlay tone="light" />

      <div aria-hidden className="flex-1" />

      <Copy content={content} inverted />
    </section>
  )
}

/**
 * The still, art-directed: the browser picks the crop for its own width and
 * fetches only that one. `getImageProps` is what lets a `<picture>` keep
 * Next's optimisation.
 *
 * Eager with a high fetch priority rather than `preload`, which Next warns
 * against where the LCP element depends on the viewport: a preload link would
 * name one crop and phones would fetch both.
 */
function HeroStill({ hero }: { hero: HeroSettings }) {
  const desktop = getHeroStill(hero, "desktop")
  const mobile = getHeroStill(hero, "mobile")

  const common = { alt: "", sizes: "100vw", loading: "eager" as const }

  const desktopImage = desktop
    ? getImageProps({ ...common, src: desktop, ...DESKTOP_SIZE })
    : null

  const mobileImage = mobile
    ? getImageProps({ ...common, src: mobile, ...MOBILE_SIZE })
    : null

  const fallback = mobileImage ?? desktopImage

  if (!fallback) {
    return null
  }

  const { srcSet, ...rest } = fallback.props

  return (
    <picture>
      {desktopImage && mobileImage && (
        <source media={DESKTOP_QUERY} srcSet={desktopImage.props.srcSet} />
      )}
      <source srcSet={srcSet} />
      <img
        {...rest}
        alt=""
        fetchPriority="high"
        className="absolute inset-0 size-full object-cover"
      />
    </picture>
  )
}

function Copy({
  content,
  inverted = false,
}: {
  content: NonNullable<ReturnType<typeof getHeroContent>>
  inverted?: boolean
}) {
  return (
    <div className="container-wrapper sticky bottom-0 flex flex-col items-center justify-between gap-6 pb-12 text-center lg:flex-row lg:items-end lg:px-12 lg:pb-16 lg:text-start">
      <div className="max-w-4xl space-y-6">
        {content.eyebrow && (
          <p
            className={cn(
              "text-[13px] font-medium tracking-[0.18em] uppercase",
              inverted ? "text-white/75" : "text-muted-foreground",
            )}
          >
            {content.eyebrow}
          </p>
        )}
        {content.title && (
          <h1
            className={cn(
              headlineClass,
              inverted ? "text-white" : "text-foreground",
            )}
          >
            {content.title}
          </h1>
        )}

        {content.description && (
          <p
            className={cn(
              "mx-auto max-w-[46ch] text-intro text-pretty lg:mx-0",
              inverted ? "text-white/85" : "text-muted-foreground",
            )}
          >
            {content.description}
          </p>
        )}
      </div>

      {content.cta && (
        <Link
          href={content.cta.href}
          className={cn(
            ctaClass,
            inverted
              ? "border border-white/70 bg-white text-center text-ink backdrop-blur hover:bg-transparent hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              : "bg-primary-foreground text-primary hover:bg-primary-foreground/85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
          )}
        >
          {content.cta.label}
        </Link>
      )}
    </div>
  )
}
