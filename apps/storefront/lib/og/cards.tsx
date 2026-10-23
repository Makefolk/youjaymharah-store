import type { ReactNode } from "react"

/**
 * Link-preview cards (1200 × 630, what WhatsApp, Instagram, X, Facebook and
 * iMessage show for a shared link), drawn with ImageResponse. Satori lays
 * out only flexbox, so every element with children says `display: flex`.
 *
 * Follows the storefront style guide: photography carries the card, Bodoni
 * only at display sizes, ink for the one action, gold as a hairline accent,
 * no red sale styling.
 */

export const OG_SIZE = { width: 1200, height: 630 }

const INK = "#0A0A0A"
const IVORY = "#F6F1E7"
const MUTED = "#76705F"
const GOLD = "#C9A227"
const HAIRLINE = "#E6E0D4"

/** Cuts text to a length that fits its lines, at a word. */
export function fit(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(" ")
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

function Photo({
  src,
  width,
  height,
}: {
  src: string | null
  width: number
  height: number
}) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- rendered by Satori, not the browser
    <img
      src={src}
      width={width}
      height={height}
      alt=""
      style={{ width, height, objectFit: "cover" }}
    />
  ) : (
    <div style={{ display: "flex", width, height, background: HAIRLINE }} />
  )
}

/** Up to three photos filling `width` × 630: one, a pair, or one beside two. */
export function PhotoMosaic({
  photos,
  width,
}: {
  photos: (string | null)[]
  width: number
}) {
  const shown = photos.filter(Boolean).slice(0, 3) as string[]
  const height = OG_SIZE.height
  const gap = 4
  if (shown.length <= 1) {
    return <Photo src={shown[0] ?? null} width={width} height={height} />
  }
  if (shown.length === 2) {
    const half = (width - gap) / 2
    return (
      <div style={{ display: "flex", gap, background: IVORY }}>
        <Photo src={shown[0]} width={half} height={height} />
        <Photo src={shown[1]} width={half} height={height} />
      </div>
    )
  }
  // One tall photo beside two stacked ones.
  const lead = Math.round(width * 0.55)
  const side = width - lead - gap
  const rest = shown.slice(1)
  const each = (height - gap * (rest.length - 1)) / rest.length
  return (
    <div style={{ display: "flex", gap, background: IVORY }}>
      <Photo src={shown[0]} width={lead} height={height} />
      <div style={{ display: "flex", flexDirection: "column", gap }}>
        {rest.map((src, index) => (
          <Photo key={index} src={src} width={side} height={each} />
        ))}
      </div>
    </div>
  )
}

/**
 * The text side of a card: brand, an attention line, the headline, the
 * price or count, details, and one call to action, with the site's address.
 */
export function CardPanel({
  brand,
  site,
  flag,
  title,
  price,
  details,
  action,
  width,
}: {
  brand: string
  site: string
  /** "On sale −30%", "New in", "Only 2 left": the reason to look now. */
  flag?: string | null
  title: string
  price?: ReactNode
  details?: string | null
  action: string
  width: number
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width,
        height: OG_SIZE.height,
        padding: "56px 60px 52px",
        background: IVORY,
        color: INK,
        fontFamily: "Sans",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            display: "flex",
            fontSize: 17,
            fontWeight: 500,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          {brand}
        </div>
        <div
          style={{ display: "flex", flex: 1, height: 1, background: GOLD }}
        />
        <div style={{ display: "flex", fontSize: 17, color: MUTED }}>
          {site}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {flag && (
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "8px 14px",
              border: `1px solid ${GOLD}`,
              fontSize: 17,
              fontWeight: 500,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {flag}
          </div>
        )}
        <div
          style={{
            display: "flex",
            fontFamily: "Bodoni",
            fontSize: title.length > 34 ? 52 : 64,
            lineHeight: 1.08,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </div>
        {price}
        {details && (
          <div style={{ display: "flex", fontSize: 22, color: MUTED }}>
            {details}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignSelf: "flex-start",
          alignItems: "center",
          gap: 14,
          padding: "20px 30px",
          background: INK,
          color: "#FFFFFF",
          fontSize: 19,
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {action}
        <span style={{ color: GOLD }}>→</span>
      </div>
    </div>
  )
}

/** "₦435,000", or the sale price with the original struck through. */
export function PriceLine({
  amount,
  original,
  percentOff,
  from = false,
}: {
  amount: string
  original?: string | null
  percentOff?: number | null
  from?: boolean
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
      <div style={{ display: "flex", fontSize: 38, fontWeight: 500 }}>
        {from ? `From ${amount}` : amount}
      </div>
      {original && (
        <div
          style={{
            display: "flex",
            fontSize: 26,
            color: MUTED,
            textDecoration: "line-through",
          }}
        >
          {original}
        </div>
      )}
      {percentOff ? (
        <div style={{ display: "flex", fontSize: 26, color: MUTED }}>
          −{percentOff}%
        </div>
      ) : null}
    </div>
  )
}

/** Side by side: photos on the left, the panel on the right. */
export function Card({
  photos,
  panel,
}: {
  photos: ReactNode
  panel: ReactNode
}) {
  return (
    <div
      style={{
        display: "flex",
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        background: IVORY,
      }}
    >
      {photos}
      {panel}
    </div>
  )
}
