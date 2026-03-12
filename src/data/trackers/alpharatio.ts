// src/data/trackers/alpharatio.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const alpharatio: TrackerRegistryEntry = {
  slug: "alpharatio",
  name: "AlphaRatio",
  abbreviation: "AR",
  url: "https://alpharatio.cc",
  description:
    "General 0-day tracker focused on scene content. Excellent pretimes. Not the biggest content library.",
  platform: "gazelle",
  apiPath: "/ajax.php",
  specialty: "0-day / Scene",
  contentCategories: ["Movies", "TV", "Games", "Music", "Apps"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  color: "#9b59b6",
  warning: true,
  warningNote: "Unvalidated",
  rules: {
    minimumRatio: 0,
    seedTimeHours: 72,
    loginIntervalDays: 120,
  },
}
