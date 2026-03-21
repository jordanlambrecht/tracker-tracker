// src/data/trackers/uhdbits.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const uhdbits: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "uhdbits",
  name: "UHDBits",
  abbreviation: "UHD",
  url: "https://uhdbits.org",
  description:
    "Tracker focused on Ultra HD and 4K content. Known for high-quality UHD encodes, remuxes, and full disc releases.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "custom",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "UHD / 4K Movies & TV",
  contentCategories: ["Movies", "TV"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#06b6d4",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "uhd-bits",
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
