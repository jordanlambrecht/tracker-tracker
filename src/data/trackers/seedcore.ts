import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const seedcore: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "seedcore",
  name: "SeedCore",
  abbreviation: "", // SC seems obvious but it conflicts with SecretCinema
  url: "https://seedcore.net",
  description: "SeedCore (ROT) is a ROMANIAN/English Private Torrent Tracker",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  unit3dAuthStyle: "bearer",   // double check this
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: ["Movies", "TV", "Music", "Games", "XXX"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#1fa2ff",
  logo: "/tracker-logos/seedcore_logo.png", // add this

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
      {name: "Leech", requirements: "Ratio ≥ 0.00"},
      {name: "User", requirements: "Ratio ≥ 0.40"},
      {name: "PowerUser", requirements: "Upload ≥ 1 TB, Ratio ≥ 0.40, Account age ≥ 1 month"},
      {name: "SuperUser", requirements: "Upload ≥ 5 TB, Ratio ≥ 0.40, Account age ≥ 2 months"},
      {name: "ExtremeUser", requirements: "Upload ≥ 20 TB, Ratio ≥ 0.40, Account age ≥ 3 months"},
      {name: "InsaneUser", requirements: "Upload ≥ 50 TB, Ratio ≥ 0.40, Account age ≥ 6 months"},
      {name: "Veteran", requirements: "Upload ≥ 100 TB, Ratio ≥ 0.40, Account age ≥ 1 year"},
      {name: "Seeder", requirements: "Ratio ≥ 0.40, Account age ≥ 1 month, Seedsize ≥ 5 TB, Avg seedtime ≥ 1 month"},
      {name: "Archivist", requirements: "Ratio ≥ 0.40, Account age ≥ 3 months, Seedsize ≥ 10 TB, Avg seedtime ≥ 2 months"},
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
    "PSA (PSArips)",
    "Pahe",
    "Pahe.in",
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
    "UTR (Joy, QxR)",
    "VXT",
    "Vyndros",
    "YIFY",
    "YTS",
    "mSD",
    "nItRo",
  ],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.4,
    seedTimeHours: 72,
    loginIntervalDays: 0,
    hnrBanLimit: 3,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
