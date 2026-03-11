// src/data/trackers/tvvault.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const tvvault: TrackerRegistryEntry = {
  slug: "tvvault",
  name: "TV-Vault",
  abbreviation: "TVV",
  url: "https://tv-vault.me",
  description:
    "Focusing on older TV. Does not allow any show that did not finish airing at least 5 years ago.",
  platform: "custom",
  apiPath: "/api/user",
  specialty: "Classic / Older TV",
  contentCategories: ["TV"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  color: "#795548",
  draft: true,
}
