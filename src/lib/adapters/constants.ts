// src/lib/adapters/constants.ts

export const VALID_PLATFORM_TYPES = ["unit3d", "gazelle", "ggn", "nebulance"] as const

export const DEFAULT_API_PATHS: Record<string, string> = {
  unit3d: "/api/user",
  gazelle: "/ajax.php",
  ggn: "/api.php",
  nebulance: "/api.php",
}
