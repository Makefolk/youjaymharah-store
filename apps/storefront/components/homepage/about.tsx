import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr"
import Image from "next/image"
import Link from "next/link"

import { getStorefrontSettings } from "@/lib/medusa/storefront-settings"
import { listCollections } from "@/lib/medusa/catalog"
import { isCollectionLinkAvailable } from "@/lib/medusa/collection"
import { getBaseURL } from "@/lib/util/env"

export async function About() {
  const { brand, homepage } = await getStorefrontSettings()
  const about = homepage.about

  if (!about?.enabled || !about.title || !about.description) return null

  const showLink =
    about.cta_label &&
    about.cta_url &&
    isCollectionLinkAvailable(
      about.cta_url,
      await listCollections(),
      getBaseURL(),
    )

  return (
    <section
      aria-labelledby="homepage-about-title"
      className="border-t border-gold-hairline bg-background py-16 sm:py-20 lg:py-28"
    >
      <div className="container-wrapper grid items-center gap-10 px-5 sm:gap-14 sm:px-6 md:grid-cols-2 lg:gap-24 lg:px-12">
        <div className="relative aspect-4/5 overflow-hidden bg-foreground text-background md:order-first">
          {about.image_url ? (
            <Image
              src={about.image_url}
              alt={about.image_alt ?? ""}
              fill
              sizes="(min-width: 1600px) 704px, (min-width: 768px) 45vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="absolute inset-5 flex flex-col items-center justify-center border border-gold/35 px-6 sm:inset-8 sm:px-10"
            >
              <span className="mb-10 h-12 w-px bg-gold/60 sm:mb-14 sm:h-16" />
              {brand.logo_url ? (
                <Image
                  src={brand.logo_url}
                  alt=""
                  width={160}
                  height={160}
                  className="h-24 w-24 object-contain sm:h-32 sm:w-32"
                />
              ) : (
                <span className="font-display text-7xl leading-none text-gold sm:text-8xl">
                  YJ
                </span>
              )}
              <span className="mt-8 text-center font-display text-2xl leading-snug text-pretty sm:text-3xl">
                {brand.name}
              </span>
              <span className="mt-10 h-12 w-px bg-gold/60 sm:mt-14 sm:h-16" />
            </div>
          )}
        </div>

        <div className="min-w-0 py-2 md:py-8">
          {about.eyebrow && (
            <p className="mb-6 flex items-center gap-4 text-[11px] font-medium tracking-[0.16em] uppercase">
              <span aria-hidden className="h-px w-10 shrink-0 bg-gold" />
              {about.eyebrow}
            </p>
          )}
          <h2
            id="homepage-about-title"
            className="max-w-[18ch] font-display text-4xl leading-[1.12] tracking-[-0.025em] whitespace-pre-line sm:text-5xl lg:text-6xl"
          >
            {about.title}
          </h2>
          <div className="mt-6 max-w-[46ch] space-y-4 text-sm leading-7 text-pretty text-muted-foreground sm:mt-8 sm:text-base sm:leading-8">
            {about.description.split(/\n\s*\n/).map((paragraph, index) => (
              <p key={index} className="whitespace-pre-line">
                {paragraph}
              </p>
            ))}
          </div>
          {showLink && about.cta_url && (
            <Link
              href={about.cta_url}
              className="group mt-8 inline-flex min-h-11 items-center gap-6 border-b border-gold py-2 text-xs font-medium tracking-[0.08em] uppercase transition-colors hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-4 sm:mt-10"
            >
              {about.cta_label}
              <ArrowUpRightIcon
                aria-hidden
                className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none"
              />
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
