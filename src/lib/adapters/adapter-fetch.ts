// src/lib/adapters/adapter-fetch.ts
//
// Functions: adapterRequest, adapterFetch

import { classifyFetchError } from "@/lib/error-utils"
import { ADAPTER_FETCH_TIMEOUT_MS } from "@/lib/limits"
import { proxyFetch } from "@/lib/tunnel"
import { withDefaultUserAgent } from "@/lib/user-agent"
import type { FetchOptions } from "./types"

/**
 * The proxied and direct transports normalized to one shape. proxyFetch
 * exposes buffer(), fetch exposes text(); callers should not care which ran.
 */
export interface AdapterResponse {
  ok: boolean
  status: number
  statusText: string
  json: <T>() => Promise<T>
  text: () => Promise<string>
}

/**
 * The single outbound seam for JSON tracker APIs. Picks the proxied or direct
 * transport, applies the default User-Agent and shared timeout, and classifies
 * connection failures.
 *
 * Returns a non-2xx rather than throwing, so an adapter whose API reports
 * errors in the body can read it. Use adapterFetch for the happy path.
 */
async function adapterRequest(
  url: string,
  hostname: string,
  options?: FetchOptions,
  headers?: Record<string, string>,
  init?: { method?: "GET" | "POST"; body?: string }
): Promise<AdapterResponse> {
  const mergedHeaders = withDefaultUserAgent({ Accept: "application/json", ...headers })
  const method = init?.method ?? "GET"
  const body = method === "POST" ? (init?.body ?? "") : undefined

  if (options?.proxyAgent) {
    let result: Awaited<ReturnType<typeof proxyFetch>>
    try {
      result = await proxyFetch(url, options.proxyAgent, {
        headers: mergedHeaders,
        method,
        body,
        // Explicit so both transports share one constant. proxyFetch defaults
        // to its own 15s, which only happens to match today.
        timeoutMs: ADAPTER_FETCH_TIMEOUT_MS,
      })
    } catch (err) {
      if (err instanceof Error && err.message.includes("timed out")) {
        throw new Error(`Request to ${hostname} timed out (via proxy)`)
      }
      const detail = err instanceof Error ? err.message : "Unknown"
      throw new Error(`Failed to connect to ${hostname} via proxy: ${detail}`)
    }

    return {
      ok: result.ok,
      status: result.status,
      statusText: result.statusText,
      json: <T>() => result.json() as Promise<T>,
      text: async () => (await result.buffer()).toString("utf8"),
    }
  }

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: mergedHeaders,
      ...(body === undefined ? {} : { body }),
      signal: AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    throw classifyFetchError(err, hostname)
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    json: <T>() => response.json() as Promise<T>,
    text: () => response.text(),
  }
}

/**
 * Fetches JSON and throws on any non-2xx. The common case.
 */
async function adapterFetch<T>(
  url: string,
  hostname: string,
  options?: FetchOptions,
  headers?: Record<string, string>,
  init?: { method?: "GET" | "POST"; body?: string }
): Promise<T> {
  const response = await adapterRequest(url, hostname, options, headers, init)

  if (!response.ok) {
    throw new Error(`Tracker API error: ${response.status} ${response.statusText}`)
  }

  return response.json<T>()
}

export { adapterFetch, adapterRequest }
