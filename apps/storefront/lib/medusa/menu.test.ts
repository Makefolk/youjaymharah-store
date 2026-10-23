import { describe, expect, it } from "vitest"

import {
  findActiveMenuItem,
  getBreadcrumbs,
  getCollectionMenu,
  getMenuGroups,
  getMenuModel,
} from "./menu"

type Node = {
  id: string
  name: string
  handle: string
  rank: number
  category_children?: Node[]
}

let rank = 0
const cat = (handle: string, name: string, children?: Node[]): Node => ({
  id: `pcat_${handle}`,
  name,
  handle,
  rank: rank++,
  ...(children ? { category_children: children } : {}),
})

const garments = [
  "Dresses",
  "Knitwear",
  "Coats & Jackets",
  "Suits & Tailoring",
  "Shirts & Blouses",
  "T-Shirts & Tops",
  "Trousers",
  "Jeans",
  "Skirts",
]

const women = () =>
  cat("women", "Women", [
    ...garments.map((name) =>
      cat(`women-${name.toLowerCase().replace(/\W+/g, "-")}`, name),
    ),
    cat("women-accessories", "Accessories", [
      cat("women-bags", "Bags"),
      cat("women-shoes", "Shoes"),
      cat("women-jewellery", "Jewellery"),
    ]),
  ])

const men = () =>
  cat("men", "Men", [
    cat("men-shirts", "Shirts"),
    cat("men-accessories", "Accessories", [cat("men-belts", "Belts")]),
  ])

describe("getMenuModel with one department (today)", () => {
  const menu = getMenuModel([women()])
  const [department] = menu.departments

  it("hides the department level", () => {
    expect(menu.showDepartments).toBe(false)
    expect(department.label).toBe("Women")
    expect(department.href).toBe("/categories/women")
  })

  it("gathers categories without children under Clothing, split evenly", () => {
    const loose = department.columns.filter((c) => c.href === null)
    expect(loose.map((c) => c.heading)).toEqual(["Clothing", null])
    expect(loose.map((c) => c.links.length)).toEqual([5, 4])
    expect(loose.flatMap((c) => c.links.map((l) => l.label))).toEqual(garments)
  })

  it("makes categories with children their own columns, after Clothing", () => {
    const last = department.columns[department.columns.length - 1]
    expect(department.columns[0].heading).toBe("Clothing")
    expect(last).toMatchObject({
      heading: "Accessories",
      href: "/categories/women-accessories",
      moreHref: null,
    })
    expect(last.links.map((l) => l.href)).toEqual([
      "/categories/women-bags",
      "/categories/women-shoes",
      "/categories/women-jewellery",
    ])
  })

  it("never uses the department name as a heading", () => {
    expect(department.columns.some((c) => c.heading === "Women")).toBe(false)
  })

  it("takes the label as a setting", () => {
    const custom = getMenuModel([women()], { looseGroupLabel: "Ready-to-wear" })
    expect(custom.departments[0].columns[0].heading).toBe("Ready-to-wear")
  })
})

describe("getMenuModel with more departments (later)", () => {
  const menu = getMenuModel([men(), women()].map((d, i) => ({ ...d, rank: i })))

  it("shows departments in the admin's order", () => {
    expect(menu.showDepartments).toBe(true)
    expect(menu.departments.map((d) => d.label)).toEqual(["Men", "Women"])
  })

  it("builds each department's own columns", () => {
    expect(menu.departments[0].columns.map((c) => c.heading)).toEqual([
      "Clothing",
      "Accessories",
    ])
  })
})

describe("getMenuModel edge cases", () => {
  it("cuts long real columns with View all", () => {
    const many = Array.from({ length: 11 }, (_, i) =>
      cat(`bag-${i}`, `Bag ${i}`),
    )
    const menu = getMenuModel([
      cat("women", "Women", [cat("bags", "Bags", many)]),
    ])
    const [column] = menu.departments[0].columns
    expect(column.links).toHaveLength(8)
    expect(column.moreHref).toBe("/categories/bags")
  })

  it("keeps the admin's order, placing Clothing where its first member is", () => {
    const menu = getMenuModel([
      cat("women", "Women", [
        cat("acc", "Accessories", [cat("bags", "Bags")]),
        cat("dresses", "Dresses"),
      ]),
    ])
    expect(menu.departments[0].columns.map((c) => c.heading)).toEqual([
      "Accessories",
      "Clothing",
    ])
  })

  it("gives a department without subcategories no columns", () => {
    const menu = getMenuModel([cat("gifts", "Gifts")])
    expect(menu.departments[0].columns).toEqual([])
  })

  it("handles an empty store", () => {
    expect(getMenuModel([])).toEqual({
      departments: [],
      showDepartments: false,
    })
  })
})

