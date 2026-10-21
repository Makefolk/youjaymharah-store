"use client"

import { XIcon } from "@phosphor-icons/react"
import { useId, useState } from "react"

import { MAX_PHOTOS, preparePhoto, type PhotoUpload } from "@/lib/help/photos"

/** Up to three photos, shrunk in the browser before they are sent. */
export function PhotoPicker({
  photos,
  onChange,
  label = "Photos (optional)",
  hint,
}: {
  photos: PhotoUpload[]
  onChange: (photos: PhotoUpload[]) => void
  label?: string
  hint?: string
}) {
  const id = useId()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const add = async (files: FileList | null) => {
    if (!files?.length) return
    setProblem(null)
    setBusy(true)
    try {
      const room = MAX_PHOTOS - photos.length
      const chosen = [...files].slice(0, room)
      const prepared = await Promise.all(chosen.map(preparePhoto))
      onChange([...photos, ...prepared])
      if (files.length > room)
        setProblem(`You can attach up to ${MAX_PHOTOS} photos.`)
    } catch {
      setProblem("That photo couldn't be read. Try a JPEG or PNG.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium">{label}</span>
      {hint && (
        <span className="text-[13px] text-muted-foreground">{hint}</span>
      )}
      <div className="flex flex-wrap gap-2">
        {photos.map((photo, index) => (
          <div key={index} className="relative size-20">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local preview */}
            <img
              src={`data:image/jpeg;base64,${photo.data}`}
              alt={photo.name}
              className="size-20 object-cover"
            />
            <button
              type="button"
              aria-label={`Remove ${photo.name}`}
              onClick={() => onChange(photos.filter((_, i) => i !== index))}
              className="absolute top-1 right-1 flex size-6 items-center justify-center bg-background/90"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <label
            htmlFor={id}
            className="flex size-20 cursor-pointer items-center justify-center border border-dashed border-foreground/30 text-center text-[11px] text-muted-foreground hover:border-foreground"
          >
            {busy ? "Adding…" : "Add photo"}
            <input
              id={id}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(event) => {
                void add(event.target.files)
                event.target.value = ""
              }}
            />
          </label>
        )}
      </div>
      {problem && (
        <p role="alert" className="text-[13px] text-destructive">
          {problem}
        </p>
      )}
    </div>
  )
}
