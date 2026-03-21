// src/data/trackers/cathoderaytube.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const cathoderaytube: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "cathoderaytube",
  name: "Cathode-Ray.Tube",
  abbreviation: "CRT",
  url: "https://cathode-ray.tube",
  description:
    "Niche tracker dedicated to classic and retro television content. Specializes in older TV series, public broadcasts, and hard-to-find vintage programming.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Classic / Retro TV",
  contentCategories: ["TV"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#22d3ee",
  logo: "/tracker-logos/cathoderaytube_logo.png",

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