describe("getMenuGroups", () => {
  it("folds continuation columns back into their group", () => {
    const [department] = getMenuModel([women()]).departments
    const groups = getMenuGroups(department)
    expect(groups.map((g) => g.heading)).toEqual(["Clothing", "Accessories"])
    expect(groups[0].links).toHaveLength(9)
  })
})

describe("getBreadcrumbs", () => {
  const bags = {
    name: "Bags",
    handle: "women-bags",
    rank: 0,
    parent_category: {
      name: "Accessories",
      handle: "women-accessories",
      rank: 0,
      parent_category: { name: "Women", handle: "women", rank: 0 },
    },
  }

  it("leaves out the only department", () => {
    expect(getBreadcrumbs(bags, { showDepartments: false })).toEqual([
      {
        name: "Accessories",
        handle: "women-accessories",
        href: "/categories/women-accessories",
      },
      { name: "Bags", handle: "women-bags", href: "/categories/women-bags" },
    ])
  })

  it("keeps it once there are more", () => {
    expect(
      getBreadcrumbs(bags, { showDepartments: true }).map((c) => c.name),
    ).toEqual(["Women", "Accessories", "Bags"])
  })

  it("keeps the department on its own page", () => {
    expect(
      getBreadcrumbs(
        { name: "Women", handle: "women", rank: 0 },
        { showDepartments: false },
      ).map((c) => c.name),
    ).toEqual(["Women"])
  })
})

describe("findActiveMenuItem", () => {
  const menu = getMenuModel([women()])
  const [department] = menu.departments
  const accessories = department.columns[department.columns.length - 1]

  it("finds the link and its column", () => {
    expect(findActiveMenuItem(menu, "/categories/women-bags")).toEqual({
      departmentId: department.id,
      columnId: accessories.id,
      href: "/categories/women-bags",
    })
  })

  it("matches pages under a link", () => {
    expect(findActiveMenuItem(menu, "/categories/women-bags/page/2").href).toBe(
      "/categories/women-bags",
    )
  })

  it("doesn't confuse handles that share a prefix", () => {
    expect(findActiveMenuItem(menu, "/categories/women-bagsxyz").href).toBe(
      null,
    )
  })

  it("finds nothing off the menu", () => {
    expect(findActiveMenuItem(menu, "/about")).toEqual({
      departmentId: null,
      columnId: null,
      href: null,
    })
  })
})

describe("getCollectionMenu", () => {
  const collection = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    title: id.toUpperCase(),
    handle: id,
    metadata: {
      description: "",
      hero_image: `https://img.example/${id}-wide.jpg`,
      hero_image_mobile: "",
      ...extra,
    },
  })

  it("is hidden without collections", () => {
    expect(getCollectionMenu([], null).display).toBe("hidden")
  })

  it("omits collections without a usable page, including a stale featured selection", () => {
    const unavailable = [
      { ...collection("old"), handle: "" },
      { ...collection("unfinished"), handle: "   " },
    ]
    expect(getCollectionMenu(unavailable, "old")).toEqual({
      display: "hidden",
      href: "/collections",
      tiles: [],
    })
    expect(
      getCollectionMenu([...unavailable, collection("new")], "old"),
    ).toMatchObject({
      display: "link",
      href: "/collections/new",
      tiles: [{ id: "new", featured: false }],
    })
  })

  it("links straight to a single collection", () => {
    expect(getCollectionMenu([collection("aw")], null)).toMatchObject({
      display: "link",
      href: "/collections/aw",
    })
  })

  it("puts the featured collection first and caps the tiles", () => {
    const menu = getCollectionMenu(
      ["a", "b", "c", "d", "e"].map((id) => collection(id)),
      "d",
    )
    expect(menu.display).toBe("menu")
    expect(menu.href).toBe("/collections")
    expect(menu.tiles.map((t) => t.id)).toEqual(["d", "a", "b", "c"])
  })

  it("cleans the banner fields", () => {
    const [tile] = getCollectionMenu(
      [collection("a"), collection("b")],
      null,
    ).tiles
    expect(tile).toMatchObject({
      image: "https://img.example/a-wide.jpg",
      mobileImage: null,
      description: null,
    })
  })
})
