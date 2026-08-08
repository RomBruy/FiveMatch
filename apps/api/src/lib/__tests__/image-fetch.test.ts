import { afterEach, describe, expect, it, vi } from 'vitest'
import { PHOTO_MAX_INPUT_BYTES } from '@fivematch/types'
import { fetchSourceImage, ImageFetchError } from '../image-fetch'

function respond(options: {
  ok?: boolean
  contentType?: string
  contentLength?: string
  body?: Buffer
}) {
  const body = options.body ?? Buffer.alloc(64, 1)
  return {
    ok: options.ok ?? true,
    headers: {
      get: (name: string) => {
        if (name === 'content-type') return options.contentType ?? 'image/jpeg'
        if (name === 'content-length') return options.contentLength ?? String(body.byteLength)
        return null
      },
    },
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  }
}

const mockFetch = (impl: unknown) => {
  vi.stubGlobal('fetch', impl)
}

afterEach(() => vi.unstubAllGlobals())

describe('fetchSourceImage', () => {
  it('accepts an https image of an allowed type', async () => {
    mockFetch(vi.fn().mockResolvedValue(respond({})))
    const result = await fetchSourceImage('https://cdn.example.com/photo.jpg')

    expect(result.mimeType).toBe('image/jpeg')
    expect(result.bytes.byteLength).toBe(64)
  })

  it('refuses a non-https URL', async () => {
    const spy = vi.fn()
    mockFetch(spy)

    // `file:` and `data:` are not photo hosts, and plain http is not either.
    await expect(fetchSourceImage('http://cdn.example.com/photo.jpg'))
      .rejects.toMatchObject({ code: 'INSECURE_INPUT_URL' })
    await expect(fetchSourceImage('file:///etc/passwd'))
      .rejects.toMatchObject({ code: 'INSECURE_INPUT_URL' })

    // Rejected before any request is made.
    expect(spy).not.toHaveBeenCalled()
  })

  it('refuses a malformed URL', async () => {
    mockFetch(vi.fn())
    await expect(fetchSourceImage('not a url')).rejects.toBeInstanceOf(ImageFetchError)
  })

  it('does not follow redirects', async () => {
    const spy = vi.fn().mockResolvedValue(respond({}))
    mockFetch(spy)
    await fetchSourceImage('https://cdn.example.com/photo.jpg')

    // A redirect is where a benign-looking URL becomes somewhere else entirely,
    // so the fetch must refuse rather than chase it.
    expect(spy.mock.calls[0]?.[1]).toMatchObject({ redirect: 'error' })
  })

  it('refuses a content type that is not an allowed image', async () => {
    mockFetch(vi.fn().mockResolvedValue(respond({ contentType: 'text/html' })))
    await expect(fetchSourceImage('https://cdn.example.com/page'))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_INPUT_TYPE' })
  })

  it('ignores content-type parameters when matching', async () => {
    mockFetch(vi.fn().mockResolvedValue(respond({ contentType: 'image/png; charset=binary' })))
    const result = await fetchSourceImage('https://cdn.example.com/photo.png')
    expect(result.mimeType).toBe('image/png')
  })

  it('refuses a declared length over the cap without downloading', async () => {
    const body = Buffer.alloc(16, 1)
    mockFetch(vi.fn().mockResolvedValue(respond({
      body,
      contentLength: String(PHOTO_MAX_INPUT_BYTES + 1),
    })))

    await expect(fetchSourceImage('https://cdn.example.com/huge.jpg'))
      .rejects.toMatchObject({ code: 'INPUT_TOO_LARGE' })
  })

  it('refuses an oversized body that declared no length', async () => {
    // A missing content-length must not become a way around the cap.
    const body = Buffer.alloc(PHOTO_MAX_INPUT_BYTES + 1, 1)
    mockFetch(vi.fn().mockResolvedValue(respond({ body, contentLength: '0' })))

    await expect(fetchSourceImage('https://cdn.example.com/huge.jpg'))
      .rejects.toMatchObject({ code: 'INPUT_TOO_LARGE' })
  })

  it('refuses an empty body', async () => {
    mockFetch(vi.fn().mockResolvedValue(respond({ body: Buffer.alloc(0) })))
    await expect(fetchSourceImage('https://cdn.example.com/empty.jpg'))
      .rejects.toMatchObject({ code: 'INPUT_FETCH_FAILED' })
  })

  it('refuses a non-ok response', async () => {
    mockFetch(vi.fn().mockResolvedValue(respond({ ok: false })))
    await expect(fetchSourceImage('https://cdn.example.com/missing.jpg'))
      .rejects.toMatchObject({ code: 'INPUT_FETCH_FAILED' })
  })

  it('reports a timeout distinctly', async () => {
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' })
    mockFetch(vi.fn().mockRejectedValue(abortError))

    await expect(fetchSourceImage('https://cdn.example.com/slow.jpg'))
      .rejects.toMatchObject({ code: 'INPUT_FETCH_TIMEOUT' })
  })

  it('passes an abort signal so a stalled host cannot hang the job', async () => {
    const spy = vi.fn().mockResolvedValue(respond({}))
    mockFetch(spy)
    await fetchSourceImage('https://cdn.example.com/photo.jpg')

    expect(spy.mock.calls[0]?.[1]?.signal).toBeDefined()
  })
})
