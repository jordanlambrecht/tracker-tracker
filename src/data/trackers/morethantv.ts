// src/data/trackers/morethantv.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const morethantv: TrackerRegistryEntry = {
  slug: "morethantv",
  name: "MoreThanTV",
  abbreviation: "MTV",
  url: "https://morethantv.me",
  description:
    "Previously the runner-up TV tracker. Staff are still rebuilding the site and community so retention is not what it once was. Ratioless. Also tracks movies.",
  platform: "gazelle",
  apiPath: "/ajax.php",
  specialty: "TV / Movies",
  contentCategories: ["TV", "Movies"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  color: "#27ae60",
  warning: true,
  warningNote: "Unvalidated",
  rules: {
    minimumRatio: 0,
    seedTimeHours: 24,
    loginIntervalDays: 90,
  },
}
