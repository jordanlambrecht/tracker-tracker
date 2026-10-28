// src/data/platform-types.ts

export const VALID_PLATFORM_TYPES = [
  "unit3d",
  "gazelle",
  "ggn",
  "nebulance",
  "mam",
  "avistaz",
  "digitalcore",
  "filelist",
  "custom",
  "btn",
  "iptorrents",
  "torrentleech",
  "hawke",
  "retrotoon",
  "tr4ker",
  "c411",
  "animebytes",
  "luminance",
] as const
export type PlatformType = (typeof VALID_PLATFORM_TYPES)[number]

export const MAM_BONUS_CAP = 99999

export const DEFAULT_API_PATHS: Record<string, string> = {
  unit3d: "/api/user",
  gazelle: "/ajax.php",
  ggn: "/api.php",
  nebulance: "/api.php",
  mam: "/jsonLoad.php",
  avistaz: "/profile",
  digitalcore: "/api/v1/status",
  filelist: "/userdetails.php",
  btn: "/",
  iptorrents: "/profile",
  torrentleech: "/profile",
  hawke: "/api/profile",
  retrotoon: "/userdetails.php",
  tr4ker: "/api/me",
  c411: "/api/user/profile",
  animebytes: "/api/stats/personal",
  luminance: "/user.php",
}

/**
 * How a platform expects its credential to be presented. These live with the
 * platform vocabulary rather than with the adapters because a registry entry
 * sets them and buildFetchOptions passes them through; src/data must not need
 * to import from src/lib to describe its own rows.
 */
export type GazelleAuthStyle = "token" | "raw"
export type Unit3dAuthStyle = "bearer" | "query"
export type NebulanceAuthParam = "api_key" | "apikey"
