// src/lib/tracker-platforms/helpers/poll-error.ts
//
// Functions: pollError

/**
 * The message fetchStats fails the poll with for a body, or null when the body
 * passes. `read` is the function fetchStats reads that body with, so fetchRaw
 * applies every check the poll makes without a second copy of them.
 */
export function pollError(read: () => unknown): string | null {
  try {
    read()
    return null
  } catch (err) {
    return err instanceof Error ? err.message : "Request failed"
  }
}
