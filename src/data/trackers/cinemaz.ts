// src/data/trackers/cinemaz.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const cinemaz: TrackerRegistryEntry = {
  slug: "cinemaz",
  name: "CinemaZ",
  abbreviation: "CZ",
  url: "https://cinemaz.to",
  description:
    "Part of the PrivateHD network which often opens for signups. Foreign and non-mainstream movies and TV.",
  platform: "custom",
  apiPath: "/api/user",
  specialty: "Foreign / Non-mainstream",
  contentCategories: ["Movies", "TV"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  color: "#2980b9",
  draft: true,
}
