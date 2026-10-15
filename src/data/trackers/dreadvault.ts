// src/data/trackers/dreadvault.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const dreadvault: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "dreadvault",
  name: "DreadVault",
  abbreviation: "DV",
  url: "https://dreadvault.org",
  description: "Private tracker for horror movies and TV.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Horror content",
  contentCategories: ["Movies", "TV", "Books", "Music"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#d40207",
  logo: "/tracker-logos/dreadvault_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    { name: "Leech", requirements: "Ratio below 0.4. Downloads disabled", outsideLadder: "below" },
    { name: "User", requirements: "Ratio ≥ 0.4" },
    { name: "Wanderer", requirements: "Ratio ≥ 0.4, min upload ≥ 1TiB, account age ≥ 1 month" },
    { name: "Survivor", requirements: "Ratio ≥ 0.4, min upload ≥ 5TiB, account age ≥ 2 months" },
    {
      name: "Night Stalker",
      requirements: "Ratio ≥ 0.4, min upload ≥ 20TiB, account age ≥ 3 months",
    },
    {
      name: "Grave Keeper",
      requirements: "Ratio ≥ 0.4, min upload ≥ 50TiB, account age ≥ 6 months",
    },
    { name: "Dreadborn", requirements: "Ratio ≥ 0.4, min upload ≥ 100TiB, account age ≥ 1 year" },
    {
      name: "Shadow Walker",
      requirements:
        "Ratio ≥ 0.4, min seedsize ≥ 5TiB, min avg. seedtime ≥ 1 month, account age ≥ 1 month",
    },
    {
      name: "Bloodbound",
      requirements:
        "Ratio ≥ 0.4, min seedsize ≥ 10TiB, min avg. seedtime ≥ 2 months, account age ≥ 3 months",
    },
    {
      name: "Ancient One",
      requirements:
        "Ratio ≥ 1.5, min upload ≥ 10TiB, account age ≥ 6 months, min avg. seedtime ≥ 1 month, min seedsize ≥ 5TiB, min uploads 500",
    },
    {
      name: "Elder",
      requirements: "An ancient presence whose experience commands respect",
      outsideLadder: "above",
    },
    {
      name: "Harbinger",
      requirements: "A feared and respected presence among the realm's greatest",
      outsideLadder: "above",
    },
    {
      name: "VIP",
      requirements:
        "A supporter of DreadVault who has chosen to fuel the darkness. VIP status grants exclusive benefits for the selected duration",
      outsideLadder: "above",
    },
    {
      name: "The Eternal",
      requirements:
        "A timeless supporter of DreadVault. The Eternal has earned a permanent place within the darkness",
      outsideLadder: "above",
    },
    {
      name: "The Dread Ascendant",
      requirements:
        "A supreme patron of DreadVault. The Dread Ascendant has risen beyond ordinary supporters and stands among the highest ranks of the darkness",
      outsideLadder: "above",
    },
  ],
  releaseGroups: [],
  bannedGroups: ["YTS", "YIFY", "RARBG", "VXT", "BONE", "NeoNoir", "PSA", "EVO"],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  // Jackett issue #17027: "MST 120 hrs (Global MR 0.7)"
  rules: {
    minimumRatio: 0.7,
    seedTimeHours: 120,
    loginIntervalDays: 0,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: true,
  warningNote: "Unverified! Not tested against a live account.",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
