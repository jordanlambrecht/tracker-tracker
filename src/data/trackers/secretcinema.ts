// src/data/trackers/secretcinema.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const secretcinema: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "secretcinema",
  name: "Secret Cinema",
  abbreviation: "SC",
  url: "https://secret-cinema.pw",
  description:
    "Focused on obscure and arthouse content, overlapping a lot with KG but much easier to join.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "custom",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Arthouse / Obscure",
  contentCategories: ["Movies"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#8e44ad",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "secret-cinema",
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
