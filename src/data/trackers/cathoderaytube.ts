// src/data/trackers/cathoderaytube.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const cathoderaytube: TrackerRegistryEntry = {
  slug: "cathoderaytube",
  name: "Cathode-Ray.Tube",
  abbreviation: "CRT",
  url: "https://cathode-ray.tube",
  description:
    "Niche tracker dedicated to classic and retro television content. Specializes in older TV series, public broadcasts, and hard-to-find vintage programming.",
  platform: "unit3d",
  apiPath: "/api/user",
  specialty: "Classic / Retro TV",
  contentCategories: ["TV"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  stats: {
    userCount: undefined,
    torrentCount: undefined,
  },
  language: "English",
  color: "#22d3ee",
  logo: "/tracker-logos/cathoderaytube_logo.png",
  draft: true,
}
