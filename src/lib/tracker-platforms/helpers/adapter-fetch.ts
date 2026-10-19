// src/lib/tracker-platforms/helpers/adapter-fetch.ts
//
// Functions: readJson, adapterRequest, adapterFetch

import { classifyFetchError, classifyProxyFetchError } from "@/lib/error-utils"
import { ADAPTER_FETCH_TIMEOUT_MS } from "@/lib/limits"
import { proxyFetch } from "@/lib/tunnel"
import { withDefaultUserAgent } from "@/lib/user-agent"
import type { FetchOptions } from "../contract"

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
 * A SyntaxError means the tracker answered with something other than JSON, such
 * as a maintenance or challenge page, so it gets the shape wording
 * sanitizeNetworkError reads as an unexpected response, and not the parser's
 * message, which can quote the body. Anything else is the body read breaking,
 * which only the direct path can raise, and is classified like a failed fetch.
 */
async function readJson<T>(read: () => Promise<unknown>, hostname: string): Promise<T> {
  try {
    return (await read()) as T
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Unexpected response from ${hostname}: body was not JSON`)
    }
    throw classifyFetchError(err, hostname)
  }
}

/**
 * Every JSON tracker API request goes out through here. Picks proxied or direct
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
      throw classifyProxyFetchError(err, hostname)
    }

    return {
      ok: result.ok,
      status: result.status,
      statusText: result.statusText,
      json: <T>() => readJson<T>(() => result.json(), hostname),
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
    json: <T>() => readJson<T>(() => response.json(), hostname),
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
