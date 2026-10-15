// src/lib/tracker-platforms/helpers/envelope.ts
//
// Functions: envelopeError

/**
 * The failure a tracker signalled inside an HTTP 200 body, or null when the
 * body reports success. adapterFetch throws only on a non-2xx, and the debug
 * view marks a call healthy when `error` is null, so without this a rejected
 * key in a 200 body shows as healthy. Covers the Gazelle/GGn status envelope
 * and the Hawke success envelope; MAM checks for itself.
 */
export function envelopeError(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null
  const body = data as Record<string, unknown>

  if (typeof body.status === "string" && body.status !== "success") {
    const reason = typeof body.error === "string" ? body.error.trim() : ""
    return reason || `Tracker returned status: ${body.status}`
  }

  if (typeof body.success === "boolean" && !body.success) {
    const reason = typeof body.message === "string" ? body.message.trim() : ""
    return reason || "Tracker reported a failure with no message"
  }

  return null
}
