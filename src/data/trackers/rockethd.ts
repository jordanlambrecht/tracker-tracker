// src/data/trackers/rockethd.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const rockethd: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "rockethd",
  name: "RocketHD",
  abbreviation: "",
  url: "https://rocket-hd.cc",
  description:
    "German-friendly UNIT3D tracker for movies and TV, built around a space-themed rank system and 'Idle Orbit' freeleech events.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Movies / TV",
  contentCategories: ["Movies", "TV"],
  language: "German",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#f97316",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    { name: "Leech", requirements: "Not connectable for 7+ days — downgraded, download privileges disabled" },
    { name: "Lost Soul", requirements: "Repeated rule violations or other negative conduct" },
    { name: "User", requirements: "Starting group for new accounts" },
    { name: "Lunar Explorer", requirements: "Account age ≥ 2 months, upload ≥ 2 TiB" },
    { name: "Deep Space Scout", requirements: "Account age ≥ 3 months, upload ≥ 5 TiB, 5 uploads" },
    { name: "Star Seeker", requirements: "Account age ≥ 6 months, upload ≥ 10 TiB, 10 uploads" },
    { name: "Star Navigator", requirements: "Account age ≥ 12 months, upload ≥ 15 TiB, 25 uploads" },
    { name: "Galactic Voyager", requirements: "Account age ≥ 15 months, upload ≥ 20 TiB, 50 uploads" },
    { name: "Galactic Pioneer", requirements: "Account age ≥ 18 months, upload ≥ 100 TiB, 100 uploads" },
    {
      name: "Supply Shuttle",
      requirements: "Account age ≥ 2 months, seed size ≥ 5 TiB, avg seedtime ≥ 1 month",
    },
    {
      name: "Data Capsule",
      requirements: "Account age ≥ 4 months, seed size ≥ 10 TiB, avg seedtime ≥ 2 months",
    },
    {
      name: "Nebula Vault",
      requirements: "Account age ≥ 6 months, seed size ≥ 20 TiB, avg seedtime ≥ 3 months",
    },
    { name: "Payload Commander", requirements: "Uploader" },
    { name: "Allied Officer", requirements: "Staff at another tracker/indexer, or a releaser" },
    { name: "Honored Traveler", requirements: "Especially supportive community member" },
    { name: "Payload Specialist", requirements: "Member of an internal release group" },
    { name: "Launch Technician", requirements: "Torrent moderator" },
    { name: "Flight Assistant", requirements: "Reviews new uploads" },
    { name: "Flight Director", requirements: "Moderator" },
    { name: "Chief Engineer", requirements: "Administrator" },
    { name: "Systems Engineer", requirements: "Developer / tinkerer" },
    { name: "Mission Commander", requirements: "Site owner" },
    { name: "Mission Control", requirements: "Bot accounts" },
  ],
  releaseGroups: [],
  bannedGroups: [
    "1XBET",
    "MEGA",
    "Whistler",
    "WOTT",
    "HELD",
    "FSX",
    "FuN",
    "w00t",
    "BB",
    "266ers",
    "JellyfinPlex",
    "2BA",
    "FritzBox",
    "FUNXDTV",
    "MTZ",
    "Taylor.D",
    "MagicX",
    "PaTroL",
    "GTF",
    "PiKACHU",
  ],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 1.0,
    seedTimeHours: 168,
    loginIntervalDays: 0,
    hnrBanLimit: 3,
    fullRulesMarkdown: [
      "## Seeding / Hit & Run",
      "",
      "- Ratio below 1.0 can result in a warning, and in extreme cases, exclusion",
      "- Required seed time is 7 days (168 hours), applying after 5% of the torrent has downloaded",
      "- Partial downloads are not permitted — seed time starts once the torrent reaches 100%",
      "- 3+ active HnR warnings may result in exclusion",
      "- Clients must be connectable (open port); non-connectable clients earn no bonus points",
      "- Only VPN providers offering port forwarding are allowed",
      "- Not connectable after 7 days → downgraded to Leech (download ban), or in severe cases, exclusion",
      "",
      "## Uploads",
      "",
      "- No MIC/CAM/TS/LD releases, upscaled releases (unless whitelisted group), or SD content when an HD version exists",
      "- Uploads must include a German audio track unless the request explicitly asked for original audio",
      "- Complete packs (all seasons, or multiple movies in one torrent) are not permitted",
      "- Once a season is complete it must be re-uploaded as a season pack; individual episodes may then be removed",
      "- MediaInfo/BDInfo required; RARs, samples, proofs, and extra images are not permitted",
      "",
      "## Requests",
      "",
      "- Fulfilled requests carry an extended seed requirement: 10 days after download",
      "- No requests for content not yet officially released (in stores or as an official stream)",
      "- Claimed requests must be fulfilled within 24 hours",
      "- Unfulfilled requests are auto-approved by a moderator after 7 days",
      "",
      "## Invites",
      "",
      "- Inviting someone makes you responsible for their conduct",
      "- Trading invites results in exclusion; careless/reckless invite distribution earns a warning",
    ],
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
