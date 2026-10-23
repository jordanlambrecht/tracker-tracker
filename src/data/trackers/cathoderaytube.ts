// src/data/trackers/cathoderaytube.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const cathoderaytube: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "cathoderaytube",
  name: "Cathode-Ray.Tube",
  abbreviation: "CRT",
  url: "https://www.cathode-ray.tube",
  description:
    "Niche tracker dedicated to classic and retro television content. Specializes in older TV series, public broadcasts, and hard-to-find vintage programming.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "luminance",
  apiPath: "/user.php",

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
  bonusName: "Credits",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    {
      name: "Nostalgic Newcomer",
      requirements:
        "Starting class. Needs torrent activity within 30 days of joining or the account is disabled",
    },
    { name: "Retro Rookie", requirements: "4 weeks, 100 GiB up, 1 forum post, ratio ≥ 1.0" },
    {
      name: "Classics Collector",
      requirements: "8 weeks, 1 TiB up, 10 forum posts, ratio ≥ 1.25",
    },
    {
      name: "Analog Ace",
      requirements: "16 weeks, 5 TiB up, 5 uploads, 20 forum posts, ratio ≥ 1.5",
    },
    {
      name: "Monochrome Master",
      requirements: "32 weeks, 15 TiB up, 15 uploads, 30 forum posts, ratio ≥ 2.0",
    },
    {
      name: "Vintage Virtuoso",
      requirements: "64 weeks, 25 TiB up, 25 uploads, 50 forum posts, ratio ≥ 2.5",
    },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 1.0,
    seedTimeHours: 0,
    loginIntervalDays: 120,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "/user.php?id={id}",
}
