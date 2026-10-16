// src/lib/tunnel.ts
//
// Functions: buildProxyUrl, createProxyAgent, decodeBody, proxyFetch,
//            buildProxyAgentFromSettings
// Exports: VALID_PROXY_TYPES, PROXY_HOST_PATTERN, ProxyType, ProxyConfig, ProxyFetchResult, ProxySettings

import type { Agent as HttpAgent, IncomingHttpHeaders } from "node:http"
import https from "node:https"
import zlib from "node:zlib"
import { HttpsProxyAgent } from "https-proxy-agent"
import { SocksProxyAgent } from "socks-proxy-agent"

import { decrypt } from "@/lib/crypto"
import { PROXY_DECODED_MAX_BYTES } from "@/lib/limits"
import { log } from "@/lib/logger"

export type ProxyType = "socks5" | "http" | "https"

export interface ProxyConfig {
  type: ProxyType
  host: string
  port: number
  username?: string | null
  password?: string | null
}

export const VALID_PROXY_TYPES = new Set<string>(["socks5", "http", "https"])

// Shared hostname validation: alphanumeric, dots, hyphens, colons/brackets (IPv6)
export const PROXY_HOST_PATTERN = /^[\w.\-:[\]]+$/

export function buildProxyUrl(config: ProxyConfig): string {
  if (!VALID_PROXY_TYPES.has(config.type)) {
    throw new Error(`Invalid proxy type: ${config.type}`)
  }

  const scheme = config.type === "socks5" ? "socks5" : config.type
  const auth =
    config.username && config.password
      ? `${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}@`
      : config.username
        ? `${encodeURIComponent(config.username)}@`
        : ""

  return `${scheme}://${auth}${config.host}:${config.port}`
}

export function createProxyAgent(config: ProxyConfig): HttpAgent {
  const url = buildProxyUrl(config)
  if (config.type === "socks5") {
    return new SocksProxyAgent(url)
  }
  return new HttpsProxyAgent(url)
}

/**
 * Decodes a Content-Encoding that node did not.
 *
 * `fetch()` negotiates and unwraps compression on its own; https.request does
 * neither, and it hands the caller the compressed bytes with no error. A server
 * may compress a response it was never asked to compress (IPTorrents returns
 * gzip to a request carrying no Accept-Encoding at all), so the proxied path
 * parsed `1f 8b …` as HTML and reported the page as unrecognizable. Every
 * failure this produces is a content failure, which is the wrong place to look.
 *
 * Output is capped while inflating, not measured afterwards: a small compressed
 * body can expand to gigabytes, and checking the length of the result would
 * already have allocated it. zlib stops at maxOutput and throws.
 */
export function decodeBody(
  raw: Buffer,
  encoding: string | string[] | undefined,
  maxOutput: number = PROXY_DECODED_MAX_BYTES
): Buffer {
  const header = Array.isArray(encoding) ? encoding[0] : encoding
  const enc = header?.trim().toLowerCase()
  if (!enc || enc === "identity") return raw

  const limits = { maxOutputLength: maxOutput }
  try {
    if (enc === "gzip" || enc === "x-gzip") return zlib.gunzipSync(raw, limits)
    // A "deflate" body is zlib-wrapped per the RFC and bare in the wild, and
    // which one arrived is only discoverable by trying.
    if (enc === "deflate") {
      try {
        return zlib.inflateSync(raw, limits)
      } catch {
        return zlib.inflateRawSync(raw, limits)
      }
    }
    if (enc === "br") return zlib.brotliDecompressSync(raw, limits)
  } catch (err) {
    throw new Error(`Could not decode ${enc} response: ${(err as Error).message}`)
  }

  // An encoding nothing here understands. Returning the bytes would hand the
  // caller something that only looks like a parse failure.
  throw new Error(`Unsupported Content-Encoding: ${enc}`)
}

export interface ProxyFetchResult {
  ok: boolean
  status: number
  statusText: string
  /**
   * Raw response headers. Present because a login POST is only useful if the
   * caller can read the Set-Cookie it came for. Without this, an adapter that
   * authenticates has no way to go through the proxy and must fall back to a
   * direct fetch, which defeats the point of configuring one.
   */
  headers: IncomingHttpHeaders
  json: () => Promise<unknown>
  text: () => Promise<string>
  buffer: () => Promise<Buffer>
}

