// src/lib/image-hosting/types.ts
//
// Types: ImageHostId, UploadOptions, UploadResult, ImageHostAdapter

export type ImageHostId = "ptpimg" | "onlyimage" | "imgbb"

export interface UploadOptions {
  /** Seconds until auto-delete. Only supported by imgbb (60-15552000) and onlyimage (ISO 8601 converted internally). null = permanent. */
  expirationSeconds?: number | null
}

export interface UploadResult {
  /** Direct URL to the full-size image */
  url: string
  /** URL to the viewer/gallery page (if available) */
  viewerUrl?: string
  /** Thumbnail URL (if available) */
  thumbUrl?: string
  /** Image ID for programmatic deletion — requires API key + this ID (if available) */
  deleteId?: string
  /** Which host was used */
  host: ImageHostId
}

// Stateless object adapters — no class needed since there's no per-instance state.
// This differs from tracker adapters (class-based) because image host uploads are
// simple request/response with no session, polling, or connection state.
export interface ImageHostAdapter {
  readonly id: ImageHostId
  upload(
    fileBuffer: Buffer,
    fileName: string,
    apiKey: string,
    options?: UploadOptions
  ): Promise<UploadResult>
}
