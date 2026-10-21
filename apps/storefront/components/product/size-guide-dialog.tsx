"use client"

import type { StoreSizeGuide } from "@youjaymharah/api-types"
import Image from "next/image"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useMeasurementUnit } from "@/features/size-guide/use-measurement-unit"
import {
  findSizeGuideRow,
  formatSizeGuideCell,
  sizeGuideColumnHeading,
  type MeasurementUnit,
} from "@/lib/medusa/size-guide"
import { cn } from "@/lib/util/cn"

/** "Size guide" link and the table it opens, with the chosen size highlighted. */
export function SizeGuideDialog({
  guide,
  selectedSize,
}: {
  guide: StoreSizeGuide
  selectedSize: string | null | undefined
}) {
  const [unit, setUnit] = useMeasurementUnit()
  const highlighted = findSizeGuideRow(guide, selectedSize)

  return (
    <Dialog>
      <DialogTrigger className="text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground">
        Size guide
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogTitle className="text-xl font-medium">{guide.name}</DialogTitle>
        {guide.description && (
          <DialogDescription className="text-[13px] leading-relaxed">
            {guide.description}
          </DialogDescription>
        )}

        <div
          role="radiogroup"
          aria-label="Measurement unit"
          className="flex gap-4 text-[13px]"
        >
          {(["cm", "in"] as MeasurementUnit[]).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={unit === option}
              onClick={() => setUnit(option)}
              className={cn(
                "pb-1",
                unit === option
                  ? "border-b border-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option === "cm" ? "Centimetres" : "Inches"}
            </button>
          ))}
        </div>

        <div className="-mx-2 overflow-x-auto">
          <table className="w-full text-left text-[13px] tabular-nums">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="px-2 py-2 font-medium">
                  Size
                </th>
                {guide.columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className="px-2 py-2 font-medium whitespace-nowrap"
                  >
                    {sizeGuideColumnHeading(column, unit)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {guide.rows.map((row) => (
                <tr
                  key={row.size}
                  aria-current={row === highlighted || undefined}
                  className={cn(
                    "border-b border-border/60",
                    row === highlighted && "bg-muted font-medium",
                  )}
                >
                  <th scope="row" className="px-2 py-2 font-medium">
                    {row.size}
                  </th>
                  {guide.columns.map((column) => (
                    <td
                      key={column.key}
                      className="px-2 py-2 whitespace-nowrap"
                    >
                      {formatSizeGuideCell(
                        column,
                        row.values[column.key],
                        unit,
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {guide.diagram_url && (
          <div className="relative aspect-4/3 bg-muted">
            <Image
              src={guide.diagram_url}
              alt="How to measure"
              fill
              sizes="(min-width: 640px) 640px, 100vw"
              className="object-contain"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
