// src/lib/__tests__/notification-delivery.test.ts
//
// Tests for the notification delivery circuit breaker in deliver.ts.
// Covers: circuit state transitions, cooldown expiry, rate limiting,
// Retry-After parsing (including NaN guard), error sanitization,
// and successful delivery reset.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock("@/lib/error-utils", () => ({
  sanitizeNetworkError: vi.fn((_raw: string, fallback: string) => fallback),
}))

const TARGET_ID = 42
const WEBHOOK_URL = "https://discord.com/api/webhooks/123/abc"
const EMBEDS = [{ title: "test" }] as Record<string, unknown>[]

function mockFetchOk() {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: "OK" }))
}

function mockFetchError(status: number, statusText: string, headers?: Record<string, string>) {
  const headerMap = new Map(Object.entries(headers ?? {}))
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      statusText,
      headers: { get: (k: string) => headerMap.get(k) ?? null },
    })
  )
}

function mockFetchThrow(message: string) {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error(message)))
}

describe("notification delivery circuit breaker", () => {
  let deliverDiscordWebhook: typeof import("@/lib/notifications/deliver").deliverDiscordWebhook
  let getCircuitState: typeof import("@/lib/notifications/deliver").getCircuitState
  let resetCircuitBreaker: typeof import("@/lib/notifications/deliver").resetCircuitBreaker

  beforeEach(async () => {
    vi.resetModules()
    // Clear globalThis circuit breaker state
    const g = globalThis as Record<string, unknown>
    delete g.__notificationCircuitBreakers

    const mod = await import("@/lib/notifications/deliver")
    deliverDiscordWebhook = mod.deliverDiscordWebhook
    getCircuitState = mod.getCircuitState
    resetCircuitBreaker = mod.resetCircuitBreaker
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  // ─── Successful delivery ─────────────────────────────────────────────

  it("returns delivered on successful fetch", async () => {
    mockFetchOk()
    const result = await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)
    expect(result).toEqual({ success: true, status: "delivered" })
  })

  it("resets circuit breaker after successful delivery", async () => {
    // Record 2 failures first
    mockFetchError(500, "Internal Server Error")
    await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)
    await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)
    expect(getCircuitState(TARGET_ID).failures).toBe(2)

    // Successful delivery resets
    mockFetchOk()
    await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)
    expect(getCircuitState(TARGET_ID).failures).toBe(0)
  })

  // ─── Failure tracking ────────────────────────────────────────────────

  it("increments failure count on non-ok response", async () => {
    mockFetchError(500, "Internal Server Error")
    await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)
    expect(getCircuitState(TARGET_ID).failures).toBe(1)
    expect(getCircuitState(TARGET_ID).openUntil).toBeNull()
  })

  it("opens circuit after 3 consecutive failures", async () => {
    mockFetchError(500, "Internal Server Error")
    await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)
    await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)
    await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)

    const state = getCircuitState(TARGET_ID)
    expect(state.failures).toBe(3)
    expect(state.openUntil).toBeInstanceOf(Date)
    expect(state.openUntil?.getTime()).toBeGreaterThan(Date.now())
  })

  it("returns failed with circuit breaker error when breaker is open", async () => {
    mockFetchError(500, "Internal Server Error")
    await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)
    await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)
    await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)

    // 4th attempt should be blocked
    const result = await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)
    expect(result.status).toBe("failed")
    expect(result.error).toContain("Circuit breaker open")
    expect(result.success).toBe(false)
    // fetch should NOT have been called for the 4th attempt
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3)
  })

  it("auto-resets circuit after cooldown expires", async () => {
    mockFetchError(500, "Internal Server Error")
    await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)
    await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)
    await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)

    // Fast-forward past the cooldown
    const state = getCircuitState(TARGET_ID)
    state.openUntil = new Date(Date.now() - 1000) // expired 1 second ago

    mockFetchOk()
    const result = await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)
    expect(result.status).toBe("delivered")
    expect(getCircuitState(TARGET_ID).failures).toBe(0)
  })

  // ─── Rate limiting (429) ─────────────────────────────────────────────

  it("handles 429 with Retry-After header", async () => {
    mockFetchError(429, "Too Many Requests", { "Retry-After": "10" })
    const result = await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)
    expect(result.status).toBe("rate_limited")
    expect(result.error).toBe("Rate limited by Discord")
  })

  it("caps Retry-After at 5 minutes (300_000ms)", async () => {
    mockFetchError(429, "Too Many Requests", { "Retry-After": "999" })
    await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)
    await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)
    await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)

    const state = getCircuitState(TARGET_ID)
    const cooldownMs = (state.openUntil?.getTime() ?? 0) - Date.now()
    // Should be capped at ~300_000ms, not 999_000ms
    expect(cooldownMs).toBeLessThanOrEqual(300_100) // small tolerance
    expect(cooldownMs).toBeGreaterThan(299_000)
  })

  it("falls back to 60s when Retry-After is NaN (date format)", async () => {
    mockFetchError(429, "Too Many Requests", { "Retry-After": "Thu, 01 Jan 2026 00:00:00 GMT" })
    await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)
    await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)
    await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)

    const state = getCircuitState(TARGET_ID)
    const cooldownMs = (state.openUntil?.getTime() ?? 0) - Date.now()
    // Should fall back to 60_000ms, not NaN
    expect(cooldownMs).toBeGreaterThan(59_000)
    expect(cooldownMs).toBeLessThanOrEqual(60_100)
  })

  it("defaults Retry-After to 60s when header is absent", async () => {
    mockFetchError(429, "Too Many Requests")
    await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)
    await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)
    await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)

    const state = getCircuitState(TARGET_ID)
    const cooldownMs = (state.openUntil?.getTime() ?? 0) - Date.now()
    expect(cooldownMs).toBeGreaterThan(59_000)
    expect(cooldownMs).toBeLessThanOrEqual(60_100)
  })

  // ─── Network errors ──────────────────────────────────────────────────

  it("handles fetch throw (network error) as failure", async () => {
    mockFetchThrow("connect ECONNREFUSED")
    const result = await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)
    expect(result.success).toBe(false)
    expect(result.status).toBe("failed")
    expect(getCircuitState(TARGET_ID).failures).toBe(1)
  })

  it("sanitizes error messages from fetch failures", async () => {
    const { sanitizeNetworkError } = await import("@/lib/error-utils")
    mockFetchThrow("connect ECONNREFUSED 192.168.1.100:443")
    await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)
    expect(sanitizeNetworkError).toHaveBeenCalledWith(
      "connect ECONNREFUSED 192.168.1.100:443",
      "Delivery failed"
    )
  })

  it("sanitizes error messages from non-ok HTTP responses", async () => {
    const { sanitizeNetworkError } = await import("@/lib/error-utils")
    mockFetchError(403, "Forbidden")
    await deliverDiscordWebhook(TARGET_ID, WEBHOOK_URL, EMBEDS)
    expect(sanitizeNetworkError).toHaveBeenCalledWith(
      "Webhook API error: 403 Forbidden",
      "Delivery failed"
    )
  })

  // ─── Isolation between targets ────────────────────────────────────────

  it("tracks circuit state independently per target", async () => {
    mockFetchError(500, "Internal Server Error")
    await deliverDiscordWebhook(1, WEBHOOK_URL, EMBEDS)
    await deliverDiscordWebhook(1, WEBHOOK_URL, EMBEDS)

    expect(getCircuitState(1).failures).toBe(2)
    expect(getCircuitState(2).failures).toBe(0)
  })

  it("resetCircuitBreaker clears state for one target only", async () => {
    mockFetchError(500, "Internal Server Error")
    await deliverDiscordWebhook(1, WEBHOOK_URL, EMBEDS)
    await deliverDiscordWebhook(2, WEBHOOK_URL, EMBEDS)

    resetCircuitBreaker(1)
    expect(getCircuitState(1).failures).toBe(0)
    expect(getCircuitState(2).failures).toBe(1)
  })
})
