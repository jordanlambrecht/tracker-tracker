// src/data/trackers/orpheus.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const orpheus: TrackerRegistryEntry = {
  slug: "orpheus",
  name: "Orpheus",
  abbreviation: "OPS",
  url: "https://orpheus.network",
  description:
    "One of the largest and most prestigious private music trackers, Orpheus is renowned for its extensive library of high-quality music releases, active community, and strict quality standards.",
  platform: "gazelle",
  gazelleEnrich: true,
  apiPath: "/ajax.php",
  specialty: "Music",
  contentCategories: ["Music"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  color: "#1daf8b",
  logo: "/tracker-logos/orpheus_logo.png",
  trackerHubSlug: "orpheus",
  statusPageUrl: "https://ops.trackerstatus.info/",
  rules: {
    minimumRatio: 0.6,
    seedTimeHours: 72,
    loginIntervalDays: 120,
  },
  draft: false,
  supportsTransitPapers: true,
  transitPaperFields: {
    warned: true,
    lastAccessDate: true,
    donor: true,
    joinedDate: "api",
    profileUrlPattern: "/user.php?id={id}",
  },
}
