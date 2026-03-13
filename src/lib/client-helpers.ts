// src/lib/client-helpers.ts
//
// Functions: extractApiError

/**
 * Extracts an error message from a failed API response.
 * Falls back to the provided default if the response body has no `error` field.
 * For use in client-side fetch handlers.
 */
export async function extractApiError(res: Response, fallback = "Request failed"): Promise<string> {
  try {
    const data: { error?: string } = await res.json()
    return data.error ?? fallback
  } catch {
    return fallback
  }
}
