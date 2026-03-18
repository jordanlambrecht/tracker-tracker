// src/data/trackers/empornium.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const empornium: TrackerRegistryEntry = {
  slug: "empornium",
  name: "Empornium",
  abbreviation: "EMP",
  url: "https://empornium.is",
  description: "The top general porn tracker.",
  platform: "gazelle",
  apiPath: "/ajax.php",
  specialty: "Porn",
  contentCategories: ["XXX"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  color: "#ab47bc",
  trackerHubSlug: "empornium",
  warning: true,
  warningNote: "Unvalidated",
  rules: {
    minimumRatio: 0.4,
    seedTimeHours: 72,
    loginIntervalDays: 90,
  },
  draft: false,
}
