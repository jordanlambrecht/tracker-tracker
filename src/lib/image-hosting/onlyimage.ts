// src/lib/image-hosting/onlyimage.ts

import type { ImageHostAdapter, UploadOptions, UploadResult } from "./types"
import { safeImageUrl, validateImageUrl } from "@/lib/validators"

const UPLOAD_URL = "https://onlyimage.org/api/1/upload/"

interface CheveretoResponse {
  status_code: number
  image: {
    url: string
    url_viewer: string
    thumb?: { url: string }
    medium?: { url: string }
  }
  error?: { message: string }
}

/** Convert seconds to an ISO 8601 duration string */
export function secondsToIsoDuration(seconds: number): string {
  if (seconds >= 86400 && seconds % 86400 === 0) return `P${seconds / 86400}D`
  if (seconds >= 3600 && seconds % 3600 === 0) return `PT${seconds / 3600}H`
  if (seconds >= 60 && seconds % 60 === 0) return `PT${seconds / 60}M`
  return `PT${seconds}S`
}

export const onlyimageAdapter: ImageHostAdapter = {
  id: "onlyimage",

  async upload(
    fileBuffer: Buffer,
    fileName: string,
    apiKey: string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    const form = new FormData()
    form.set("source", new Blob([new Uint8Array(fileBuffer)]), fileName)
    form.set("format", "json")

    if (options?.expirationSeconds && options.expirationSeconds > 0) {
      form.set("expiration_date", secondsToIsoDuration(options.expirationSeconds))
    }

    const response = await fetch(UPLOAD_URL, {
      method: "POST",
      headers: { "X-API-Key": apiKey },
      body: form,
      signal: AbortSignal.timeout(30_000),
    })

    if (!response.ok) {
      throw new Error(`OnlyImage upload failed (${response.status})`)
    }

    const data = (await response.json()) as CheveretoResponse

    if (!data.image?.url) {
      throw new Error("OnlyImage returned unexpected response — no image URL")
    }

    return {
      url: validateImageUrl(data.image.url),
      viewerUrl: safeImageUrl(data.image.url_viewer),
      thumbUrl: safeImageUrl(data.image.thumb?.url),
      host: "onlyimage",
    }
  },
}
