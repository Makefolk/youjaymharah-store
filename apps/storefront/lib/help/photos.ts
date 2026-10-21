/** The most photos a message can carry (the backend's limit too). */
export const MAX_PHOTOS = 3

export type PhotoUpload = { name: string; data: string }

/**
 * A photo resized to at most 1600px and re-encoded as JPEG, as base64.
 * Phone photos are often 5 to 10 MB; this keeps them well under the 3 MB
 * limit, and drops their location data along the way.
 */
export async function preparePhoto(file: File): Promise<PhotoUpload> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) =>
        result ? resolve(result) : reject(new Error("Couldn't read the photo")),
      "image/jpeg",
      0.82,
    ),
  )
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ""
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return {
    name: file.name.replace(/\.[^.]+$/, "") + ".jpg",
    data: btoa(binary),
  }
}
