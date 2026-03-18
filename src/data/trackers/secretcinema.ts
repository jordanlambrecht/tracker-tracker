// src/data/trackers/secretcinema.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const secretcinema: TrackerRegistryEntry = {
  slug: "secretcinema",
  name: "Secret Cinema",
  abbreviation: "SC",
  url: "https://secret-cinema.pw",
  description:
    "Focused on obscure and arthouse content, overlapping a lot with KG but much easier to join.",
  platform: "custom",
  apiPath: "/api/user",
  specialty: "Arthouse / Obscure",
  contentCategories: ["Movies"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  color: "#8e44ad",
  trackerHubSlug: "secret-cinema",
  draft: true,
}
