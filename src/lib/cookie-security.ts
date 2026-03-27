// src/lib/cookie-security.ts

export function shouldSecureCookies(): boolean {
  if (process.env.SECURE_COOKIES === "true") return true
  if (process.env.BASE_URL?.toLowerCase().startsWith("https://")) return true
  return false
}
