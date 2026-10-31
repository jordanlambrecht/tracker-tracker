// src/data/trackers/hdbits.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const hdbits: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "hdbits",
  name: "HDBits",
  abbreviation: "HDB",
  url: "https://hdbits.org",
  description:
    "HD tracker and the internal release site for a large number of encoders, including many of the top groups. Also has a large collection of full discs.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "custom",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "HD Movies / TV",
  contentCategories: ["Movies", "TV"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#ffd700",
  logo: "/tracker-logos/hdbits_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "hd-bits",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0,
    seedTimeHours: 0,
    loginIntervalDays: 0,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: true,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
