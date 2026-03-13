// src/lib/network.ts
//
// Functions: toIpv4Integer, isPrivateIpv4Literal, normalizeShorthandIpv4, isUnsafeIpv6Literal, isUnsafeNetworkHost

import { isIP } from "node:net"

function toIpv4Integer(host: string): number | null {
  const parts = host.split(".")
  if (parts.length !== 4) return null

  let value = 0
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null
    const octet = Number.parseInt(part, 10)
    if (octet < 0 || octet > 255) return null
    value = (value << 8) | octet
  }

  return value >>> 0
}

function isPrivateIpv4Literal(host: string): boolean {
  const ipv4 = toIpv4Integer(host)
  if (ipv4 === null) return false

  const matches = (mask: number, value: number) => ((ipv4 & mask) >>> 0) === (value >>> 0)

  return (
    matches(0xff000000, 0x0a000000) ||
    matches(0xff000000, 0x7f000000) ||
    matches(0xffff0000, 0xa9fe0000) ||
    matches(0xfff00000, 0xac100000) ||
    matches(0xffff0000, 0xc0a80000) ||
    matches(0xffc00000, 0x64400000) ||
    matches(0xff000000, 0x00000000)
  )
}

function parseMappedIpv6ToIpv4(host: string): string | null {
  const mapped = host.toLowerCase()
  if (!mapped.startsWith("::ffff:")) return null

  const suffix = mapped.slice(7)
  if (!suffix) return null

  if (suffix.includes(".")) {
    return toIpv4Integer(suffix) === null ? null : suffix
  }

  if (/^[0-9a-f]{1,8}$/.test(suffix)) {
    const value = Number.parseInt(suffix, 16)
    if (!Number.isFinite(value) || value < 0 || value > 0xffffffff) return null
    return `${(value >>> 24) & 0xff}.${(value >>> 16) & 0xff}.${(value >>> 8) & 0xff}.${value & 0xff}`
  }

  const segments = suffix.split(":")
  if (segments.length !== 2) return null
  if (!segments.every((segment) => /^[0-9a-f]{1,4}$/.test(segment))) return null

  const high = Number.parseInt(segments[0], 16)
  const low = Number.parseInt(segments[1], 16)
  const value = ((high << 16) | low) >>> 0
  return `${(value >>> 24) & 0xff}.${(value >>> 16) & 0xff}.${(value >>> 8) & 0xff}.${value & 0xff}`
}

function isUnsafeIpv6Literal(host: string): boolean {
  const normalized = host.toLowerCase()
  if (normalized === "::" || normalized === "::1") return true
  const mappedIpv4 = parseMappedIpv6ToIpv4(normalized)
  if (mappedIpv4 !== null) {
    return isPrivateIpv4Literal(mappedIpv4)
  }

  return normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
}

function normalizeShorthandIpv4(host: string): string | null {
  const parts = host.split(".")
  if (parts.length < 1 || parts.length > 4) return null
  if (!parts.every((p) => /^\d+$/.test(p))) return null

  const nums = parts.map((p) => Number.parseInt(p, 10))
  let value: number

  switch (nums.length) {
    case 1:
      if (nums[0] > 0xffffffff) return null
      value = nums[0]
      break
    case 2:
      if (nums[0] > 255 || nums[1] > 0xffffff) return null
      value = (nums[0] << 24) | nums[1]
      break
    case 3:
      if (nums[0] > 255 || nums[1] > 255 || nums[2] > 0xffff) return null
      value = (nums[0] << 24) | (nums[1] << 16) | nums[2]
      break
    case 4:
      if (nums.some((n) => n > 255)) return null
      value = (nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]
      break
    default:
      return null
  }

  value = value >>> 0
  return `${(value >>> 24) & 0xff}.${(value >>> 16) & 0xff}.${(value >>> 8) & 0xff}.${value & 0xff}`
}

export function isUnsafeNetworkHost(host: string): boolean {
  const normalized = host
    .trim()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/\.+$/, "")
    .toLowerCase()

  if (!normalized) return true
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return true
  if (normalized === "ip6-localhost" || normalized.endsWith(".local")) return true

  const version = isIP(normalized)
  if (version === 4) return isPrivateIpv4Literal(normalized)
  if (version === 6) return isUnsafeIpv6Literal(normalized)

  // Handle shorthand IPv4 forms (e.g., "127.1", "127.0.1") that isIP() doesn't recognize
  const expanded = normalizeShorthandIpv4(normalized)
  if (expanded) return isPrivateIpv4Literal(expanded)

  return false
}