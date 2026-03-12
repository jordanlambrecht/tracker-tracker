// src/data/trackers/filelist.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const filelist: TrackerRegistryEntry = {
  slug: "filelist",
  name: "FileList",
  abbreviation: "FL",
  url: "https://filelist.io",
  description:
    "General tracker with a huge amount of content including encodes from top groups such as HDB internals.",
  platform: "custom",
  apiPath: "/api/user",
  specialty: "General",
  contentCategories: ["Movies", "TV", "Games", "Music", "Apps", "Books"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  color: "#3498db",
  draft: true,
}
