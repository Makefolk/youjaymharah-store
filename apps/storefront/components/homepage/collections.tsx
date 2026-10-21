import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr"
import { getImageProps } from "next/image"
import Link from "next/link"

import { listCollections, listProducts } from "@/lib/medusa/catalog"
import {
  getCollectionContent,
  type CollectionContent,
} from "@/lib/medusa/collection"
import { getStorefrontSettings } from "@/lib/medusa/storefront-settings"
import { COLLECTIONS_PATH, collectionPath } from "@/lib/seo/routes"
import { cn } from "@/lib/util/cn"

export async function Collections() {
  const [records, { homepage }] = await Promise.all([
    listCollections(),
    getStorefrontSettings(),
  ])
  const ordered = records
    .filter((collection) => collection.handle)
    .map(getCollectionContent)
  const featured = ordered.findIndex(
    (collection) => collection.id === homepage.featured_collection_id,
  )
  if (featured > 0) ordered.unshift(...ordered.splice(featured, 1))

  const collections = await Promise.all(
    ordered.slice(0, 3).map(async (collection) => {
      if (collection.heroImage || collection.heroImageMobile) return collection
      const { products } = await listProducts({
        collectionId: collection.id,
        limit: 1,
        fields: "id,thumbnail,*images",
      })
      return {
        ...collection,
        heroImage:
          products[0]?.thumbnail || products[0]?.images?.[0]?.url || null,
      }
    }),
  )

  if (!collections.length) return null

  return (
    <section
      aria-labelledby="home-collections-title"
      className="py-14 sm:py-18 lg:py-24"
    >
      <div className="container-wrapper px-5 sm:px-6 lg:px-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5 sm:mb-10">
          <h2
            id="home-collections-title"
            className="font-display text-4xl leading-none tracking-[-0.02em] sm:text-5xl lg:text-6xl"
          >
            The collections
          </h2>
          <Link
            href={COLLECTIONS_PATH}
            className="pb-1 text-[11px] leading-relaxed tracking-[0.1em] uppercase underline-offset-8 hover:underline focus-visible:outline-1 focus-visible:outline-offset-4"
          >
            View all collections
          </Link>
        </div>

        <ul className="grid gap-x-6 gap-y-10 md:grid-cols-12 md:gap-y-8 lg:gap-x-10">
          {collections.map((collection, index) => (
            <li
              key={collection.id}
              className={cn(
                "min-w-0",
                collections.length === 1
                  ? "md:col-span-12"
                  : index === 0
                    ? "md:col-span-7"
                    : "md:col-span-5",
                collections.length === 3 && index === 0 && "md:row-span-2",
              )}
            >
              <CollectionCard
                collection={collection}
                index={index}
                count={collections.length}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function CollectionCard({
  collection,
  index,
  count,
}: {
  collection: CollectionContent
  index: number
  count: number
}) {
  const lead = index === 0
  const desktop = collection.heroImage ?? collection.heroImageMobile
  const mobile = collection.heroImageMobile ?? desktop
  const sizes =
    count === 1
      ? "(min-width: 1600px) 1504px, 100vw"
      : lead
        ? "(min-width: 1600px) 860px, (min-width: 768px) 58vw, 100vw"
        : "(min-width: 1600px) 620px, (min-width: 768px) 42vw, 100vw"
  const common = { alt: "", sizes, loading: "lazy" as const }
  const desktopImage = desktop
    ? getImageProps({ ...common, src: desktop, width: 1600, height: 1600 })
        .props
    : null
  const mobileImage =
    mobile && mobile !== desktop
      ? getImageProps({ ...common, src: mobile, width: 1080, height: 1350 })
          .props
      : null

  return (
    <Link
      href={collectionPath(collection.handle)}
      className="group/collection flex h-full flex-col outline-offset-6 focus-visible:outline-1 focus-visible:outline-foreground"
    >
      <div
        className={cn(
          "relative overflow-hidden bg-muted",
          lead ? "aspect-4/5" : "aspect-8/5",
          count === 3 && lead && "md:aspect-auto md:min-h-96 md:flex-1",
          count === 1 && "md:aspect-2/1 md:max-h-176",
          count === 2 && "md:aspect-4/5 md:flex-1",
        )}
      >
        {desktopImage ? (
          <picture>
            {mobileImage && (
              <source
                media="(max-width: 47.999rem)"
                srcSet={mobileImage.srcSet}
                sizes={sizes}
              />
            )}
            <img
              {...desktopImage}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          </picture>
        ) : (
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center font-display text-[clamp(6rem,18vw,14rem)] leading-none text-foreground/15"
          >
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
      </div>

      <div className="flex items-start justify-between gap-5 pt-4 sm:pt-5">
        <div className="min-w-0">
          <h3
            className={cn(
              "font-display text-2xl leading-tight text-pretty",
              lead && "sm:text-3xl",
            )}
          >
            {collection.title}
          </h3>
          {collection.description && (
            <p className="mt-2 line-clamp-2 max-w-[48ch] text-xs leading-relaxed text-pretty text-muted-foreground sm:text-[13px]">
              {collection.description}
            </p>
          )}
        </div>
        <ArrowUpRightIcon
          aria-hidden
          weight="light"
          className="mt-1 size-5 shrink-0 transition-transform duration-300 group-hover/collection:translate-x-0.5 group-hover/collection:-translate-y-0.5 motion-reduce:transform-none"
        />
      </div>
    </Link>
  )
}
