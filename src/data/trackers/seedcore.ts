// src/data/trackers/seedcore.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const seedcore: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "seedcore",
  name: "SeedCore",
  abbreviation: "",
  url: "https://seedcore.net",
  description:
    "Romanian general tracker, formerly RoTorrent, covering movies, TV, music, games and XXX. Joining takes an invite or an application.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: ["Movies", "TV", "Music", "Games", "XXX"],
  language: "Romanian",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#1fa2ff",
  logo: "/tracker-logos/seedcore_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    { name: "Disabled", requirements: "Disabled account, no privileges", outsideLadder: "below" },
    { name: "Banned", requirements: "Violated site rules", outsideLadder: "below" },
    { name: "Pruned", requirements: "Pruned for inactivity", outsideLadder: "below" },
    { name: "Leech", requirements: "Ratio below 0.40. Downloads disabled", outsideLadder: "below" },
    { name: "User", requirements: "Ratio ≥ 0.40" },
    { name: "PowerUser", requirements: "Upload ≥ 1 TiB, ratio ≥ 0.40, age ≥ 1 month" },
    { name: "SuperUser", requirements: "Upload ≥ 5 TiB, ratio ≥ 0.40, age ≥ 2 months" },
    { name: "ExtremeUser", requirements: "Upload ≥ 20 TiB, ratio ≥ 0.40, age ≥ 3 months" },
    { name: "InsaneUser", requirements: "Upload ≥ 50 TiB, ratio ≥ 0.40, age ≥ 6 months" },
    { name: "Veteran", requirements: "Upload ≥ 100 TiB, ratio ≥ 0.40, age ≥ 1 year" },
    {
      name: "Seeder",
      requirements: "Ratio ≥ 0.40, age ≥ 1 month, seed size ≥ 5 TiB, avg seedtime ≥ 1 month",
    },
    {
      name: "Archivist",
      requirements: "Ratio ≥ 0.40, age ≥ 3 months, seed size ≥ 10 TiB, avg seedtime ≥ 2 months",
    },
    { name: "VIP", requirements: "Staff assigned", outsideLadder: "above" },
    { name: "Trustee", requirements: "Staff assigned", outsideLadder: "above" },
    { name: "Internal", requirements: "Staff assigned", outsideLadder: "above" },
    { name: "Uploader", requirements: "Staff", outsideLadder: "above" },
    { name: "Editor", requirements: "Staff", outsideLadder: "above" },
    { name: "Torrent Moderator", requirements: "Staff", outsideLadder: "above" },
    { name: "Moderator", requirements: "Staff", outsideLadder: "above" },
    { name: "Administrator", requirements: "Staff", outsideLadder: "above" },
  ],
  releaseGroups: [],
  bannedGroups: [
    "300MB Movies",
    "AFG",
    "AnimeRG",
    "BONE",
    "CMRG",
    "Cinemaluxe",
    "Cleo",
    "EMBER",
    "ETRG",
    "EVO",
    "EliteMovieRG",
    "ExtraTorrentRG",
    "GalaxyRG",
    "Ganool",
    "ION10",
    "IceBane",
    "KiNGDOM",
    "MeGusta",
    "MiniHD",
    "PSA",
    "Pahe",
    "RARBG",
    "RMTeam",
    "RMTeamX",
    "RZeroX",
    "SPHD",
    "SPWEB",
    "ShAaNiG",
    "TARTAR",
    "TERMiNAL",
    "TGx",
    "UTR",
    "VXT",
    "Vyndros",
    "YIFY",
    "YTS",
    "mSD",
    "nItRo",
  ],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  // Prowlarr Indexers definitions/v11/seedcore-api.yml sets minimumseedtime: 259200
  rules: {
    minimumRatio: 0.4,
    seedTimeHours: 72,
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
