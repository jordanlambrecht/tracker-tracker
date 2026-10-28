// src/data/trackers/tr4ker.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const tr4ker: TrackerRegistryEntry = {
  // -- Identity ---------------------------------------------------------
  slug: "tr4ker",
  name: "TR4KER",
  abbreviation: "TR4K",
  url: "https://tr4ker.net",
  description:
    "French private general tracker covering movies, TV, music, games, apps, and books.",

  // -- Platform & API ---------------------------------------------------
  platform: "tr4ker",
  apiPath: "/api/me",

  // -- Content ----------------------------------------------------------
  specialty: "General",
  contentCategories: ["Movies", "TV", "Music", "Games", "Apps", "Books", "XXX"],
  language: "French",

  // -- Visual -----------------------------------------------------------
  color: "#0ea5e9",
  logo: "/tracker-logos/tr4ker_logo.png",

  // -- External Links ---------------------------------------------------
  trackerHubSlug: "",
  statusPageUrl: "",

  // -- Community --------------------------------------------------------
  userClasses: [
    { name: "Membre", requirements: "Granted on sign-up" },
    {
      name: "Uploader en herbe",
      requirements: "Automatic, after 7 days and 10 uploads",
    },
    {
      name: "Uploader",
      requirements: "Automatic, after 7 days and 100 uploads",
    },
    {
      name: "Helper",
      requirements: "Granted by staff",
      outsideLadder: "above",
    },
    {
      name: "Contributeur",
      requirements: "Granted by staff",
      outsideLadder: "above",
    },
    {
      name: "Team",
      requirements: "Automatic for members of a release team",
      outsideLadder: "above",
    },
    {
      name: "Modérateur",
      requirements: "Staff",
      outsideLadder: "above",
    },
    {
      name: "Administrateur",
      requirements: "Staff",
      outsideLadder: "above",
    },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // -- Rules ------------------------------------------------------------
  rules: {
    minimumRatio: 0.5,
    seedTimeHours: 0,
    loginIntervalDays: 0,
  },

  // -- Status -----------------------------------------------------------
  warning: true,
  warningNote: "Unverified! Not tested against a live account.",

  // -- Flags ------------------------------------------------------------
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
