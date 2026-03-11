// src/lib/proxy.ts
//
// Functions: buildProxyUrl, createProxyAgent, proxyFetch, buildProxyAgentFromSettings
// Exports: VALID_PROXY_TYPES, PROXY_HOST_PATTERN, ProxyType, ProxyConfig, ProxyFetchResult, ProxySettings

import type { Agent as HttpAgent } from "node:http"
import https from "node:https"
import { HttpsProxyAgent } from "https-proxy-agent"
import { SocksProxyAgent } from "socks-proxy-agent"

import { decrypt } from "@/lib/crypto"
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

// Shared hostname validation — alphanumeric, dots, hyphens, colons/brackets (IPv6)
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

export interface ProxyFetchResult {
  ok: boolean
  status: number
  statusText: string
  json: () => Promise<unknown>
  buffer: () => Promise<Buffer>
}

export function proxyFetch(
  url: string,
  agent: HttpAgent,
  options: { timeoutMs?: number; headers?: Record<string, string>; maxBytes?: number } = {}
): Promise<ProxyFetchResult> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:") {
      reject(new Error("proxyFetch only supports HTTPS URLs"))
      return
    }
    const timeoutMs = options.timeoutMs ?? 15000
    const maxBytes = options.maxBytes ?? 0

    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: "GET",
        agent,
        headers: {
          Accept: "application/json",
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
            reject(new Error(`Response exceeded ${maxBytes} byte limit`))
            return
          }
          chunks.push(chunk)
        })
        res.on("end", () => {
          const raw = Buffer.concat(chunks)
          resolve({
            ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
            status: res.statusCode ?? 0,
            statusText: res.statusMessage ?? "",
            json: () => Promise.resolve(JSON.parse(raw.toString("utf8"))),
            buffer: () => Promise.resolve(raw),
          })
        })
      }
    )

    req.on("timeout", () => {
      req.destroy()
      reject(new Error(`Request timed out after ${timeoutMs}ms`))
    })

    req.on("error", (err) => {
      reject(err)
    })

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

export function buildProxyAgentFromSettings(settings: ProxySettings, encryptionKey: Buffer): HttpAgent | undefined {
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
