// src/lib/constants.ts
//
// Available: DOCS_URL, DOCS, DocsEntry

export const DOCS_URL = "https://jordanlambrecht.github.io/tracker-tracker"

export type DocsEntry = { href?: string; description?: string }

export const DOCS = {
  // Getting Started
  INSTALLATION: { href: `${DOCS_URL}/getting-started/installation/`, description: "How to install Tracker Tracker with Docker" },
  FIRST_SETUP: { href: `${DOCS_URL}/getting-started/first-setup/`, description: "Set your master password and add your first tracker" },
  DOCKER_CONFIG: { href: `${DOCS_URL}/getting-started/docker-config/`, description: "Environment variables, volumes, and reverse proxy setup" },

  // Trackers
  ADDING_A_TRACKER: { href: `${DOCS_URL}/trackers/adding-a-tracker/`, description: "How to add a tracker, find your API token, and see what stats are tracked" },

  // Features
  PROXIES: { href: `${DOCS_URL}/features/proxies/`, description: "Route tracker requests through a SOCKS5, HTTP, or HTTPS proxy" },
  TOTP: { href: `${DOCS_URL}/features/totp/`, description: "Two-factor authentication with backup codes" },
  BACKUPS: { href: `${DOCS_URL}/features/backups/`, description: "Export, restore, and schedule encrypted backups" },
  DOWNLOAD_CLIENTS: { href: `${DOCS_URL}/features/download-clients/`, description: "Connect qBittorrent to track torrents by tag" },
  TAG_GROUPS: { href: `${DOCS_URL}/features/tag-groups/`, description: "Bundle qBittorrent tags into groups for breakdown charts" },
  QBITMANAGE: { href: `${DOCS_URL}/features/qbitmanage/`, description: "Automate tag groups with qbitmanage status tags and share limits" },
  WEBHOOKS: { href: `${DOCS_URL}/features/webhooks/`, description: "Get alerts in Discord when something happens on your trackers" },

  // Reference
  SETTINGS: { href: `${DOCS_URL}/reference/settings/`, description: "Every app setting explained" },
  STATS_EXPLAINED: { href: `${DOCS_URL}/reference/stats-explained/`, description: "What each tracker stat means" },
  PLATFORM_DIFFERENCES: { href: `${DOCS_URL}/reference/platform-differences/`, description: "Field availability across UNIT3D, Gazelle, and GGn" },

  // Troubleshooting
  TRACKER_OFFLINE: { href: `${DOCS_URL}/troubleshooting/tracker-offline/`, description: "Tracker shows offline or polling is paused" },
  RATIO_NOT_UPDATING: { href: `${DOCS_URL}/troubleshooting/ratio-not-updating/`, description: "Ratio or stats appear stuck" },
  COMMON_ERRORS: { href: `${DOCS_URL}/troubleshooting/common-errors/`, description: "Error messages and what they mean" },
} as const satisfies Record<string, DocsEntry>
