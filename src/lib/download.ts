// src/lib/download.ts
//
// Functions: extractFilename, triggerBlobDownload, downloadResponseBlob

/**
 * Extracts a filename from a Content-Disposition header.
 * Falls back to the provided default if the header is missing or unparseable.
 */
export function extractFilename(response: Response, fallback: string): string {
  const disposition = response.headers.get("Content-Disposition") ?? ""
  const match = disposition.match(/filename="?([^"]+)"?/)
  return match?.[1] ?? fallback
}

/**
 * Triggers a browser file download from a Blob.
 * Creates a temporary anchor element, clicks it, and cleans up.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Convenience: extracts blob + filename from a Response, then triggers download.
 * Combines extractFilename + triggerBlobDownload for the common case.
 */
export async function downloadResponseBlob(
  response: Response,
  fallbackFilename: string
): Promise<void> {
  const blob = await response.blob()
  const filename = extractFilename(response, fallbackFilename)
  triggerBlobDownload(blob, filename)
}
