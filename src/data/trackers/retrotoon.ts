// src/data/trackers/retrotoon.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const retrotoon: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "retrotoon",
  name: "RetroToon World",
  abbreviation: "RTW",
  url: "https://retrotoon.world",
  description:
    "Private tracker dedicated exclusively to animation: classic Western cartoons, animated series and films, anime, and shorts. Aims to archive rare and hard-to-find animation from any country or era.",

  // ── Platform & API ──────────────────────────────────────────────────
  // TBDev derivative. The `rt_` API key only authenticates uploads and the
  // passkey only Torznab search, so no endpoint returns user stats and the
  // adapter scrapes the logged-in pages with browser cookies.
  platform: "retrotoon",
  apiPath: "/userdetails.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Animation",
  // The site lists an Adult category, but rules.php forbids adult content
  // outright, so it is not mapped to XXX.
  contentCategories: ["Movies", "TV", "Anime", "Comics", "Manga", "Music"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#455a64",
  logo: "/tracker-logos/retrotoon_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "https://status.retrotoon.world",

  // ── Community ───────────────────────────────────────────────────────
  // Thresholds from faq.php. The starting class is "Toon" in the live header
  // and statistics.php, not "Sketch" as the FAQ still calls it.
  userClasses: [
    { name: "Toon", requirements: "Starting class" },
    {
      name: "Toon Hero",
      requirements: "60 days registered, 50 GB uploaded, ratio 1.05 or higher",
    },
    {
      name: "Toon Legend",
      requirements: "180 days registered, 250 GB uploaded, ratio 2.05 or higher",
    },
    {
      name: "Toon Superstar",
      requirements: "360 days registered, 1500 GB uploaded, ratio 2.05 or higher",
    },
    {
      name: "Silver Star",
      requirements: "Awarded rank. Requirements not published",
      outsideLadder: "above",
    },
    {
      name: "The Creator",
      requirements: "Awarded rank. Requirements not published",
      outsideLadder: "above",
    },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  // rules.php: "Every torrent you upload must be seeded for a minimum of 3 full
  // days (72 hours) ... Those 72 hours should be reached in the first 10 days
  // after download." myhr.php: "Reaching a 1:1 ratio immediately clears a Hit &
  // Run", which is the per-torrent OR. faq.php: accounts are disabled after 3
  // months without a login, and no account-level ratio is enforced.
  rules: {
    minimumRatio: 1, // per-torrent rule applied to the account ratio, so health reads critical below 1
    seedTimeHours: 72,
    loginIntervalDays: 90,
    satisfactionMode: "any",
    fulfillmentPeriodHours: 240,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: true,
  profileUrlPattern: "/userdetails.php?id={id}",

  // ── Stats ───────────────────────────────────────────────────────────
  // statistics.php
  stats: {
    userCount: 11124,
    activeUsers: 11114,
    torrentCount: 4852,
    seedSize: "48.969 TB",
    statsUpdatedAt: "August 2026",
  },
}
