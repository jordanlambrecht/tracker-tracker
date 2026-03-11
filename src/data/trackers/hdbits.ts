// src/data/trackers/hdbits.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const hdbits: TrackerRegistryEntry = {
  slug: "hdbits",
  name: "HDBits",
  abbreviation: "HDB",
  url: "https://hdbits.org",
  description:
    "HD tracker known for being the internal release site for an enormous number of encoders, including many of the top groups. Also has a massive collection of full discs.",
  platform: "custom",
  apiPath: "/api/user",
  specialty: "HD Movies / TV",
  contentCategories: ["Movies", "TV"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  color: "#ffd700",
  draft: true,
}
