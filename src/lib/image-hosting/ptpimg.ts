// src/lib/image-hosting/ptpimg.ts
//
// Functions: upload (via ptpimgAdapter)

import type { ImageHostAdapter, UploadOptions, UploadResult } from "./types"

const UPLOAD_URL = "https://ptpimg.me/upload.php"

export const ptpimgAdapter: ImageHostAdapter = {
  id: "ptpimg",

  async upload(
    fileBuffer: Buffer,
    fileName: string,
    apiKey: string,
    _options?: UploadOptions
  ): Promise<UploadResult> {
    const form = new FormData()
    form.set("api_key", apiKey)
    form.set("file-upload[]", new Blob([new Uint8Array(fileBuffer)]), fileName)

    const response = await fetch(UPLOAD_URL, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30_000),
    })

    if (!response.ok) {
      throw new Error(`PTPImg upload failed (${response.status})`)
    }

    const data = (await response.json()) as { code: string; ext: string }[]

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("PTPImg returned no image data")
    }

    const { code, ext } = data[0]

    if (!code || !ext) {
      throw new Error("PTPImg returned incomplete image data")
    }

    return {
      url: `https://ptpimg.me/${code}.${ext}`,
      host: "ptpimg",
    }
  },
}
