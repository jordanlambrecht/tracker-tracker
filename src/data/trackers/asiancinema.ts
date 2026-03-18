// src/data/trackers/asiancinema.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const asiancinema: TrackerRegistryEntry = {
  slug: "asiancinema",
  name: "AsianCinema",
  abbreviation: "AC",
  url: "https://asiancinema.me",
  description: "UNIT3D tracker specializing in Asian cinema — movies, TV dramas, music, and variety shows from East and Southeast Asia.",
  platform: "unit3d",
  apiPath: "/api/user",
  specialty: "Asian Movies / TV / Music",
  contentCategories: ["Movies", "TV", "Music"],
  color: "#e63946",
  language: "English",
  trackerHubSlug: "asian-cinema",
  rules: {
    minimumRatio: 0,
    seedTimeHours: 0,
    loginIntervalDays: 90,
  },
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  draft: true,
}
