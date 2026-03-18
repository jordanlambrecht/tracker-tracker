// src/lib/client-ip.ts
import { isIP } from "node:net"

export function extractClientIp(headers: Headers): string {
  const cfIp = headers.get("cf-connecting-ip")
  if (cfIp && isIP(cfIp)) return cfIp

  const xff = headers.get("x-forwarded-for")
  if (xff) {
    const rightmost = xff.split(",").pop()?.trim()
    if (rightmost && isIP(rightmost)) return rightmost
  }

  return "unknown"
}
