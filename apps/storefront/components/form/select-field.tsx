"use client"

import { useId, type ComponentProps } from "react"

import { cn } from "@/lib/util/cn"

import { FieldError } from "./field-error"
import { useFieldContext } from "./form-context"

type SelectFieldProps = Omit<
  ComponentProps<"select">,
  "id" | "name" | "value" | "onChange" | "onBlur" | "children"
> & {
  label: string
  options: readonly string[]
  placeholder?: string
}

/**
 * A labelled native select bound to its field, styled like `Input`. Native,
 * so phones show their own picker.
 */
export function SelectField({
  label,
  options,
  placeholder = "Choose…",
  className,
  ...props
}: SelectFieldProps) {
  const field = useFieldContext<string>()
  const id = useId()
  const invalid = field.state.meta.errors.length > 0

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </label>
      <select
        id={id}
        name={field.name}
        value={field.state.value}
        onChange={(event) => field.handleChange(event.target.value)}
        onBlur={field.handleBlur}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className="h-8 w-full min-w-0 rounded-none border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20"
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <FieldError id={`${id}-error`} />
    </div>
  )
}
