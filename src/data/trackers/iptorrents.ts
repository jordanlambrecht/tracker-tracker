// src/data/trackers/iptorrents.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const iptorrents: TrackerRegistryEntry = {
  slug: "iptorrents",
  name: "IPTorrents",
  abbreviation: "IPT",
  url: "https://iptorrents.com",
  description:
    "General tracker with a controversial reputation. Extremely large userbase. Content quality can be inconsistent.",
  platform: "custom",
  apiPath: "/api/user",
  specialty: "General",
  contentCategories: ["Movies", "TV", "Games", "Music", "Software", "Books"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  color: "#e74c3c",
  draft: true,
}
