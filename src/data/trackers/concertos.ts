// src/data/trackers/concertos.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const concertos: TrackerRegistryEntry = {
  slug: "concertos",
  name: "Concertos",
  abbreviation: "CON",
  url: "https://concertos.live",
  description:
    "Private tracker focused on classical music and live concert recordings. Features a curated library of symphonic, chamber, and operatic works.",
  platform: "unit3d",
  apiPath: "/api/user",
  specialty: "Classical Music",
  contentCategories: ["Music"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  stats: {
    userCount: undefined,
    torrentCount: undefined,
  },
  language: "English",
  color: "#b0b8c4",
  logo: undefined,
  rules: {
    minimumRatio: 0.4,
    seedTimeHours: 72,
    loginIntervalDays: 90,
  },
  draft: false,
}
