// src/data/trackers/passthepopcorn.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const passthepopcorn: TrackerRegistryEntry = {
  slug: "passthepopcorn",
  name: "PassThePopcorn",
  abbreviation: "PTP",
  url: "https://passthepopcorn.me",
  description:
    "The premier movie tracker. Huge selection of both popular and niche content with an active community that should satisfy any movie fan.",
  platform: "gazelle",
  apiPath: "/ajax.php",
  specialty: "Movies",
  contentCategories: ["Movies"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  color: "#f1c40f",
  trackerHubSlug: "pass-the-popcorn",
  statusPageUrl: "https://ptp.trackerstatus.info/",
  warning: true,
  warningNote: "Unvalidated",
  rules: {
    minimumRatio: 0,
    seedTimeHours: 48,
    loginIntervalDays: 90,
  },
  draft: false,
}
