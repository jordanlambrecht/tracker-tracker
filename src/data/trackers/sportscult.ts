// src/data/trackers/sportscult.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const sportscult: TrackerRegistryEntry = {
  slug: "sportscult",
  name: "Sportscult",
  abbreviation: "SCult",
  url: "https://sportscult.eu",
  description: "Private tracker with semi-frequent signups for most sports.",
  platform: "custom",
  apiPath: "/api/user",
  specialty: "Sports",
  contentCategories: ["Sports"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  color: "#ff5722",
  draft: true,
}
