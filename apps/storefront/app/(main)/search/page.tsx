import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr"
import type { Metadata } from "next"
import Form from "next/form"

import { ListingPage } from "@/components/listing/listing-page"
import { loadSearchParams } from "@/features/search/search-params"
import { getStorefrontSettings } from "@/lib/medusa/storefront-settings"
import { shareMetadata } from "@/lib/seo/metadata"
import { SEARCH_PATH } from "@/lib/seo/routes"

/** The longest term the catalogue accepts; longer ones are cut, not refused. */
const MAX_TERM = 128

async function readTerm(searchParams: PageProps<"/search">["searchParams"]) {
  const { q } = await loadSearchParams(searchParams)
  return q.trim().slice(0, MAX_TERM)
}

export async function generateMetadata({
  searchParams,
}: PageProps<"/search">): Promise<Metadata> {
  const term = await readTerm(searchParams)
  const title = term ? `Search results for “${term}”` : "Search"
  const query = term ? `?q=${encodeURIComponent(term)}` : ""
  return {
    title,
    // Result pages are endless near-duplicates; let engines follow the
    // products instead.
    robots: { index: false, follow: true },
    ...shareMetadata({
      settings: await getStorefrontSettings(),
      url: `${SEARCH_PATH}${query}`,
      title,
      image: `/og/search${query}`,
      alt: title,
    }),
  }
}

export default async function SearchPage({
  searchParams,
}: PageProps<"/search">) {
  const term = await readTerm(searchParams)

  if (!term) {
    return (
      <main className="px-5 pt-10 pb-32 sm:px-6 md:pt-16">
        <h1 className="text-center text-2xl font-medium tracking-[-0.01em]">
          Search
        </h1>
        <SearchForm />
      </main>
    )
  }

  return (
    <ListingPage
      // A new term is a new listing: start its state afresh.
      key={term}
      title={`Results for “${term}”`}
      scope={{ q: term }}
      defaultSort="recommended"
      searchParams={searchParams}
      hero={
        <div className="px-5 pt-6 pb-8 sm:px-6 md:pt-10">
          <SearchForm term={term} />
        </div>
      }
      emptyMessage={`Nothing matches “${term}”. Try a broader word, such as a colour, fabric or type of piece.`}
    />
  )
}

/** A plain GET form, so a new search works before (and without) JavaScript. */
function SearchForm({ term = "" }: { term?: string }) {
  return (
    <Form
      action={SEARCH_PATH}
      role="search"
      className="mx-auto mt-6 flex max-w-xl items-center gap-3 border-b border-foreground/30 focus-within:border-foreground"
    >
      <MagnifyingGlassIcon
        aria-hidden
        className="size-5 shrink-0 text-muted-foreground"
      />
      <input
        name="q"
        type="search"
        defaultValue={term}
        required
        maxLength={MAX_TERM}
        autoComplete="off"
        placeholder="Search for a piece, a colour, a fabric"
        aria-label="Search the store"
        className="h-12 min-w-0 flex-1 bg-transparent text-intro outline-none placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        className="shrink-0 py-2 text-[12px] font-medium tracking-[0.12em] uppercase"
      >
        Search
      </button>
    </Form>
  )
}
