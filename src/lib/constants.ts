// src/lib/constants.ts
//
// Available: DEFAULT_LOG_FILE, DOCS_URL, DOCS, DocsEntry, USE_PROXY_DESCRIPTION

export const DEFAULT_LOG_FILE = "/data/logs/tracker-tracker.log"
export const DEV_LOG_FILE = ".next/tracker-tracker.log"

export const DOCS_URL = "https://jordanlambrecht.github.io/tracker-tracker"

export type DocsEntry = { href?: string; description?: string }

export const DOCS = {
  // Trackers
  ADDING_A_TRACKER: { href: `${DOCS_URL}/trackers/adding-a-tracker/` },

  // Features
  PROXIES: { href: `${DOCS_URL}/features/proxies/` },
  FLARESOLVERR: { href: `${DOCS_URL}/reference/settings/#flaresolverr` },
  TOTP: { href: `${DOCS_URL}/reference/settings/#two-factor-authentication` },
  BACKUPS: { href: `${DOCS_URL}/features/backups/` },
  DOWNLOAD_CLIENTS: { href: `${DOCS_URL}/features/download-clients/` },
  PROWLARR: { href: `${DOCS_URL}/features/prowlarr/` },
  TAG_GROUPS: { href: `${DOCS_URL}/features/tag-groups/` },
  QBITMANAGE: { href: `${DOCS_URL}/features/qbitmanage/` },
  WEBHOOKS: { href: `${DOCS_URL}/features/webhooks/` },
  IMAGE_HOSTING: { href: `${DOCS_URL}/features/transit-papers/#image-host-setup` },
  TRANSIT_PAPERS: { href: `${DOCS_URL}/features/transit-papers/` },

  // Troubleshooting
  TRACKER_OFFLINE: { href: `${DOCS_URL}/troubleshooting/` },
} as const satisfies Record<string, DocsEntry>

// ─── Defaults ─────────────────────────────────────────────────────────────────
export const DEFAULT_TRACKER_COLOR = "#00d4ff"

// The Use proxy toggle's description while the proxy can be used, in Add Tracker
// and in the tracker settings sheet.
export const USE_PROXY_DESCRIPTION =
  "Route API requests for this tracker through the global proxy configured in Settings."
