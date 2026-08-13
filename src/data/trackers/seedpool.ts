// src/data/trackers/seedpool.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const seedpool: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "seedpool",
  name: "Seed Pool",
  abbreviation: "SP",
  url: "https://seedpool.org",
  description:
    "General private tracker with a focus on long term seeding and a welcoming community. Known for its active IRC.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "",
  contentCategories: [
    "Movies",
    "TV",
    "Music",
    "Games",
    "Apps",
    "Sports",
    "Education",
    "Audiobooks",
  ],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#22c55e",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "https://status.seedpool.org/",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    { name: "Cesspool", requirements: "Ratio below 1 — download privileges revoked" },
    { name: "KiddiePool", requirements: "Timeoutzone" },
    { name: "User", requirements: "Ratio ≥ 0.4 — DL Slots: ∞, Unsatisfied Slots: 20" },
    {
      name: "Pool",
      requirements:
        "Seedsize ≥ 256 GiB; Age ≥ 1 month — Can Request, Send Invite, Unsatisfied Slots: 30",
    },
    {
      name: "PowerPool",
      requirements: "Seedsize ≥ 512 GiB; Age ≥ 3 months — Can Fill Requests, Unsatisfied Slots: 50",
    },
    {
      name: "SuperPool",
      requirements:
        "Seedsize ≥ 1 TiB; Age ≥ 6 months — Invite Forums, Freeleech, Unsatisfied Slots: 75",
    },
    {
      name: "UberPool",
      requirements: "Seedsize ≥ 5 TiB; Age ≥ 9 months — Freeleech, Unsatisfied Slots: 100",
    },
    {
      name: "ProPool",
      requirements:
        "Can be bought or gifted with buffer in IRC — Freeleech, Double Upload, Unsatisfied Slots: 50",
    },
    {
      name: "MegaPool",
      requirements:
        "Seedsize ≥ 25 TiB; Age ≥ 12 months — Upload Torrents, Freeleech, Double Upload, Unsatisfied Slots: 125",
    },
    {
      name: "GodPool",
      requirements:
        "Seedsize ≥ 100 TiB; Age ≥ 12 months — Upload Torrents, Freeleech, Double Upload, Unsatisfied Slots: 150",
    },
    {
      name: "FoundingPool",
      requirements: "Staff — founding members of Seed Pool. Freeleech, Unsatisfied Slots: 75",
    },
    {
      name: "SpecialPool",
      requirements:
        "Staff — outstanding members. Upload Torrents, Freeleech, Double Upload, Torrent Mod bypass, Unsatisfied Slots: 100",
    },
    {
      name: "External",
      requirements:
        "Staff — recognized release groups and respected tracker staff. Upload Torrents, Freeleech, Torrent Mod bypass, Unsatisfied Slots: 100",
    },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 1,
    seedTimeHours: 240,
    loginIntervalDays: 0,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: true,
  profileUrlPattern: "/users/{username}",
}
