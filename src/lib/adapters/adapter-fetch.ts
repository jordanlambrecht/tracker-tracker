// src/lib/adapters/adapter-fetch.ts

import { classifyFetchError } from "@/lib/error-utils"
import { ADAPTER_FETCH_TIMEOUT_MS } from "@/lib/limits"
import { proxyFetch } from "@/lib/tunnel"
import type { FetchOptions } from "./types"

async function adapterFetch<T>(
  url: string,
  hostname: string,
  options?: FetchOptions,
  headers?: Record<string, string>
): Promise<T> {
  const mergedHeaders = { Accept: "application/json", ...headers }

  if (options?.proxyAgent) {
    try {
      const result = await proxyFetch(url, options.proxyAgent, { headers: mergedHeaders })
      if (!result.ok) {
        throw new Error(`Tracker API error: ${result.status} ${result.statusText}`)
      }
      return (await result.json()) as T
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Tracker API error")) {
        throw err
      }
      if (err instanceof Error && err.message.includes("timed out")) {
        throw new Error(`Request to ${hostname} timed out (via proxy)`)
      }
      const detail = err instanceof Error ? err.message : "Unknown"
      throw new Error(`Failed to connect to ${hostname} via proxy: ${detail}`)
    }
  }

  let response: Response
  try {
    response = await fetch(url, {
      headers: mergedHeaders,
      signal: AbortSignal.timeout(ADAPTER_FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    throw classifyFetchError(err, hostname)
  }

  if (!response.ok) {
    throw new Error(`Tracker API error: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

export { adapterFetch }
