// src/data/trackers/cinemageddon.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const cinemageddon: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "cinemageddon",
  name: "Cinemageddon",
  abbreviation: "CG",
  url: "https://cinemageddon.net",
  description:
    "Focused around B movies and trashy movies. A niche archive for cult, exploitation, and obscure cinema.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "custom",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "B-Movies / Cult",
  contentCategories: ["Movies"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#d35400",
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
