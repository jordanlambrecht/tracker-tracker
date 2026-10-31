// src/data/trackers/c411.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const c411: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "c411",
  name: "C411",
  abbreviation: "C411",
  url: "https://c411.org",
  description:
    "French private general tracker covering movies, TV, books, audio, PC and console games, and adult content. Invite-only.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "c411",
  apiPath: "/api/user/profile",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: ["Movies", "TV", "Music", "Games", "Apps", "Books", "XXX"],
  language: "French",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#e11d48",
  logo: "/tracker-logos/c411_logo.png",
  bonusName: "Zen",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  // The rank is the progression-tree grade. The class (Tanker, Swarm Keeper
  // and so on) is a yearly choice, not a rank, so it is not shown.
  userClasses: [
    { name: "Bronze I", requirements: "Starting grade of a class's tree" },
    { name: "Bronze II" },
    { name: "Bronze III", requirements: "20% of the tree" },
    { name: "Bronze IV" },
    { name: "Silver I" },
    { name: "Silver II" },
    { name: "Silver III", requirements: "60% of the tree" },
    { name: "Silver IV" },
    { name: "Gold I" },
    { name: "Gold II" },
    { name: "Gold III", requirements: "90% of the tree" },
    { name: "Gold 411", requirements: "The whole tree" },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  // Only the ratio gates downloads. C411's 72-hour H&R rule is switched off,
  // per its wiki, so no seed time is required today.
  rules: {
    minimumRatio: 0.8,
    seedTimeHours: 0,
    loginIntervalDays: 0,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
