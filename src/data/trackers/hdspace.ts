// src/data/trackers/hdspace.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const hdspace: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "hdspace",
  name: "HD-Space",
  abbreviation: "HDS",
  url: "https://hd-space.org",
  description:
    "Long-running HD movie and TV tracker (since 2009) on a customised xbtit codebase. Periodic open signups; no API — stats are read from the site's user panel with the browser's cookies (Cloudflare-challenged).",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "hdspace",
  apiPath: "/index.php?page=usercp",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "HD Movies & TV",
  contentCategories: ["Movies", "TV", "Music", "Anime", "Apps"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#1e6fb8",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  // The site's own class legend, in the order it lists them.
  userClasses: [
    { name: "Leecher", requirements: "Ratio below the site minimum" },
    { name: "Members", requirements: "Default class after signup" },
    { name: "HD Spacer" },
    { name: "HD Astronaut" },
    { name: "HD Alien" },
    { name: "HD Internal" },
    { name: "Uploader" },
    { name: "V.I.P." },
    { name: "Moderator" },
    { name: "Forum Moderator" },
    { name: "Administrator" },
    { name: "Owner" },
    { name: "Parked", requirements: "Account parked by the user" },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 1.0,
    seedTimeHours: 24,
    loginIntervalDays: 0,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "/index.php?page=usercp",
}
