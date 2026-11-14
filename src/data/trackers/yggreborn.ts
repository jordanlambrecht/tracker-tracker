// src/data/trackers/yggreborn.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const yggreborn: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "yggreborn",
  name: "YggReborn",
  abbreviation: "YGG",
  url: "https://www.yggreborn.org",
  description: "French general tracker covering movies, TV, music, games, applications and books.",

  // ── Platform & API ──────────────────────────────────────────────────
  // The site's own software. The passkey only signs the Torznab search API,
  // which returns no account figures, so the adapter reads the logged-in
  // account page with browser cookies.
  platform: "yggreborn",
  apiPath: "/account/",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  // The eight parent categories on the site's API guide: Jeux vidéo, Films et
  // vidéos, Audio, Applications, Télévision, XXX, Livres, Autres.
  contentCategories: ["Movies", "TV", "Music", "Games", "Apps", "Books", "XXX"],
  language: "French",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#66ddb7",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  // "Ratio minimum 0.75" is stated on the site's public pages. Seed time and
  // the inactivity window are not published there.
  rules: {
    minimumRatio: 0.75,
    seedTimeHours: 0,
    loginIntervalDays: 0,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: true,
  warningNote:
    "Unverified. Built from one saved account page and not yet polled against a live account.",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
