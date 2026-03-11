// src/data/trackers/greatposterwall.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const greatposterwall: TrackerRegistryEntry = {
  slug: "greatposterwall",
  name: "Great Poster Wall",
  abbreviation: "GPW",
  url: "https://greatposterwall.com",
  description:
    "A Chinese Gazelle-based tracker with movies and some TV.",
  platform: "gazelle",
  apiPath: "/ajax.php",
  specialty: "Movies",
  contentCategories: ["Movies", "TV"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "Chinese",
  color: "#c0392b",
  warning: true,
  warningNote: "Unvalidated",
  rules: {
    minimumRatio: 0.6,
    seedTimeHours: 72,
    loginIntervalDays: 90,
  },
}
