// src/lib/tracker-credentials/reveal-limit.ts
//
// Functions: consumeRevealToken, resetRevealLimit
//
// A fixed-window throttle for the ONE endpoint in this feature that returns
// secret plaintext keyed by an id. This app is single-user and every caller is
// already authenticated, so this is not an anti-abuse system, it is a blast
// radius limit. If a session cookie is ever stolen or an XSS lands, the reveal
// endpoint is a loop away from draining every secret in the vault; a cap turns
// "instant full exfiltration" into something slow enough to notice in the log.
//
// State lives on globalThis so it survives HMR reloads in development, matching
// failure-log-gate.ts. Fully synchronous: any await between reading and writing
// the counter would open a read-modify-write race between concurrent reveals.

import "server-only"

/** Length of the fixed window. */
export const REVEAL_WINDOW_MS = 60_000

/**
 * Reveals allowed per window, across all trackers.
 *
 * A human clicking show/copy in a sheet does a handful per minute; the vault
 * itself is capped at MAX_FIELDS_PER_VAULT (100) fields, so 30 is comfortably
 * above real use while still being below "drain one whole vault in a window".
 */
export const REVEAL_MAX_PER_WINDOW = 30

interface RevealWindow {
  windowStart: number
  count: number
}

const STATE_KEY = "__trackerCredentialRevealLimit"

function getWindow(): RevealWindow {
  const g = globalThis as unknown as Record<string, RevealWindow | undefined>
  let state = g[STATE_KEY]
  if (!state) {
    state = { windowStart: 0, count: 0 }
    g[STATE_KEY] = state
  }
  return state
}

/**
 * Count one reveal against the current window.
 *
 * Returns the number of ms until the window resets when the caller is over the
 * cap, or null when the reveal is allowed. A rejected call does NOT extend the
 * window, a fixed window, not a sliding penalty, so a client that backs off
 * always recovers at a predictable time.
 */
export function consumeRevealToken(now: number = Date.now()): number | null {
  const state = getWindow()
  if (now - state.windowStart >= REVEAL_WINDOW_MS) {
    state.windowStart = now
    state.count = 0
  }
  if (state.count >= REVEAL_MAX_PER_WINDOW) {
    return Math.max(1, state.windowStart + REVEAL_WINDOW_MS - now)
  }
  state.count++
  return null
}

/** Test seam. Never called by the app. */
export function resetRevealLimit(): void {
  const g = globalThis as unknown as Record<string, RevealWindow | undefined>
  g[STATE_KEY] = undefined
}
