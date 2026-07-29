// src/data/trackers/iptorrents.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const iptorrents: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "iptorrents",
  name: "IPTorrents",
  abbreviation: "IPT",
  url: "https://iptorrents.com",
  description:
    "General tracker with a controversial reputation. Extremely large userbase. Content quality can be inconsistent.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "iptorrents",
  apiPath: "/profile",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: ["Movies", "TV", "Games", "Music", "Apps", "Books"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#e74c3c",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 1.0,
    seedTimeHours: 336,
    loginIntervalDays: 0,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "/u/{id}",
}
