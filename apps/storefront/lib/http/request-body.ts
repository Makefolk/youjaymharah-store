export class RequestBodyError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export async function readBoundedBody(
  request: Request,
  maxBytes = 64 * 1024,
): Promise<ArrayBuffer> {
  const length = request.headers.get("content-length")
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    throw new RequestBodyError("Request body is too large.", 413)
  }
  if (!request.body) return new ArrayBuffer(0)

  const reader = request.body.getReader()
  let interrupted = false
  const cancel = () => {
    interrupted = true
    void reader.cancel().catch(() => {})
  }
  const timer = setTimeout(cancel, 10_000)
  request.signal.addEventListener("abort", cancel, { once: true })
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    if (request.signal.aborted) cancel()
    while (true) {
      const { done, value } = await reader.read()
      if (interrupted)
        throw new RequestBodyError("Request body timed out.", 408)
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        void reader.cancel().catch(() => {})
        throw new RequestBodyError("Request body is too large.", 413)
      }
      chunks.push(value)
    }
    const body = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      body.set(chunk, offset)
      offset += chunk.byteLength
    }
    return body.buffer
  } finally {
    clearTimeout(timer)
    request.signal.removeEventListener("abort", cancel)
    reader.releaseLock()
  }
}

export async function readJsonBody<T>(
  request: Request,
): Promise<T | Response | null> {
  try {
    return JSON.parse(
      new TextDecoder().decode(await readBoundedBody(request, 16 * 1024)),
    ) as T
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return Response.json({ message: error.message }, { status: error.status })
    }
    return null
  }
}
