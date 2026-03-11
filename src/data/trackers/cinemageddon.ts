// src/data/trackers/cinemageddon.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const cinemageddon: TrackerRegistryEntry = {
  slug: "cinemageddon",
  name: "Cinemageddon",
  abbreviation: "CG",
  url: "https://cinemageddon.net",
  description:
    "Focused around B movies and trashy movies. A niche archive for cult, exploitation, and obscure cinema.",
  platform: "custom",
  apiPath: "/api/user",
  specialty: "B-Movies / Cult",
  contentCategories: ["Movies"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  color: "#d35400",
  draft: true,
}