export function proxyFetch(
  url: string,
  agent: HttpAgent,
  options: {
    timeoutMs?: number
    headers?: Record<string, string>
    maxBytes?: number
    method?: "GET" | "POST"
    body?: string
  } = {}
): Promise<ProxyFetchResult> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:") {
      reject(new Error("proxyFetch only supports HTTPS URLs"))
      return
    }
    const timeoutMs = options.timeoutMs ?? 15000
    const maxBytes = options.maxBytes ?? 0
    const method = options.method ?? "GET"
    const body = method === "POST" ? (options.body ?? "") : undefined

    // The request's own timeout option only arms once a socket is assigned,
    // and a proxy agent withholds the socket until its CONNECT reply arrives,
    // so a proxy that accepts the TCP connection and never answers would hold
    // the request open forever. This timer bounds the whole request instead.
    // It rejects directly: req.destroy(err) only emits the error once a socket
    // exists, which is exactly what never happens here.
    let settled = false
    let deadline: NodeJS.Timeout | undefined
    const done = (result: ProxyFetchResult) => {
      if (settled) return
      settled = true
      clearTimeout(deadline)
      resolve(result)
    }
    const fail = (err: Error) => {
      if (settled) return
      settled = true
      clearTimeout(deadline)
      reject(err)
    }
    deadline = setTimeout(() => {
      fail(new Error(`Request timed out after ${timeoutMs}ms`))
      req.destroy()
    }, timeoutMs)

    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method,
        agent,
        // No default User-Agent here on purpose. This is transport; which UA
        // to send is the caller's policy. adapterRequest sets one for the JSON
        // APIs, the scraping adapters send the exact UA their session cookie
        // was issued to, and TorrentLeech deliberately sends none.
        headers: {
          Accept: "application/json",
          ...(body === undefined
            ? {}
            : { "Content-Length": String(Buffer.byteLength(body, "utf8")) }),
          ...options.headers,
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = []
        let totalBytes = 0
        res.on("data", (chunk: Buffer) => {
          totalBytes += chunk.length
          if (maxBytes > 0 && totalBytes > maxBytes) {
            req.destroy()
            fail(new Error(`Response exceeded ${maxBytes} byte limit`))
            return
          }
          chunks.push(chunk)
        })
        res.on("end", () => {
          let raw: Buffer
          try {
            raw = decodeBody(
              Buffer.concat(chunks),
              res.headers["content-encoding"],
              maxBytes > 0 ? maxBytes : PROXY_DECODED_MAX_BYTES
            )
          } catch (err) {
            fail(err as Error)
            return
          }
          done({
            ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
            status: res.statusCode ?? 0,
            statusText: res.statusMessage ?? "",
            headers: res.headers,
            // security-audit-ignore: async wrapper converts JSON.parse throw to rejected promise. Caller handles via await/catch
            json: async () => JSON.parse(raw.toString("utf8")),
            text: () => Promise.resolve(raw.toString("utf8")),
            buffer: () => Promise.resolve(raw),
          })
        })
      }
    )

    req.on("timeout", () => {
      req.destroy()
      fail(new Error(`Request timed out after ${timeoutMs}ms`))
    })

    req.on("error", (err) => {
      fail(err)
    })

    if (body !== undefined) req.write(body)
    req.end()
  })
}

export interface ProxySettings {
  proxyEnabled: boolean
  proxyType: string
  proxyHost: string | null
  proxyPort: number | null
  proxyUsername: string | null
  encryptedProxyPassword: string | null
}

export function buildProxyAgentFromSettings(
  settings: ProxySettings,
  encryptionKey: Buffer
): HttpAgent | undefined {
  if (!settings.proxyEnabled || !settings.proxyHost) return undefined

  if (!VALID_PROXY_TYPES.has(settings.proxyType)) {
    log.error(`Invalid proxy type in settings: "${settings.proxyType}", skipping proxy`)
    return undefined
  }

  let password: string | null = null
  if (settings.encryptedProxyPassword) {
    try {
      password = decrypt(settings.encryptedProxyPassword, encryptionKey)
    } catch {
      log.error("Failed to decrypt proxy password, proceeding without auth")
    }
  }

  const config: ProxyConfig = {
    type: settings.proxyType as ProxyType,
    host: settings.proxyHost,
    port: settings.proxyPort ?? 1080,
    username: settings.proxyUsername,
    password,
  }

  try {
    return createProxyAgent(config)
  } catch (_err) {
    log.error("Failed to create proxy agent (check proxy host/port configuration)")
    return undefined
  }
}
