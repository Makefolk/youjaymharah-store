"use client"

import type { HttpTypes } from "@medusajs/types"
import type { ReactNode } from "react"

import {
  COLOUR_OPTION,
  getOptionChoices,
  type OptionChoice,
  type OptionSelection,
} from "@/lib/medusa/variants"
import { cn } from "@/lib/util/cn"

/**
 * One picker per option, in the admin's order: swatches for Colour, buttons
 * for the rest. Choices that can't be bought with the other choices stay
 * visible and choosable, struck through: picking one switches the main
 * button to "Notify me" for exactly that variant.
 */
export function ProductOptions({
  product,
  selection,
  onChange,
  missing,
  sizeGuide,
}: {
  product: HttpTypes.StoreProduct
  selection: OptionSelection
  onChange: (title: string, value: string) => void
  /** Options the shopper tried to skip; highlighted with a prompt. */
  missing: string[]
  /** Shown beside the Size heading. */
  sizeGuide?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-6">
      {(product.options ?? []).map((option) => {
        const choices = getOptionChoices(product, option.title, selection)
        if (!choices.length) return null
        const chosen = selection[option.title] ?? null
        const isColour =
          option.title.toLowerCase() === COLOUR_OPTION.toLowerCase()
        const flagged = missing.includes(option.title)
        const headingId = `option-${option.id}`

        return (
          <fieldset
            key={option.id}
            aria-labelledby={headingId}
            aria-invalid={flagged || undefined}
            data-option={option.title}
          >
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <p id={headingId} className="text-[13px]">
                <span className="font-medium">{option.title}</span>
                {chosen && (
                  <span className="text-muted-foreground">: {chosen}</span>
                )}
                {flagged && (
                  <span role="alert" className="ml-2 text-destructive">
                    Choose a {option.title.toLowerCase()}
                  </span>
                )}
              </p>
              {!isColour && sizeGuide}
            </div>
            <div
              className={cn("flex flex-wrap", isColour ? "gap-2" : "gap-1.5")}
            >
              {choices.map((choice) =>
                isColour ? (
                  <Swatch
                    key={choice.value}
                    choice={choice}
                    selected={choice.value === chosen}
                    onSelect={() => onChange(option.title, choice.value)}
                  />
                ) : (
                  <ValueButton
                    key={choice.value}
                    choice={choice}
                    selected={choice.value === chosen}
                    flagged={flagged}
                    onSelect={() => onChange(option.title, choice.value)}
                  />
                ),
              )}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}

function Swatch({
  choice,
  selected,
  onSelect,
}: {
  choice: OptionChoice
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${choice.value}${choice.available ? "" : ", sold out"}`}
      title={choice.value}
      onClick={onSelect}
      className={cn(
        "relative size-9 p-0.5 outline-offset-2 transition-[outline-color] focus-visible:outline-2 focus-visible:outline-foreground",
        selected
          ? "outline-1 outline-foreground"
          : "outline-1 outline-transparent hover:outline-border",
      )}
    >
      <span
        className="block size-full border border-black/10 bg-cover bg-center"
        style={{
          backgroundColor: choice.hex ?? undefined,
          backgroundImage: choice.swatchImage
            ? `url(${choice.swatchImage})`
            : undefined,
        }}
      >
        {!choice.hex && !choice.swatchImage && (
          <span className="flex size-full items-center justify-center text-[10px] uppercase">
            {choice.value.slice(0, 2)}
          </span>
        )}
      </span>
      {!choice.available && (
        <span
          aria-hidden
          className="absolute inset-0 m-auto h-px w-[130%] -translate-x-[12%] rotate-[-45deg] bg-foreground/60"
        />
      )}
    </button>
  )
}

function ValueButton({
  choice,
  selected,
  flagged,
  onSelect,
}: {
  choice: OptionChoice
  selected: boolean
  flagged: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${choice.value}${choice.available ? "" : ", sold out"}`}
      onClick={onSelect}
      className={cn(
        "h-10 min-w-12 border px-3 text-[13px] tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
        selected
          ? "border-foreground bg-foreground text-background"
          : flagged
            ? "border-destructive/60 hover:border-foreground"
            : "border-border hover:border-foreground",
        !choice.available &&
          (selected
            ? "line-through decoration-background/70"
            : "text-muted-foreground line-through"),
      )}
    >
      {choice.value}
    </button>
  )
}
