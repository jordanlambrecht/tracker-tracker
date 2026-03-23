// src/data/trackers/morethantv.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const morethantv: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "morethantv",
  name: "MoreThanTV",
  abbreviation: "MTV",
  url: "https://morethantv.me",
  description:
    "Previously the runner-up TV tracker. Staff are still rebuilding the site and community so retention is not what it once was. Ratioless. Also tracks movies.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "gazelle",
  gazelleEnrich: true,
  apiPath: "/ajax.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "TV / Movies",
  contentCategories: ["TV", "Movies"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#27ae60",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "morethan-tv",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0,
    seedTimeHours: 24,
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
