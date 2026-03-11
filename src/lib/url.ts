// src/lib/url.ts

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "").toLowerCase()
}

export { normalizeUrl }
