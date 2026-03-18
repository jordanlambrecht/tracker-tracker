// src/data/trackers/bibliotik.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const bibliotik: TrackerRegistryEntry = {
  slug: "bibliotik",
  name: "Bibliotik",
  abbreviation: "BIB",
  url: "https://bibliotik.me",
  description:
    "The premier private tracker for e-books, audiobooks, comics, and other written media. Massive library with strict curation.",
  platform: "custom",
  apiPath: "/api/user",
  specialty: "E-Books / Audiobooks",
  contentCategories: ["Books", "Audiobooks", "Comics"],
  color: "#8b5cf6",
  language: "English",
  trackerHubSlug: "bibliotik",
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
