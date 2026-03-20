// src/lib/notifications/deliver.ts
//
// Functions: getCircuits, getCircuitState, resetCircuitBreaker, isCircuitOpen, recordFailure, recordSuccess, deliverDiscordWebhook

import { sanitizeNetworkError } from "@/lib/error-utils"
import { log } from "@/lib/logger"

interface CircuitState {
  failures: number
  openUntil: Date | null
}

// HMR-safe circuit breaker state — one per notification target
const CIRCUIT_KEY = "__notificationCircuitBreakers"
function getCircuits(): Map<number, CircuitState> {
  const g = globalThis as Record<string, unknown>
  if (!g[CIRCUIT_KEY]) g[CIRCUIT_KEY] = new Map<number, CircuitState>()
  return g[CIRCUIT_KEY] as Map<number, CircuitState>
}

const MAX_FAILURES = 3
const DEFAULT_COOLDOWN_MS = 60_000

export function getCircuitState(targetId: number): CircuitState {
  return getCircuits().get(targetId) ?? { failures: 0, openUntil: null }
}

export function resetCircuitBreaker(targetId: number): void {
  getCircuits().delete(targetId)
}

function isCircuitOpen(targetId: number): boolean {
  const state = getCircuitState(targetId)
  if (!state.openUntil) return false
  if (new Date() > state.openUntil) {
    resetCircuitBreaker(targetId)
    return false
  }
  return true
}

function recordFailure(targetId: number, retryAfterMs?: number): void {
  const circuits = getCircuits()
  const state = circuits.get(targetId) ?? { failures: 0, openUntil: null }
  state.failures++
  if (state.failures >= MAX_FAILURES) {
    const cooldown = retryAfterMs ?? DEFAULT_COOLDOWN_MS
    state.openUntil = new Date(Date.now() + cooldown)
    log.warn(`Notification circuit breaker opened for target ${targetId} — ${cooldown}ms cooldown`)
  }
  circuits.set(targetId, state)
}

function recordSuccess(targetId: number): void {
  resetCircuitBreaker(targetId)
}

export interface DeliveryResult {
  success: boolean
  status: "delivered" | "failed" | "rate_limited"
  error?: string
}

export async function deliverDiscordWebhook(
  targetId: number,
  webhookUrl: string,
  embeds: Record<string, unknown>[]
): Promise<DeliveryResult> {
  if (isCircuitOpen(targetId)) {
    return { success: false, status: "failed", error: "Circuit breaker open — skipping delivery" }
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds }),
      signal: AbortSignal.timeout(5_000),
      redirect: "error",
    })

    if (res.ok) {
      recordSuccess(targetId)
      return { success: true, status: "delivered" }
    }

    if (res.status === 429) {
      const rawRetryAfter = Number(res.headers.get("Retry-After") ?? "60")
      const retryAfter = Math.min(
        Number.isFinite(rawRetryAfter) ? rawRetryAfter * 1000 : 60_000,
        300_000
      ) // cap at 5 min
      recordFailure(targetId, retryAfter)
      log.warn(`Discord rate limit for target ${targetId} — retry after ${retryAfter}ms`)
      return { success: false, status: "rate_limited", error: "Rate limited by Discord" }
    }

    const raw = `Webhook API error: ${res.status} ${res.statusText}`
    log.error(`Notification delivery failed for target ${targetId}: ${raw}`)
    recordFailure(targetId)
    return { success: false, status: "failed", error: sanitizeNetworkError(raw, "Delivery failed") }
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Unknown error"
    log.error(`Notification delivery failed for target ${targetId}: ${raw}`)
    recordFailure(targetId)
    return { success: false, status: "failed", error: sanitizeNetworkError(raw, "Delivery failed") }
  }
}
