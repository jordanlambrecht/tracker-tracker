// src/data/trackers/nebulance.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const nebulance: TrackerRegistryEntry = {
  slug: "nebulance",
  name: "Nebulance",
  abbreviation: "NBL",
  url: "https://nebulance.io",
  description:
    "Ratioless TV site. Good for popular or new TV, but less popular or older content will often not make it on or will lose seeders.",
  platform: "nebulance",
  apiPath: "/api.php",
  specialty: "TV",
  contentCategories: ["TV"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  color: "#1a4fc2",
  logo: "/tracker-logos/nebulance_logo.png",
  rules: {
    minimumRatio: 0,
    seedTimeHours: 72,
    loginIntervalDays: 90,
  },
}
