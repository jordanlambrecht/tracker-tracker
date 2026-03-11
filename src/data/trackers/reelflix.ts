// src/data/trackers/reelflix.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const reelflix: TrackerRegistryEntry = {
  slug: "reelflix",
  name: "Reelflix",
  abbreviation: "RF",
  url: "https://reelflix.xyz",
  description:
    "General movie and TV tracker with a focus on high-quality encodes and a streamlined browsing experience.",
  platform: "unit3d",
  apiPath: "/api/user",
  specialty: "Movies / TV",
  contentCategories: ["Movies", "TV"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  stats: {
    userCount: undefined,
    torrentCount: undefined,
  },
  language: "English",
  color: "#e50914",
  logo: "/tracker-logos/reelflix_logo.png",
  rules: {
    minimumRatio: 0.4,
    seedTimeHours: 72,
    loginIntervalDays: 90,
  },
}
