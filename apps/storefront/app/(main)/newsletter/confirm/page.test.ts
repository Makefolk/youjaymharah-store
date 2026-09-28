import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { fetchCustomerOnServer } from "@/features/customer/server"
import { useConfirmNewsletter } from "@/features/newsletter/hooks"

import ConfirmNewsletterPage from "./page"

vi.mock("@/features/customer/server", () => ({
  fetchCustomerOnServer: vi.fn(),
}))
vi.mock("@/features/newsletter/hooks", () => ({
  useConfirmNewsletter: vi.fn(),
}))

const mutateAsync = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useConfirmNewsletter).mockReturnValue({
    mutateAsync,
    isPending: false,
    isSuccess: false,
    isError: false,
  } as unknown as ReturnType<typeof useConfirmNewsletter>)
})

async function renderPage(
  token: string | string[] | undefined = "confirmation-token",
) {
  const page = await ConfirmNewsletterPage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve({ token }),
  })
  return renderToStaticMarkup(createElement(() => page))
}

describe("newsletter confirmation page", () => {
  it.each([null, { first_name: null }, { first_name: "" }])(
    "asks guests and customers without a name for their first name",
    async (customer) => {
      vi.mocked(fetchCustomerOnServer).mockResolvedValue(
        customer as Awaited<ReturnType<typeof fetchCustomerOnServer>>,
      )
      const html = await renderPage()
      expect(html).toContain('name="first_name"')
      expect(html).toContain('value=""')
      expect(html).toContain('required=""')
      expect(mutateAsync).not.toHaveBeenCalled()
    },
  )

  it("prefills an editable first name for a signed-in customer", async () => {
    vi.mocked(fetchCustomerOnServer).mockResolvedValue({
      first_name: "Ada",
    } as Awaited<ReturnType<typeof fetchCustomerOnServer>>)
    const html = await renderPage()
    expect(html).toContain('value="Ada"')
    expect(html).not.toContain("readOnly")
    expect(html).not.toContain('disabled=""')
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it("shows an incomplete-link message instead of a form for ambiguous tokens", async () => {
    const html = await renderPage(["one", "two"])
    expect(html).toContain("This link isn")
    expect(html).not.toContain('name="first_name"')
    expect(fetchCustomerOnServer).not.toHaveBeenCalled()
  })
})
