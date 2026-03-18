// src/data/trackers/privatehd.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const privatehd: TrackerRegistryEntry = {
  slug: "privatehd",
  name: "PrivateHD",
  abbreviation: "PHD",
  url: "https://privatehd.to",
  description: "Former home of EPSiLON. Part of the PrivateHD network.",
  platform: "custom",
  apiPath: "/api/user",
  specialty: "HD Movies / TV",
  contentCategories: ["Movies", "TV"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  color: "#5c6bc0",
  trackerHubSlug: "private-hd",
  draft: true,
}
