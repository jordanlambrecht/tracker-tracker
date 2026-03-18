// src/data/trackers/uhdbits.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const uhdbits: TrackerRegistryEntry = {
  slug: "uhdbits",
  name: "UHDBits",
  abbreviation: "UHD",
  url: "https://uhdbits.org",
  description:
    "Tracker focused on Ultra HD and 4K content. Known for high-quality UHD encodes, remuxes, and full disc releases.",
  platform: "custom",
  apiPath: "/api/user",
  specialty: "UHD / 4K Movies & TV",
  contentCategories: ["Movies", "TV"],
  color: "#06b6d4",
  language: "English",
  trackerHubSlug: "uhd-bits",
  rules: {
    minimumRatio: 0,
    seedTimeHours: 0,
    loginIntervalDays: 0,
  },
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  draft: true,
}
