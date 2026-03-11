// src/data/trackers/phoenixproject.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const phoenixproject: TrackerRegistryEntry = {
  slug: "phoenixproject",
  name: "Phoenix Project",
  abbreviation: "PP",
  url: "https://phoenixproject.app",
  description:
    "macOS-focused private tracker specializing in Mac applications, games, iOS content, audio tools, graphics software, tutorials, and ebooks. Gazelle-based with a bonus point system and an active community of around 1.6K users.",
  platform: "gazelle",
  apiPath: "/ajax.php",
  specialty: "macOS Software",
  contentCategories: ["Apps", "Games", "Music", "Education", "Tutorials", "Books"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  color: "#e65100",
  rules: {
    minimumRatio: 0,
    seedTimeHours: 0,
    loginIntervalDays: 0,
  },
  draft: true,
  warning: true,
  warningNote: "Gazelle tracker — user classes, ratio rules, and seed time not yet documented. Verify API compatibility before enabling.",
}
