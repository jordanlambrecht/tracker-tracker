// src/data/trackers/anthelion.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const anthelion: TrackerRegistryEntry = {
  slug: "anthelion",
  name: "Anthelion",
  abbreviation: "ANT",
  url: "https://anthelion.me",
  description:
    "General movie tracker featuring a Gazelle-based UI. Lacking in content compared to PTP but growing at a fast rate. Sister site of the TV tracker NBL.",
  platform: "gazelle",
  apiPath: "/ajax.php",
  specialty: "Movies",
  contentCategories: ["Movies"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  color: "#1abc9c",
  rules: {
    minimumRatio: 0.6,
    seedTimeHours: 72,
    loginIntervalDays: 90,
  },
}
