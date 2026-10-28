// src/data/trackers/filelist.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const filelist: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "filelist",
  name: "FileList",
  abbreviation: "FL",
  url: "https://filelist.io",
  description:
    "General tracker with a huge amount of content including encodes from top groups such as HDB internals.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "filelist",
  apiPath: "/userdetails.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: [
    "Movies",
    "TV",
    "Music",
    "Games",
    "Apps",
    "Sports",
    "Anime",
    "Books",
    "Documentaries",
    "XXX",
  ],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#3498db",
  logo: "/tracker-logos/filelist_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",
  announceHosts: ["filelist.io", "thefl.org"],

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    { name: "User", requirements: "Starting class" },
    {
      name: "Power User",
      requirements: "4 weeks registered, 25 GB upload, ratio > 1.05. Demoted below 0.95",
    },
    {
      name: "Addict",
      requirements: "26 weeks registered, 500 GB upload, ratio > 4.00. Demoted below 3.00",
    },
    {
      name: "Elite",
      requirements: "4 years registered, 4 TB upload, ratio > 5.00. Demoted below 4.00",
    },
    {
      name: "VIP",
      requirements: "Awarded. Fixed minimum ratio 2, exempt from hit & run rules",
      outsideLadder: "above",
    },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  // rules.php §11 (Hit&Run): "torentele downloadate pot fi închise doar dacă
  // au ratie 1 sau timpul de seed pe torent este de 48 de ore … timp de 1
  // săptămână să realizați ratia 1 sau cele 48 de ore de seed". Per-torrent
  // ratio 1 or 48h seed time, one week to fulfil. VIP exempt.
  // FAQ: accounts are deleted after 1 year from last access (2 years parked).
  rules: {
    minimumRatio: 1, // per-torrent rule applied to the account ratio, so health reads critical below 1
    seedTimeHours: 48,
    loginIntervalDays: 365,
    satisfactionMode: "any",
    fulfillmentPeriodHours: 168,
    fullRulesMarkdown: [
      "## Hit & Run",
      "",
      "- Seed each torrent to ratio 1 or 48 hours of seed time",
      "- The requirement must be met within 1 week of finishing the download",
      "- You may stop after the first 3 hours, but must return and finish the seed time",
      "- A freeleech H&R gives a 2-week warning; repeated H&R can disable the account",
      "- VIP is exempt from H&R",
      "",
      "## Ratio & Downloads",
      "",
      "- Keep your client seeding after a download; a low ratio can disable the account",
      "- Account ratio below 1 is critical",
      "",
      "## Inactivity",
      "",
      "- Accounts are deleted after 1 year without login (2 years if parked)",
      "",
      "## Invites & Accounts",
      "",
      "- One account per person; multiple accounts are not allowed",
      "- Never sell, trade or give away accounts or invites",
      "- Invites were distributed once; more can be obtained by donation or from the shop",
      "- You are responsible for your invitees",
      "",
      "## Uploads & Requests",
      "",
      "- Do not upload FileList torrents to other trackers",
      "- Requests need a description and an IMDb, Steam, GOG or similar link",
      "- Requests for unreleased, XXX or cracked material are not allowed",
      "- Unfilled requests are deleted after 2 weeks",
      "",
      "## Security",
      "",
      "- Automated tools using RSS/API (Sonarr, Radarr, Prowlarr, Jackett, etc.) must be secured",
      "- An unsecured automated setup is a permanent disable",
      "",
      "## Conduct",
      "",
      "- No advertising, invite requests or personal information in comments, forum, PMs, avatar, signature or IRC",
      "- Comments are allowed in Romanian and English; no spoilers, spam or insults",
    ],
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
