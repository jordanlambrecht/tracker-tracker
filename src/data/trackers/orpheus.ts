// src/data/trackers/orpheus.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const orpheus: TrackerRegistryEntry = {
  slug: "orpheus",
  name: "Orpheus",
  abbreviation: "OPS",
  url: "https://orpheus.network",
  description:
    "Very similar to RED, both based on What.CD's model. Less content but a BP system that leads to easier ratio. Same interview process with shorter wait times.",
  platform: "gazelle",
  apiPath: "/ajax.php",
  specialty: "Music",
  contentCategories: ["Music"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  color: "#1daf8b",
  logo: "/tracker-logos/orpheus_logo.png",
  rules: {
    minimumRatio: 0.6,
    seedTimeHours: 72,
    loginIntervalDays: 120,
  },
}
