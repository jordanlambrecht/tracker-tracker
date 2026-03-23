// src/data/trackers/tvvault.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const tvvault: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "tvvault",
  name: "TV-Vault",
  abbreviation: "TVV",
  url: "https://tv-vault.me",
  description:
    "Focusing on older TV. Does not allow any show that did not finish airing at least 5 years ago.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "custom",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Classic / Older TV",
  contentCategories: ["TV"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#795548",
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
