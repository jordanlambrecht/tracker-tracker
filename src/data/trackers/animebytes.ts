// src/data/trackers/animebytes.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const animebytes: TrackerRegistryEntry = {
  slug: "animebytes",
  name: "AnimeBytes",
  abbreviation: "AB",
  url: "https://animebytes.tv",
  description:
    "Huge archive of anime with great retention. Organization isn't as good as many other top trackers.",
  platform: "gazelle",
  apiPath: "/ajax.php",
  specialty: "Anime",
  contentCategories: ["Anime", "Manga", "Music"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  color: "#ff7043",
  trackerHubSlug: "anime-bytes",
  statusPageUrl: "https://status.animebytes.tv/",
  warning: true,
  warningNote: "Unvalidated",
  rules: {
    minimumRatio: 0,
    seedTimeHours: 72,
    loginIntervalDays: 90,
  },
  draft: false,
}
