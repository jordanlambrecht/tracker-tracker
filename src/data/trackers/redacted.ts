// src/data/trackers/redacted.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const redacted: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "redacted",
  name: "REDacted",
  abbreviation: "RED",
  url: "https://redacted.sh",
  description:
    "The largest general music tracker (also has some software). Has an interview to join, although the wait can be notoriously long.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "gazelle",
  gazelleAuthStyle: "token",
  gazelleEnrich: true,
  apiPath: "/ajax.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Music",
  contentCategories: ["Music", "Apps"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#f44336",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "redacted",
  statusPageUrl: "https://red.trackerstatus.info/",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    { name: "User", requirements: "Default class on registration" },
    { name: "Member", requirements: "1 week, 25 GB up, 0.65 ratio" },
    { name: "Power User", requirements: "2 weeks, 25 GB up, 0.65 ratio, 5 torrents seeding" },
    { name: "Elite", requirements: "4 weeks, 100 GB up, 1.0 ratio, 50 torrents seeding" },
    { name: "Torrent Master", requirements: "8 weeks, 500 GB up, 1.0 ratio, 500 torrents seeding" },
    { name: "Power Elite", requirements: "12 weeks, 1 TB up, 1.0 ratio, 750 torrents seeding" },
    { name: "VIP", requirements: "24 weeks, 2.5 TB up, 1.0 ratio, 1000 torrents seeding" },
    { name: "Legend", requirements: "48 weeks, 5 TB up, 1.0 ratio, 1500 torrents seeding" },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.6,
    seedTimeHours: 72,
    loginIntervalDays: 120,
    fullRulesMarkdown: [
      "## Ratio Requirements",
      "",
      "| Amount Downloaded | Required Ratio |",
      "|---|---|",
      "| 0-5 GB | 0.00 |",
      "| 5-10 GB | 0.15 |",
      "| 10-20 GB | 0.20 |",
      "| 20-30 GB | 0.30 |",
      "| 30-40 GB | 0.35 |",
      "| 40-50 GB | 0.40 |",
      "| 50-60 GB | 0.45 |",
      "| 60-80 GB | 0.50 |",
      "| 80-100 GB | 0.60 |",
      "| 100+ GB | 0.60 |",
      "",
      "## Seeding Rules",
      "",
      "- Torrents must be seeded for **72 hours** after snatching.",
      "- You may be put on ratio watch if your ratio drops below the required level for your download amount.",
      "- Ratio watch lasts **2 weeks**. If you don't improve your ratio within that time, your leeching privileges will be suspended.",
      "",
      "## Account Activity",
      "",
      "- Accounts inactive for **120 days** (no login) will be disabled.",
      "- Disabled accounts can be re-enabled by logging into the site (if within the pruning window) or by contacting staff via IRC.",
      "",
      "## FL Tokens",
      "",
      "- Freeleech tokens let you download a torrent without it counting against your download stats.",
      "- Tokens can be earned through various means including uploads, bounties, and bonus points.",
      "",
      "## Merit Tokens",
      "",
      "- Merit tokens can be used to highlight or recommend releases.",
      "- Earned through community contributions.",
    ],
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: true,
  profileUrlPattern: "/user.php?id={id}",
}
