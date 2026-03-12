// src/data/trackers/oldtoons.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const oldtoons: TrackerRegistryEntry = {
  slug: "oldtoons",
  name: "OldToons",
  abbreviation: "OT",
  url: "https://oldtoons.world",
  description:
    "Dedicated to classic animation and vintage cartoons. A niche tracker for fans of retro animated content from the golden age of animation.",
  platform: "unit3d",
  apiPath: "/api/user",
  specialty: "Classic Animation",
  contentCategories: ["TV"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  stats: {
    userCount: undefined,
    torrentCount: undefined,
  },
  language: "English",
  color: "#fbbf24",
  logo: undefined,
  rules: {
    minimumRatio: 0.4,
    seedTimeHours: 72,
    loginIntervalDays: 90,
  },
}
