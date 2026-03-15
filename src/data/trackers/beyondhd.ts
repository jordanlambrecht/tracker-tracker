// src/data/trackers/beyondhd.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const beyondhd: TrackerRegistryEntry = {
  slug: "beyondhd",
  name: "BeyondHD",
  abbreviation: "BHD",
  url: "https://beyond-hd.me",
  description:
    "Well known for being the internal release site for the remux group FraMeSToR, as well as the new home of many former AHD internals. Untouched SD content allowed if no HD version exists.",
  platform: "custom",
  apiPath: "/api/user",
  specialty: "HD Movies / TV",
  contentCategories: ["Movies", "TV"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  rules: {
    minimumRatio: 0.4,
    seedTimeHours: 120,
    loginIntervalDays: 90,
    fulfillmentPeriodHours: 480,
    hnrBanLimit: 3,
  },
  language: "English",
  color: "#00897b",
  trackerHubSlug: "beyond-hd",
  draft: true,
}
