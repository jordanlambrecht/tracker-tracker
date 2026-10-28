// src/data/trackers/retromoviesclub.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const retromoviesclub: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "retromoviesclub",
  name: "Retro Movies Club",
  abbreviation: "RMC",
  url: "https://retro-movies.club",
  description:
    "Private movie tracker for films released in 2000 or earlier. Aims to be the definitive archive of classic films.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Classic / Retro Movies",
  contentCategories: ["Movies"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#ff69b4",
  logo: "/tracker-logos/retromoviesclub_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    {
      name: "Outtake",
      requirements: "Pruned accounts - removed due to prolonged inactivity.",
      outsideLadder: "below",
    },
    {
      name: "Blacklisted",
      requirements: "Banned for violating site rules - all privileges revoked.",
      outsideLadder: "below",
    },
    {
      name: "Shelved",
      requirements: "Disabled accounts - temporarily or permanently shelved by staff.",
      outsideLadder: "below",
    },
    {
      name: "Audience",
      requirements: "View/download only role - can't upload or invite.",
      outsideLadder: "below",
    },
    {
      name: "Auditioning",
      requirements: "Pending email verification",
      outsideLadder: "below",
    },
    {
      name: "Seat Filler",
      requirements: "0 B Uploaded, 0.00 Ratio",
      outsideLadder: "below",
    },
    { name: "Actor", requirements: "0 B Uploaded" },
    { name: "Film Buff", requirements: "1 TiB Uploaded, 0.40 Ratio, 1 Month account age" },
    { name: "Supporting Actor", requirements: "5 TiB Uploaded, 0.40 Ratio, 2 Months account age" },
    {
      name: "Leading Actor",
      requirements: "20 TiB Uploaded, 0.40 Ratio, 3 Months account age, Mod Bypass",
    },
    {
      name: "Movie Star",
      requirements: "50 TiB Uploaded, 0.40 Ratio, 6 Months account age, Mod Bypass",
    },
    {
      name: "Superstar",
      requirements:
        "0.40 Ratio, 1 Month account age, 1 Month avg seedtime, 5 TiB min seedsize, HnR Immune, Mod Bypass",
    },
    {
      name: "Preservationist",
      requirements:
        "0.40 Ratio, 3 Months account age, 2 Months avg seedtime, 10 TiB min seedsize, Freeleech, HnR Immune, Mod Bypass",
    },
    {
      name: "Screen Legend",
      requirements: "100 TiB Uploaded, 0.40 Ratio, 1 Year account age, Freeleech",
    },
    { name: "Executive", requirements: "Staff assigned", outsideLadder: "above" },
    { name: "Producer", requirements: "Staff assigned", outsideLadder: "above" },
    {
      name: "ViP",
      requirements: "Very Important Person - donors and honored members of the community",
      outsideLadder: "above",
    },
    { name: "Film Editor", requirements: "Staff assigned", outsideLadder: "above" },
    { name: "Script Supervisor", requirements: "Staff assigned", outsideLadder: "above" },
    { name: "Assistant Director", requirements: "Staff assigned", outsideLadder: "above" },
    { name: "Director", requirements: "Staff assigned", outsideLadder: "above" },
    { name: "Studio Mogul", requirements: "Staff assigned", outsideLadder: "above" },
    { name: "Animatronic", requirements: "Staff assigned", outsideLadder: "above" },
  ],
  releaseGroups: [
    { name: "EORMC", description: "Internal Encodes and Remux group." },
    { name: "RMWD", description: "Internal WebDL release group." },
  ],
  bannedGroups: [
    "[Oj]",
    "3LTON",
    "4yEo",
    "ADE",
    "AFG",
    "AniHLS",
    "AnimeRG",
    "AniURL",
    "AROMA",
    "aXXo",
    "CM8",
    "CrEwSaDe",
    "DeadFish",
    "DNL",
    "ELiTE",
    "eSc",
    "FaNGDiNG0",
    "FGT",
    "Flights",
    "FRDS",
    "FUM",
    "GalaxyRG",
    "HAiKU",
    "HDS",
    "HDTime",
    "INFINITY",
    "ION10",
    "iPlanet",
    "JIVE",
    "KiNGDOM",
    "LAMA",
    "Leffe",
    "LOAD",
    "mHD",
    "nHD",
    "NOIVTC",
    "nSD",
    "PiRaTeS",
    "RARBG",
    "RDN",
    "REsuRRecTioN",
    "RMTeam",
    "SANTi",
    "SicFoI",
    "SPASM",
    "STUTTERSHIT",
    "Telly",
    "TM",
    "UPiNSMOKE",
    "WAF",
    "xRed",
    "XS",
    "YELLO",
    "YIFY",
    "YTS",
    "ZKBL",
    "ZmN",
  ],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.4,
    seedTimeHours: 48,
    loginIntervalDays: 0,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: true,
  warningNote: "Unverified! Not tested against a live account.",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: true,
  profileUrlPattern: "/users/{username}",
}
