// src/data/trackers/funfile.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const funfile: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "funfile",
  name: "FunFile",
  abbreviation: "FF",
  url: "https://www.funfile.org",
  description:
    "General tracker running a TBDev-based site, with automatic class promotion and a credits system.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "funfile",
  apiPath: "/userdetails.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: [
    "Movies",
    "TV",
    "Music",
    "Games",
    "Apps",
    "Books",
    "Audiobooks",
    "Anime",
    "Tutorials",
    "XXX",
  ],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#7b3fa0",
  logo: "",
  bonusName: "Credits",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  // classes.php. Promotion and demotion are automatic: every value of a class
  // must be met, and a member who no longer meets them is demoted to the
  // highest class they still meet.
  userClasses: [
    { name: "Patient", requirements: "Default class. 10 download slots" },
    {
      name: "Delusional",
      requirements: "4 weeks, 50 GB uploaded, ratio 1.0. 25 download slots",
    },
    {
      name: "Insomniac",
      requirements: "8 weeks, 150 GB downloaded, 225 GB uploaded, ratio 1.5. 30 download slots",
    },
    {
      name: "Maniac",
      requirements: "12 weeks, 350 GB downloaded, 700 GB uploaded, ratio 2.0. 35 download slots",
    },
    {
      name: "Mental",
      requirements: "16 weeks, 500 GB downloaded, 1.221 TB uploaded, ratio 2.5. 40 download slots",
    },
    {
      name: "Insane",
      requirements: "20 weeks, 750 GB downloaded, 2.197 TB uploaded, ratio 3.0. 45 download slots",
    },
    {
      name: "Clinical",
      requirements: "24 weeks, 1 TB downloaded, 3.5 TB uploaded, ratio 3.5. 50 download slots",
    },
    { name: "Psychotic", requirements: "28 weeks, 50 TB uploaded, ratio 1.0. 55 download slots" },
    { name: "Berserk", requirements: "32 weeks, 100 TB uploaded, ratio 1.0. 60 download slots" },
    {
      name: "VIP",
      requirements: "Donors. H&R protection during the donation period",
      outsideLadder: "above",
    },
    {
      name: "Pharmacist",
      requirements: "Uploaders, from Delusional with at least 1 MB/s upload speed",
      outsideLadder: "above",
    },
    {
      name: "Narcissist",
      requirements: "Assigned to known staff of other sites",
      outsideLadder: "above",
    },
    { name: "Elite VIP", requirements: "Selected by staff", outsideLadder: "above" },
    { name: "Nurses", requirements: "Staff", outsideLadder: "above" },
    { name: "Doctor", requirements: "Staff (SiteOp)", outsideLadder: "above" },
    { name: "Nutcase", requirements: "Staff (SysOp)", outsideLadder: "above" },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    // The FAQ: seed each download back to 1.0 or for 48 hours.
    minimumRatio: 1.0,
    seedTimeHours: 48,
    satisfactionMode: "any",
    // Accounts inactive for more than 42 days are deleted unless parked.
    loginIntervalDays: 42,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "/userdetails.php?id={id}",
}
