// src/data/trackers/luminarr.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const luminarr: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "luminarr",
  name: "Luminarr",
  abbreviation: "LUME",
  url: "https://luminarr.me",
  description:
    "Movies and TV tracker with Radarr/Sonarr integration and TRaSH Guides quality profiles with an Arr-themed UI.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Movies / TV",
  contentCategories: ["Movies", "TV"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#7891d1",
  logo: "/tracker-logos/luminarr_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    { name: "Validating", requirements: "New account, no privileges" },
    { name: "Leech", requirements: "Ratio below threshold. 0 download slots" },
    { name: "User", requirements: "Ratio ≥ 0.6. 5 download slots, can upload" },
    {
      name: "Member",
      requirements: "Upload ≥ 50 GiB, ratio ≥ 0.6, age ≥ 2 weeks. 10 download slots, can invite",
    },
    {
      name: "Power User",
      requirements:
        "Upload ≥ 500 GiB, ratio ≥ 1.0, age ≥ 1 month, avg seedtime ≥ 2 weeks, 5+ uploads. 25 download slots, invite forum",
    },
    {
      name: "Seeder",
      requirements:
        "Ratio ≥ 1.0, age ≥ 1 month, avg seedtime ≥ 1 month, seed size ≥ 2 TiB. 25 download slots",
    },
    {
      name: "Elite",
      requirements:
        "Upload ≥ 5 TiB, ratio ≥ 2.0, age ≥ 3 months, avg seedtime ≥ 1 month, 25+ uploads. 50 download slots, freeleech, torrent moderation bypass",
    },
    {
      name: "Archivist",
      requirements:
        "Ratio ≥ 2.0, age ≥ 3 months, avg seedtime ≥ 2 months, seed size ≥ 8 TiB. 50 download slots, freeleech, torrent moderation bypass",
    },
    {
      name: "Data Hoarder",
      requirements:
        "Upload ≥ 15 TiB, ratio ≥ 3.0, age ≥ 6 months, avg seedtime ≥ 2 months, seed size ≥ 15 TiB, 50+ uploads. 75 download slots, freeleech, double upload, HnR immune",
    },
    {
      name: "Torrent Master",
      requirements:
        "Upload ≥ 25 TiB, ratio ≥ 4.0, age ≥ 9 months, avg seedtime ≥ 3 months, seed size ≥ 15 TiB, 75+ uploads. 100 download slots, freeleech, double upload, HnR immune",
    },
    {
      name: "Elite Torrent Master",
      requirements:
        "Upload ≥ 50 TiB, ratio ≥ 5.0, age ≥ 1 year, avg seedtime ≥ 3 months, seed size ≥ 20 TiB, 100+ uploads. 100 download slots, freeleech, double upload, HnR immune",
    },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.6,
    seedTimeHours: 72,
    loginIntervalDays: 90,
    hnrBanLimit: 3,
    fullRulesMarkdown: [
      "## Seeding / Hit & Run",
      "",
      "- Must seed for 72 hours (3 days) minimum",
      "- Applies even to freeleech torrents",
      "- HnR triggers after downloading ≥ 10% and being disconnected for 7 days",
      "- Pre-warning sent at day 6 — reconnecting resets the 7-day grace period",
      "- HnR warnings expire after 4 weeks or can be seeded off",
      "- 3 active warnings → download privileges revoked",
      "- BON can also be used to remove warnings",
      "",
      "## Ratio",
      "",
      "- Minimum ratio: 0.6",
      "- Below 0.6 → download privileges disabled",
      "- Ratio recovery via seeding or uploading new content",
      "",
      "## Account Inactivity",
      "",
      "- 90 days without login → account disabled",
      "- Disabled accounts can be recovered within 90 days via staff",
      "- After 180 days total inactivity → account pruned permanently",
      "",
      "## General",
      "",
      "- One account per person per lifetime",
      "- No account sharing, trading, or selling",
      "- Passkey is personal — do not share torrent files or announce URLs",
      "- No modified clients or ratio manipulation",
      "",
      "## Uploading",
      "",
      "- Follow naming conventions and quality standards",
      "- MediaInfo and screenshots required for encodes",
      "- No scene-renamed releases or quality-misrepresented content",
    ],
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: true,
  warningNote: "Unverified! Not tested against a live account.",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "",
}
