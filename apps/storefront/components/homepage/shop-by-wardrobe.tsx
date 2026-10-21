import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr"
import Image from "next/image"
import Link from "next/link"

import { getCategoryTree, listProducts } from "@/lib/medusa/catalog"
import { getWardrobeModel, type Wardrobe } from "@/lib/medusa/wardrobe"

/**
 * A wardrobe is listed once it has something to buy, so a category staff are
 * still filling stays off the home page. Without staff's own picture it shows
 * its newest product's.
 */
async function toCard(wardrobe: Wardrobe): Promise<Wardrobe | null> {
  const { products, count } = await listProducts({
    categoryId: wardrobe.categoryIds,
    limit: 1,
    order: "-created_at",
    fields: "id,thumbnail,*images",
  })

  if (!count) return null

  return {
    ...wardrobe,
    image:
      wardrobe.image ||
      products[0]?.thumbnail ||
      products[0]?.images?.[0]?.url ||
      null,
  }
}

export async function ShopByWardrobe() {
  const model = getWardrobeModel(await getCategoryTree())
  const departments = (
    await Promise.all(
      model.departments.map(async (department) => ({
        ...department,
        wardrobes: (await Promise.all(department.wardrobes.map(toCard))).filter(
          (card): card is Wardrobe => card !== null,
        ),
      })),
    )
  ).filter((department) => department.wardrobes.length)

  if (!departments.length) return null

  return (
    <section
      aria-labelledby="home-wardrobes-title"
      className="py-14 sm:py-18 lg:py-24"
    >
      <div className="container-wrapper px-5 sm:px-6 lg:px-12">
        <div className="border-t border-border/70 pt-8 sm:pt-10">
          <h2
            id="home-wardrobes-title"
            className="font-display text-display-lg"
          >
            Shop by wardrobe
          </h2>
        </div>

        <div className="mt-8 flex flex-col gap-12 sm:mt-10">
          {departments.map((department) => (
            <div key={department.id}>
              {model.showDepartments && (
                <Link
                  href={department.href}
                  className="mb-5 inline-block text-[13px] font-medium tracking-[0.02em] underline-offset-8 hover:underline"
                >
                  {department.label}
                </Link>
              )}
              <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
                {department.wardrobes.map((wardrobe, index) => (
                  <li key={wardrobe.id} className="min-w-0">
                    <WardrobeTile wardrobe={wardrobe} index={index} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function WardrobeTile({
  wardrobe,
  index,
}: {
  wardrobe: Wardrobe
  index: number
}) {
  return (
    <Link
      href={wardrobe.href}
      className="group/wardrobe flex flex-col outline-offset-6 focus-visible:outline-1 focus-visible:outline-foreground"
    >
      <div className="relative aspect-4/5 overflow-hidden bg-muted">
        {wardrobe.image ? (
          <Image
            src={wardrobe.image}
            alt=""
            fill
            sizes="(min-width: 1600px) 360px, (min-width: 1024px) 23vw, 48vw"
            className="object-cover transition-transform duration-700 ease-out group-hover/wardrobe:scale-[1.02] motion-reduce:transform-none"
          />
        ) : (
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center font-display text-[clamp(4rem,10vw,8rem)] leading-none text-foreground/15"
          >
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-3 pt-3 sm:pt-4">
        <h3 className="min-w-0 text-[15px] leading-snug font-medium text-pretty">
          {wardrobe.name}
        </h3>
        <span
          aria-hidden
          className="hidden shrink-0 items-center gap-1 text-[12px] font-medium tracking-[0.06em] text-muted-foreground uppercase transition-colors group-hover/wardrobe:text-foreground sm:flex"
        >
          Shop
          <ArrowRightIcon
            weight="light"
            className="size-3.5 transition-transform duration-300 group-hover/wardrobe:translate-x-0.5 motion-reduce:transform-none"
          />
        </span>
      </div>
    </Link>
  )
}
