// src/data/trackers/seedpool.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const seedpool: TrackerRegistryEntry = {
  slug: "seedpool",
  name: "Seed Pool",
  abbreviation: "SP",
  url: "https://seedpool.org",
  description: "General private tracker.",
  platform: "custom",
  apiPath: "/api/user",
  specialty: "",
  contentCategories: [],
  color: "#22c55e",
  language: "English",
  statusPageUrl: "https://status.seedpool.org/",
  rules: {
    minimumRatio: 0,
    seedTimeHours: 0,
    loginIntervalDays: 0,
  },
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  draft: true,
}
