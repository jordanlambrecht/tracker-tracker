// src/data/trackers/anthelion.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const anthelion: TrackerRegistryEntry = {
  slug: "anthelion",
  name: "Anthelion",
  abbreviation: "ANT",
  url: "https://anthelion.me",
  description:
    "General movie tracker featuring a Gazelle-based UI. Lacking in content compared to PTP but growing at a fast rate. Sister site of the TV tracker NBL.",
  platform: "nebulance",
  apiPath: "/api.php",
  specialty: "Movies",
  contentCategories: ["Movies"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  logo: "/tracker-logos/anthelion_logo.png",
  color: "#3eaca7",
  rules: {
    minimumRatio: 0.6,
    seedTimeHours: 72,
    loginIntervalDays: 90,
  },
}
