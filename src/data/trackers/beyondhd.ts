// src/data/trackers/beyondhd.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const beyondhd: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "beyondhd",
  name: "BeyondHD",
  abbreviation: "BHD",
  url: "https://beyond-hd.me",
  description:
    "Well known for being the internal release site for the remux group FraMeSToR, as well as the new home of many former AHD internals. Untouched SD content allowed if no HD version exists.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "custom",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "HD Movies / TV",
  contentCategories: ["Movies", "TV"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#00897b",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "beyond-hd",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.4,
    seedTimeHours: 120,
    loginIntervalDays: 90,
    fulfillmentPeriodHours: 480,
    hnrBanLimit: 3,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: true,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
