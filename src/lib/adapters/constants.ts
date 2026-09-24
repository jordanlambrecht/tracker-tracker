// src/lib/adapters/constants.ts

export const VALID_PLATFORM_TYPES = [
  "unit3d",
  "gazelle",
  "ggn",
  "nebulance",
  "mam",
  "avistaz",
  "digitalcore",
  "custom",
  "btn",
  "iptorrents",
  "torrentleech",
  "hawke",
  "hdspace",
] as const
export type PlatformType = (typeof VALID_PLATFORM_TYPES)[number]

export const MAM_BONUS_CAP = 99999

/**
 * Platforms with no API whose adapters replay the user's browser session: a pasted
 * Cookie header (including Cloudflare's `cf_clearance`) plus the browser's
 * User-Agent, stored as a JSON credential blob. The add/edit dialogs render the
 * same cookie form for all of them.
 */
export const BROWSER_COOKIE_PLATFORMS: ReadonlySet<string> = new Set(["iptorrents", "hdspace"])

export function usesBrowserCookies(platform: string | null | undefined): boolean {
  return Boolean(platform && BROWSER_COOKIE_PLATFORMS.has(platform))
}

export const DEFAULT_API_PATHS: Record<string, string> = {
  unit3d: "/api/user",
  gazelle: "/ajax.php",
  ggn: "/api.php",
  nebulance: "/api.php",
  mam: "/jsonLoad.php",
  avistaz: "/profile",
  digitalcore: "/api/v1/status",
  btn: "/",
  iptorrents: "/profile",
  torrentleech: "/profile",
  hawke: "/api/profile",
  hdspace: "/index.php?page=usercp",
}
