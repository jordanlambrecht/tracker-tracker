// src/data/trackers/myanonamouse.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const myanonamouse: TrackerRegistryEntry = {
  slug: "myanonamouse",
  name: "MyAnonaMouse",
  abbreviation: "MAM",
  url: "https://myanonamouse.net",
  description:
    "Book, audiobook, and comics tracker with an open interview for anyone who wants to join and an extremely friendly community.",
  platform: "custom",
  apiPath: "/api/user",
  specialty: "Books / Audiobooks",
  contentCategories: ["Books", "Audiobooks", "Comics"],
  userClasses: [],
  releaseGroups: [],
  notableMembers: [],
  language: "English",
  color: "#ec407a",
  draft: true,
}
