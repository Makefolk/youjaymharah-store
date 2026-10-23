import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"

import { listCollections } from "@/lib/medusa/catalog"
import {
  getCollectionContent,
  hasCollectionPage,
} from "@/lib/medusa/collection"
import { collectionPath, PRODUCTS_PATH } from "@/lib/seo/routes"

export const metadata: Metadata = {
  title: "Collections",
}

export default async function CollectionsPage() {
  const collections = (await listCollections())
    .filter(hasCollectionPage)
    .map(getCollectionContent)

  if (!collections.length) redirect(PRODUCTS_PATH)

  return (
    <main className="container-wrapper px-5 py-10 sm:px-6">
      <h1 className="text-2xl font-medium tracking-[-0.01em]">Collections</h1>

      <ul className="mt-8 grid gap-10 md:grid-cols-2">
        {collections.map((collection) => (
          <li key={collection.id}>
            <Link href={collectionPath(collection.handle)} className="block">
              <span className="relative block aspect-2/1 overflow-hidden bg-muted">
                {collection.heroImage && (
                  <Image
                    src={collection.heroImage}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover"
                  />
                )}
              </span>
              <span className="mt-3 block text-[15px] font-medium">
                {collection.title}
              </span>
              {collection.description && (
                <span className="mt-1 block text-[13px] text-muted-foreground">
                  {collection.description}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
