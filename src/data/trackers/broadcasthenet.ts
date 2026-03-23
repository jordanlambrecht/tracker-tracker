// src/data/trackers/broadcasthenet.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const broadcasthenet: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "broadcasthenet",
  name: "BroadcasTheNet",
  abbreviation: "BTN",
  url: "https://broadcasthe.net",
  description:
    "The top TV tracker, featuring a huge library, well-known internal releasers, great retention, and no ratio requirements.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "gazelle",
  gazelleEnrich: true,
  apiPath: "/ajax.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "TV",
  contentCategories: ["TV"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#ff9800",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "broadcas-the-net",
  statusPageUrl: "https://btn.trackerstatus.info/",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0,
    seedTimeHours: 24,
    loginIntervalDays: 60,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: true,
  warningNote: "Unvalidated",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: true,
  profileUrlPattern: "/user.php?id={id}",
}
