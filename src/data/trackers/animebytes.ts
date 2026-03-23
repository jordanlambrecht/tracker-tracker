// src/data/trackers/animebytes.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const animebytes: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "animebytes",
  name: "AnimeBytes",
  abbreviation: "AB",
  url: "https://animebytes.tv",
  description:
    "Huge archive of anime with great retention. Organization isn't as good as many other top trackers.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "gazelle",
  gazelleEnrich: true,
  apiPath: "/ajax.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Anime",
  contentCategories: ["Anime", "Manga", "Music"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#ff7043",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "anime-bytes",
  statusPageUrl: "https://status.animebytes.tv/",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0,
    seedTimeHours: 72,
    loginIntervalDays: 90,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: true,
  warningNote: "Unvalidated",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: true,
  profileUrlPattern: "/user.php?id={id}",
}
