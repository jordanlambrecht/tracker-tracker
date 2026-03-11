// src/data/trackers/racing4everyone.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const racing4everyone: TrackerRegistryEntry = {
  slug: "racing4everyone",
  name: "Racing4Everyone",
  abbreviation: "R4E",
  url: "https://racing4everyone.eu",
  description:
    "The go-to tracker for motorsport fans. Covers Formula 1, MotoGP, WRC, NASCAR, endurance racing, and niche series from around the world.",
  platform: "unit3d",
  apiPath: "/api/user",
  specialty: "Motorsport",
  contentCategories: ["Sport"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  stats: {
    userCount: undefined,
    torrentCount: undefined,
  },
  language: "English",
  color: "#dc2626",
  logo: undefined,
  rules: {
    minimumRatio: 0.4,
    seedTimeHours: 72,
    loginIntervalDays: 90,
  },
}
