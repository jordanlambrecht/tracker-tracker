// src/data/trackers/hawkeuno.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const hawkeuno: TrackerRegistryEntry = {
  slug: "hawkeuno",
  name: "HAWKE-UNO",
  abbreviation: "HU",
  url: "https://hawke.uno",
  description:
    "General private tracker powered by UNIT3D. Unsupported — no users API endpoint available.",
  platform: "unit3d",
  apiPath: "/api/user",
  specialty: "General",
  contentCategories: ["Movies", "TV", "Music", "Games", "Apps"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  stats: {
    userCount: undefined,
    torrentCount: undefined,
  },
  language: "English",
  color: "#ef4444",
  logo: "/tracker-logos/hawkeuno_logo.svg",
  trackerHubSlug: "hawke-uno",
  draft: true,
}
