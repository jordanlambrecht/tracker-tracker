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
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
