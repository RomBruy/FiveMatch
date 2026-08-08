import {
  PHOTO_ALLOWED_MIME_TYPES,
  PHOTO_FETCH_TIMEOUT_MS,
  PHOTO_MAX_INPUT_BYTES,
} from '@fivematch/types'

export class ImageFetchError extends Error {
  constructor(public code: string) {
    super(code)
    this.name = 'ImageFetchError'
  }
}

/**
 * Fetch a source image under explicit limits (rule 40).
 *
 * The previous implementation was a bare `fetch(url)` that followed redirects,
 * accepted any content type and read the whole body into memory. Each of those
 * is a way for a URL that merely looks like a photo to become something else:
 * a redirect into internal network space, a multi-gigabyte body, an HTML page
 * handed to the moderation step as if it were an image.
 */
export async function fetchSourceImage(url: string): Promise<{ bytes: Buffer; mimeType: string }> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new ImageFetchError('INVALID_INPUT_URL')
  }

  // Only ever plain HTTPS. `file:`, `data:` and friends are not photo hosts.
  if (parsed.protocol !== 'https:') throw new ImageFetchError('INSECURE_INPUT_URL')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PHOTO_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(parsed.toString(), {
      // A redirect is where a benign-looking URL turns into somewhere else, so
      // it is refused rather than followed.
      redirect: 'error',
      signal: controller.signal,
    })

    if (!response.ok) throw new ImageFetchError('INPUT_FETCH_FAILED')

    const mimeType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    if (!(PHOTO_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
      throw new ImageFetchError('UNSUPPORTED_INPUT_TYPE')
    }

    // Trust the declared length when it disqualifies the download, but never
    // trust its absence — the body is capped again while reading.
    const declared = Number(response.headers.get('content-length') ?? '0')
    if (declared > PHOTO_MAX_INPUT_BYTES) throw new ImageFetchError('INPUT_TOO_LARGE')

    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.byteLength > PHOTO_MAX_INPUT_BYTES) throw new ImageFetchError('INPUT_TOO_LARGE')
    if (bytes.byteLength === 0) throw new ImageFetchError('INPUT_FETCH_FAILED')

    return { bytes, mimeType }
  } catch (err) {
    if (err instanceof ImageFetchError) throw err
    if ((err as Error).name === 'AbortError') throw new ImageFetchError('INPUT_FETCH_TIMEOUT')
    throw new ImageFetchError('INPUT_FETCH_FAILED')
  } finally {
    clearTimeout(timeout)
  }
}
