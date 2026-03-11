// src/data/trackers/broadcasthenet.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const broadcasthenet: TrackerRegistryEntry = {
  slug: "broadcasthenet",
  name: "BroadcasTheNet",
  abbreviation: "BTN",
  url: "https://broadcasthe.net",
  description:
    "The top TV tracker, featuring a huge library, well-known internal releasers, great retention, and no ratio requirements.",
  platform: "gazelle",
  apiPath: "/ajax.php",
  specialty: "TV",
  contentCategories: ["TV"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  color: "#ff9800",
  warning: true,
  warningNote: "Unvalidated",
  rules: {
    minimumRatio: 0,
    seedTimeHours: 24,
    loginIntervalDays: 60,
  },
}
