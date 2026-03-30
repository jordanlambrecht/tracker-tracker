// src/lib/image-hosting/imgbb.ts

import { safeImageUrl, validateImageUrl } from "@/lib/validators"
import type { ImageHostAdapter, UploadOptions, UploadResult } from "./types"

const UPLOAD_URL = "https://api.imgbb.com/1/upload"

const MIN_EXPIRATION = 60
const MAX_EXPIRATION = 15_552_000

interface ImgBBResponse {
  success: boolean
  status: number
  data: {
    id: string
    url: string
    url_viewer: string
    image: { url: string }
    thumb?: { url: string }
    delete_url?: string
  }
  error?: { message: string }
}

export const imgbbAdapter: ImageHostAdapter = {
  id: "imgbb",

  async upload(
    fileBuffer: Buffer,
    fileName: string,
    apiKey: string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    // API key sent as form field (not query param) to avoid leaking it in
    // server access logs, CDN caches, and browser history.
    const form = new FormData()
    form.set("key", apiKey)
    form.set("image", new Blob([new Uint8Array(fileBuffer)]), fileName)

    if (options?.expirationSeconds && options.expirationSeconds > 0) {
      const clamped = Math.max(MIN_EXPIRATION, Math.min(MAX_EXPIRATION, options.expirationSeconds))
      form.set("expiration", String(clamped))
    }

    const response = await fetch(UPLOAD_URL, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30_000),
    })

    if (!response.ok) {
      throw new Error(`ImgBB upload failed (${response.status})`)
    }

    const data = (await response.json()) as ImgBBResponse

    if (!data.success) {
      throw new Error(`ImgBB upload failed: ${data.error?.message ?? "unknown error"}`)
    }

    return {
      url: validateImageUrl(data.data.image.url),
      viewerUrl: safeImageUrl(data.data.url_viewer),
      thumbUrl: safeImageUrl(data.data.thumb?.url),
      deleteId: data.data.id,
      host: "imgbb",
    }
  },
}
