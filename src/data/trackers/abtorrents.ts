// src/data/trackers/abtorrents.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const abtorrents: TrackerRegistryEntry = {
  slug: "abtorrents",
  name: "AB Torrents",
  abbreviation: "ABT",
  url: "https://abtorrents.me",
  description: "Audiobook and ebook tracker.",
  platform: "custom",
  apiPath: "/api/user",
  specialty: "Audiobooks / Books",
  contentCategories: ["Audiobooks", "Books"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  color: "#6d4c41",
  draft: true,
}
