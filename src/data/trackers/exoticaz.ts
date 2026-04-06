// src/data/trackers/exoticaz.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const exoticaz: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "exoticaz",
  name: "ExoticaZ",
  abbreviation: "ExZ",
  url: "https://exoticaz.to",
  description: "Mainly Asian porn but some western content. Part of the AvistaZ network.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "avistaz",
  apiPath: "/profile",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Asian Adult",
  contentCategories: ["XXX"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#ef5350",
  logo: "/tracker-logos/exoticaz_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "exoticaz",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    { name: "Banned", requirements: "Violated site rules" },
    { name: "Leech", requirements: "Ratio below 1.0. 1 download per 7 days, 1 week old+ only" },
    {
      name: "Newbie",
      requirements: "New user. 5 downloads/day, 1 week old+ only. No uploads or RSS",
    },
    { name: "Member", requirements: "5 GB upload, ratio >= 1.0, 7+ days. 50 downloads/day" },
    { name: "V.I.P.", requirements: "Donor/distinguished. 100 downloads/day" },
    { name: "Uploader", requirements: "Staff promoted. 200 downloads/day" },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 1,
    seedTimeHours: 72,
    loginIntervalDays: 60,
    fullRulesMarkdown: [
      "## General Rules",
      "- **One account per person per lifetime.** No additional accounts under any circumstances.",
      "- One account per IP address. Multiple accounts on same IP → all banned.",
      "- No cheating. Cheaters banned without notice.",
      "- Anti-lurking: Must upload or download within 30 days of account creation.",
      "- Must login at least once every **60 days** and download at least 1 torrent every **90 days**.",
      "- Account trading and bonus point trading between sites → ban.",
      "",
      "## Ratio",
      "- Must maintain an overall ratio of **1.0 or better**.",
      "- Maintain a minimum ratio of **0.5** per torrent where possible.",
      "- Frequent leeching, hit-and-run, or low ratio → disabled downloads or ban.",
      "",
      "## Hit & Run",
      "- **All torrents** must be seeded (including free/half-free). No exemptions for VIP/Staff.",
      "- **Under 50 GB:** 72 hours + 2 hours per GB downloaded.",
      "- **50 GB and over:** Complex logarithmic formula (larger torrents = diminishing time increase).",
      "- **Alternatively:** Seed until you reach 0.9 ratio on that torrent.",
      "- **Partial downloads (10%+ downloaded):** Must seed back 90% of what you downloaded, or seed for 60 days.",
      "- **Under 10% downloaded:** No H&R penalty — you can delete it.",
      "- H&R can be cleared with **bonus points** at 10 BP per hour of seeding time owed.",
      "- Re-downloaded torrents must be seeded again.",
      "",
      "## User Ranks",
      "- **Newbie:** New user. 5 downloads/day, 1 week old+ only. No uploads, no RSS.",
      "- **Member:** 5 GB upload + ratio >= 1.0 + 7 days. 50 downloads/day. Can upload and use RSS.",
      "- **V.I.P.:** Donor/distinguished. 100 downloads/day.",
      "- **Uploader:** Staff promoted. 200 downloads/day.",
      "- **Leech:** Ratio below 1.0. 1 download per 7 days, 1 week old+ only.",
      "",
      "## Allowed Clients",
      "- qBittorrent (preferred), Deluge, Transmission, rTorrent, uTorrent (2.2.1 or latest only).",
      "- No mobile clients. No cloud-based clients. No Azureus/BiglyBT.",
      "- qBittorrent: disable Anonymous Mode. Consider disabling Torrent Queuing for proper bonus points.",
    ],
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: true,
  warningNote:
    "Unverified! HTML structure assumed identical to AvistaZ but not tested against a live account.",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "/profile/{username}",
}
