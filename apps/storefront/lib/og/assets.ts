import "server-only"

import { readFile } from "node:fs/promises"
import { join } from "node:path"

import sharp from "sharp"

/**
 * Fonts and photos for the link-preview images. ImageResponse can't use
 * next/font, so the files in assets/fonts are read once per server (they
 * are traced into the standalone build by next.config).
 */
const font = (file: string) =>
  readFile(join(process.cwd(), "assets/fonts", file))

const fonts = Promise.all([
  font("BodoniModa-Regular.ttf"),
  font("InstrumentSans-Regular.ttf"),
  font("InstrumentSans-Medium.ttf"),
  font("NotoSans-Naira-400.ttf"),
  font("NotoSans-Naira-500.ttf"),
])

export async function loadFonts() {
  const [bodoni, sans, sansMedium, naira, nairaMedium] = await fonts
  return [
    {
      name: "Bodoni",
      data: bodoni,
      weight: 400 as const,
      style: "normal" as const,
    },
    {
      name: "Sans",
      data: sans,
      weight: 400 as const,
      style: "normal" as const,
    },
    {
      name: "Sans",
      data: sansMedium,
      weight: 500 as const,
      style: "normal" as const,
    },
    // Only "₦", which neither font has; used wherever they lack a glyph.
    {
      name: "Sans",
      data: naira,
      weight: 400 as const,
      style: "normal" as const,
    },
    {
      name: "Sans",
      data: nairaMedium,
      weight: 500 as const,
      style: "normal" as const,
    },
  ]
}

const MAX_IMAGE_BYTES = 12 * 1024 * 1024
/** Wider than any photo on a card, at 2× for sharp previews. */
const MAX_PHOTO_WIDTH = 1000

/**
 * A photo as a JPEG data URI, or null when it can't be had quickly. Any
 * common format is converted (the renderer reads only JPEG and PNG, and
 * admin uploads may be WebP) and shrunk to preview size first, so a large
 * original doesn't slow the card. Fetched here rather than by the renderer
 * so a slow or broken photo is skipped instead of failing the whole image.
 */
export async function loadImage(
  url: string | null | undefined,
): Promise<string | null> {
  if (!url) return null
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      // Photos can exceed the data cache's 2 MB entries; the finished
      // image is cached instead.
      cache: "no-store",
    })
    const type = response.headers.get("content-type") ?? ""
    if (!response.ok || !type.startsWith("image/")) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return null
    const jpeg = await sharp(bytes)
      .rotate()
      .resize({ width: MAX_PHOTO_WIDTH, withoutEnlargement: true })
      .flatten({ background: "#F6F1E7" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`
  } catch {
    return null
  }
}

/** The first of these photos that loads, in order. */
export async function loadFirstImage(urls: (string | null | undefined)[]) {
  for (const url of urls) {
    const image = await loadImage(url)
    if (image) return image
  }
  return null
}
