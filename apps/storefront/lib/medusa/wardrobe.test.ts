import { describe, expect, it } from "vitest"

import { getWardrobeModel } from "./wardrobe"

type Node = {
  id: string
  name: string
  handle: string
  rank: number
  metadata?: Record<string, unknown> | null
  category_children?: Node[]
}

const cat = (
  handle: string,
  rank: number,
  children?: Node[],
  metadata?: Record<string, unknown>,
): Node => ({
  id: `pcat_${handle}`,
  name: handle,
  handle,
  rank,
  metadata: metadata ?? null,
  ...(children ? { category_children: children } : {}),
})

const women = () =>
  cat("women", 0, [
    cat("trads", 3),
    cat("ready-to-wear", 0, [cat("dresses", 0), cat("tops", 1)]),
    cat("bubu", 1, [], { thumbnail: "https://cdn.example.com/bubu.jpg" }),
    cat("corporate", 2, [], { thumbnail: "not-a-url" }),
  ])

describe("getWardrobeModel", () => {
  it("lists a department's subcategories in the admin's order", () => {
    const { departments, showDepartments } = getWardrobeModel([women()])

    expect(showDepartments).toBe(false)
    expect(departments[0].wardrobes.map((w) => w.name)).toEqual([
      "ready-to-wear",
      "bubu",
      "corporate",
      "trads",
    ])
  })

  it("covers every category under a wardrobe", () => {
    const [readyToWear] = getWardrobeModel([women()]).departments[0].wardrobes

    expect(readyToWear.categoryIds).toEqual([
      "pcat_ready-to-wear",
      "pcat_dresses",
      "pcat_tops",
    ])
    expect(readyToWear.href).toBe("/categories/ready-to-wear")
  })

  it("uses staff's picture only when it is a full image address", () => {
    const wardrobes = getWardrobeModel([women()]).departments[0].wardrobes

    expect(wardrobes.find((w) => w.name === "bubu")?.image).toBe(
      "https://cdn.example.com/bubu.jpg",
    )
    expect(wardrobes.find((w) => w.name === "corporate")?.image).toBeNull()
  })

  it("names departments once there is more than one", () => {
    const model = getWardrobeModel([
      women(),
      cat("men", 1, [cat("men-ready-to-wear", 0)]),
      cat("gift-cards", 2),
    ])

    expect(model.showDepartments).toBe(true)
    expect(model.departments.map((d) => d.label)).toEqual(["women", "men"])
  })
})
