import { describe, expect, it } from "vitest"

import { parsePageText } from "./page-text"

describe("parsePageText", () => {
  it("reads headings, paragraphs and bullet lists", () => {
    expect(
      parsePageText(
        "## What we collect\r\nYour name and\naddress.\n\n- Payments\n- Delivery\n\nThat's all.",
      ),
    ).toEqual([
      { kind: "heading", text: "What we collect" },
      { kind: "paragraph", text: "Your name and address." },
      { kind: "list", items: ["Payments", "Delivery"] },
      { kind: "paragraph", text: "That's all." },
    ])
  })

  it("keeps HTML as text", () => {
    expect(parsePageText("<script>alert(1)</script>")).toEqual([
      { kind: "paragraph", text: "<script>alert(1)</script>" },
    ])
  })
})
