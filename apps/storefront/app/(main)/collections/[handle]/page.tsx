import type { Metadata } from "next"
import Image from "next/image"
import { notFound } from "next/navigation"

import { ListingPage } from "@/components/listing/listing-page"
import { getCollectionByHandle } from "@/lib/medusa/catalog"
import { getCollectionContent } from "@/lib/medusa/collection"

export async function generateMetadata({
  params,
}: PageProps<"/collections/[handle]">): Promise<Metadata> {
  const collection = await getCollectionByHandle((await params).handle)

  if (!collection) {
    return {}
  }

  const content = getCollectionContent(collection)

  return {
    title: content.title,
    description: content.description ?? undefined,
  }
}

export default async function CollectionPage({
  params,
  searchParams,
}: PageProps<"/collections/[handle]">) {
  const collection = await getCollectionByHandle((await params).handle)

  if (!collection) {
    notFound()
  }

  const content = getCollectionContent(collection)
  const mobileBanner = content.heroImageMobile ?? content.heroImage

  return (
    <ListingPage
      title={content.title}
      scope={{ collection: collection.handle }}
      defaultSort="recommended"
      searchParams={searchParams}
      hero={
        <>
          {content.heroImage && (
            <div className="relative hidden aspect-2/1 max-h-[70vh] w-full bg-muted md:block">
              <Image
                src={content.heroImage}
                alt=""
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
            </div>
          )}
          {mobileBanner && (
            <div className="relative aspect-4/5 w-full bg-muted md:hidden">
              <Image
                src={mobileBanner}
                alt=""
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
            </div>
          )}
          {content.description && (
            <p className="mx-auto mt-10 mb-10 max-w-[65ch] px-5 text-center text-intro text-muted-foreground sm:px-6 md:mt-14">
              {content.description}
            </p>
          )}
          {!content.description && <div className="h-10 md:h-14" />}
        </>
      }
    />
  )
}
