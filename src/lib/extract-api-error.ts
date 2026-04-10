// src/lib/extract-api-error.ts

export async function extractApiError(res: Response, fallback = "Request failed"): Promise<string> {
  try {
    const data: { error?: string } = await res.json()
    return data.error ?? fallback
  } catch {
    return fallback
  }
}
