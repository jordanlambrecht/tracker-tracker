// src/data/trackers/animez.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const animez: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "animez",
  name: "AnimeZ",
  abbreviation: "AnZ",
  url: "https://animez.to",
  description:
    "Formerly AnimeTorrents. Part of the AvistaZ network, specializing in anime and manga content.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "avistaz",
  apiPath: "/profile",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Anime / Manga",
  contentCategories: ["Anime", "Manga"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#ff6f00",
  logo: "/tracker-logos/animez_logo.svg",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    { name: "Banned", requirements: "Violated site rules. Cannot access site" },
    {
      name: "Leech",
      requirements:
        "Ratio below 1.0 or demoted. 1 download/week, torrents 7+ days old only. No uploads",
    },
    {
      name: "Newbie",
      requirements:
        "New user, age ≥ 7 days, ratio ≥ 1.0. 5 downloads/day, torrents 7+ days old only",
    },
    {
      name: "Member",
      requirements: "Upload ≥ 5 GiB, ratio ≥ 1.0, age ≥ 7 days. 50 downloads/day, can upload",
    },
    {
      name: "Power User",
      requirements: "Strong upload history and consistent ratio. 50 downloads/day",
    },
    { name: "V.I.P.", requirements: "Donor, staff-promoted, or distinguished. 100 downloads/day" },
    {
      name: "Uploader",
      requirements:
        "Staff-promoted for quality and quantity of uploads. API and tag creation access",
    },
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
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "/profile/{username}",
}
