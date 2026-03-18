// src/data/trackers/hdtorrents.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const hdtorrents: TrackerRegistryEntry = {
  slug: "hdtorrents",
  name: "HD-Torrents",
  abbreviation: "HDT",
  url: "https://hd-torrents.org",
  description:
    "Entry-level HD site with activity requirements and no H&R.",
  platform: "custom",
  apiPath: "/api/user",
  specialty: "HD Movies / TV",
  contentCategories: ["Movies", "TV"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  color: "#43a047",
  draft: true,
}
