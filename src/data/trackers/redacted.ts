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
  // RED expects a bare `Authorization: <key>` with no `token ` prefix.
  // Sending the prefix returns 401.
  gazelleAuthStyle: "raw",
  gazelleEnrich: true,
  apiPath: "/ajax.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Music",
  contentCategories: ["Music", "Apps"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#f44336",
  logo: "/tracker-logos/redacted_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "redacted",
  statusPageUrl: "https://red.trackerstatus.info/",

  // ── Community ───────────────────────────────────────────────────────
  // wiki.php?action=article&name=classes (r27). Counts are torrents uploaded,
  // not seeding, and every earned class demotes to User below ratio 0.60.
  // Secondary classes (FLS, Interviewer, TC, PT) are not primary classes and
  // never come back as `class` from the API.
  userClasses: [
    { name: "User", requirements: "Default class on registration" },
    {
      name: "Member",
      requirements: "1 week, 10 GB up, ratio above 0.65. 25 Merit Tokens on first promotion",
    },
    {
      name: "Power User",
      requirements: "2 weeks, 5 uploads, 25 GB up, ratio above 0.65. Invites, personal collage",
    },
    {
      name: "Elite",
      requirements: "4 weeks, 50 uploads, 100 GB up, ratio above 0.65. Torrent editing",
    },
    {
      name: "Torrent Master",
      requirements:
        "8 weeks, 500 uploads, 500 GB up, ratio above 0.65. Custom title, unlimited invites",
    },
    {
      name: "Power TM",
      requirements: "8 weeks, 500 GB up, ratio above 0.65, uploads in 500 unique groups",
    },
    {
      name: "Elite TM",
      requirements:
        "8 weeks, 500 GB up, ratio above 0.65, 500 perfect FLAC uploads, Power TM criteria",
    },
    {
      name: "VIP",
      requirements: "Staff-granted. VIP forum, custom title, unlimited invites",
      outsideLadder: "above",
    },
    { name: "Legend", requirements: "Former staff", outsideLadder: "above" },
    { name: "Forum Moderator", requirements: "Staff", outsideLadder: "above" },
    { name: "Moderator", requirements: "Staff", outsideLadder: "above" },
    { name: "Senior Moderator", requirements: "Staff", outsideLadder: "above" },
    { name: "Developer", requirements: "Staff", outsideLadder: "above" },
    { name: "Administrator", requirements: "Staff", outsideLadder: "above" },
    { name: "Sysop", requirements: "Staff", outsideLadder: "above" },
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
