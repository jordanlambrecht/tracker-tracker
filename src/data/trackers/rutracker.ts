// src/data/trackers/rutracker.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const rutracker: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "rutracker",
  name: "RuTracker",
  abbreviation: "RuT",
  url: "https://rutracker.org",
  description:
    "Russian-language semi-private general tracker and forum with one of the largest catalogues anywhere. Registration is open and no ratio is enforced.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "rutracker",
  apiPath: "/forum/index.php",

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
    "Documentaries",
    "Sports",
    "Education",
  ],
  language: "Russian",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#4a76a8",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  // RuTracker has no earned classes past the member role. The rest are its
  // badges ("лычки"), which a member asks staff for once a threshold is met, so
  // none is a rung. Entry thresholds are from the official "Хочу лычку!" topic;
  // the higher levels are rutracker.wiki's and unofficial.
  userClasses: [
    { name: "User", requirements: "Every registered member" },
    {
      name: "Top Bonus",
      requirements:
        "At least 300 GB uploaded on rare torrents (3 or fewer peers). Permanent once given. Levels at 300 GB, 500 GB, 1 TB, 3 TB, 10 TB, 50 TB, 100 TB, 200 TB, 500 TB, 1 PB and 3 PB",
      outsideLadder: "above",
    },
    {
      name: "Top Seed",
      requirements:
        "At least 40 own releases with the verified status. Removed below 80% of the threshold. Levels at 40, 80, 160, 320, 640, 1280, 2560, 5120 and 10240 releases",
      outsideLadder: "above",
    },
    {
      name: "Top Loader",
      requirements:
        "Own verified releases totalling at least 100 GB. Removed below 80% of the threshold. Levels at 100 GB, 300 GB, 600 GB, 1 TB, 2 TB, 4 TB, 8 TB, 16 TB and 32 TB",
      outsideLadder: "above",
    },
    { name: "Oldie", requirements: "12 or more years on the tracker", outsideLadder: "above" },
    { name: "Top User", requirements: "Closed since 2010-05-07", outsideLadder: "above" },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0,
    seedTimeHours: 0,
    loginIntervalDays: 0,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "/forum/profile.php?mode=viewprofile&u={id}",
}
