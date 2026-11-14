// src/data/trackers/generationfree.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const generationfree: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "generationfree",
  name: "Generation-Free",
  abbreviation: "GF",
  url: "https://generation-free.org",
  description:
    "French private general tracker for movies, TV, music, games, software and ebooks. Free to join with a limited number of spots, so inactive accounts are pruned quickly.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: ["Movies", "TV", "Music", "Games", "Apps", "Books", "Sports"],
  language: "French",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#e11d48",
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
    // Jackett's generationfree-api definition: global minimum ratio 0.5, torrents
    // seeded for 3 days regardless of ratio, and accounts inactive for 45 days are
    // deleted, all ranks included.
    minimumRatio: 0.5,
    seedTimeHours: 72,
    loginIntervalDays: 45,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: true,
  warningNote: "Unverified. Not tested against a live account.",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
