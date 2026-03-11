// src/data/trackers/avistaz.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const avistaz: TrackerRegistryEntry = {
  slug: "avistaz",
  name: "AvistaZ",
  abbreviation: "AvZ",
  url: "https://avistaz.to",
  description:
    "Very good Asian movie and TV tracker, part of the AvistaZ network.",
  platform: "custom",
  apiPath: "/api/user",
  specialty: "Asian Movies / TV",
  contentCategories: ["Movies", "TV"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  color: "#e91e63",
  draft: true,
}
