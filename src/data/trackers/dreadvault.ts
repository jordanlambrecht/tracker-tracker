// src/data/trackers/dreadvault.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const dreadvault: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "dreadvault",
  name: "DreadVault",
  abbreviation: "DVL",
  url: "https://dreadvault.org",
  description:
    "Horror-only tracker (movies, TV, eBooks) covering the full genre from full discs and remuxes down to DVD and VHS sources. UNIT3D. Launched August 2026.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Horror",
  contentCategories: ["Movies", "TV", "Books"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#8b0000",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    { name: "Validating", requirements: "New account, no privileges" },
    { name: "Leech", requirements: "Ratio < 0.60 demotion class. 0 download slots" },
    {
      name: "User",
      requirements: "Default class. Unlimited download slots, can upload (uploads go through the moderation queue)",
    },
    {
      name: "Wanderer",
      requirements:
        "Upload ≥ 1 TiB, ratio ≥ 0.40, age ≥ 1 month. Can invite, torrent moderation bypass",
    },
    {
      name: "Survivor",
      requirements: "Upload ≥ 5 TiB, ratio ≥ 0.40, age ≥ 2 months. Can invite, moderation bypass",
    },
    {
      name: "Night Stalker",
      requirements: "Upload ≥ 20 TiB, ratio ≥ 0.40, age ≥ 3 months. Can invite, moderation bypass",
    },
    {
      name: "Grave Keeper",
      requirements: "Upload ≥ 50 TiB, ratio ≥ 0.40, age ≥ 6 months. Can invite, moderation bypass",
    },
    {
      name: "Dreadborn",
      requirements:
        "Upload ≥ 100 TiB, ratio ≥ 0.40, age ≥ 1 year. Freeleech, can invite, moderation bypass",
    },
    {
      name: "Shadow Walker",
      requirements:
        "Seed size ≥ 5 TiB, avg seedtime ≥ 1 month, ratio ≥ 0.40, age ≥ 1 month. Immune to automated HnR warnings, can invite, moderation bypass",
    },
    {
      name: "Bloodbound",
      requirements:
        "Seed size ≥ 10 TiB, avg seedtime ≥ 2 months, ratio ≥ 0.40, age ≥ 3 months. Freeleech, immune to automated HnR warnings, can invite, moderation bypass",
    },
    {
      name: "Ancient One",
      requirements:
        "Upload ≥ 10 TiB, ratio ≥ 1.50, age ≥ 6 months, avg seedtime ≥ 1 month, seed size ≥ 5 TiB, 500+ uploads. Freeleech, double upload, immune to HnR warnings, moderation bypass",
    },
    {
      name: "Plague Doctor",
      requirements: "Staff-awarded (\"an ancient presence whose experience commands respect\"). Freeleech, immune to HnR warnings",
    },
    {
      name: "Harbinger",
      requirements:
        "Staff-awarded to major contributors (\"a feared and respected presence among the realm's greatest\"). Freeleech, immune to HnR warnings, moderation bypass",
    },
    { name: "DVL", requirements: "Internal release group. Freeleech, immune to HnR warnings, moderation bypass" },
    {
      name: "Crypt Patron / Vault Sovereign / The Eternal / The Dread Ascendant",
      requirements:
        "Donor tiers (one-off → timed VIP → lifetime → founding patron). Freeleech, immune to HnR warnings; The Eternal and The Dread Ascendant add double upload",
    },
    { name: "Lorekeeper / Vault Warden", requirements: "Staff" },
  ],
  releaseGroups: [{ name: "DVL", description: "In-house internals; permanent freeleech, no double upload" }],
  bannedGroups: [
    "AOC",
    "AOS",
    "BONE",
    "EVO",
    "FGT",
    "LAMA",
    "NeoNoir",
    "PSA",
    "RARBG",
    "VXT",
    "YIFY",
    "YTS",
  ],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.7,
    seedTimeHours: 120,
    loginIntervalDays: 0,
    hnrBanLimit: 3,
    fullRulesMarkdown: [
      "## Seeding / Hit & Run",
      "",
      "- Every downloaded torrent must be seeded for 120 hours (5 days) after reaching 100%, regardless of ratio",
      "- Seedtime only starts counting at 100% downloaded; partial downloads do not count",
      "- H&R tracking begins after a 15% download buffer",
      "- Freeleech torrents are not exempt",
      "- Disconnected > 3 days without the required seedtime → pre-warning PM; > 5 days → H&R warning",
      "- H&R warnings stay active for 30 days, or until the torrent has been seeded for 5 days; expired warnings remain as permanent marks",
      "- 3 active H&R warnings → download privileges disabled until the obligations are completed",
      "",
      "## Ratio",
      "",
      "- Minimum ratio: 0.70 — below it, download privileges are disabled until restored",
      "",
      "## Account",
      "",
      "- One account per person per lifetime",
      "- New members must generate activity (uploading, downloading, or cross-seeding) within the first 90 days or may be automatically disabled",
      "- Seeding from multiple locations is allowed; downloading your own torrents or manipulating your own traffic is prohibited",
      "- Do not discuss or advertise other private trackers anywhere on the site",
      "",
      "## Uploading",
      "",
      "- Horror only: tagged Horror on TMDB/IMDb/TVDB, or substantial horror elements (horror comedy, family horror and horror documentaries qualify)",
      "- Official retail or legitimate release only; no pre-release content; no XXX",
      "- Uploads must be seeded for at least 5 days or until there are 3 active seeders",
      "- Never rename or modify original release files or folders; keep the original group tag unless substantially modified",
      "- No RAR/ZIP archives, no movie boxsets, no extras inside the torrent; NFOs/samples/screenshots only if the original release had them (an NFO may be attached on the upload page)",
      "- Single-file releases without a wrapping folder; season packs as one top-level folder",
      "- Subtitles muxed into the video; separate subtitle files do not belong in the torrent",
      "- MediaInfo (or BDInfo for full discs) and at least 3 full-resolution PNG screenshots required",
      "- Self-made releases must state the source, include complete MediaInfo and encoder settings/mux log",
      "- Remove references to other trackers or websites from uploads",
      "- No exact duplicates; other versions (resolution, source, type, codec, edition, audio, language) may coexist — no upload slots",
      "- Uploads from the User group go through the moderation queue; upload mistakes are not punished",
      "",
      "## Requests",
      "",
      "- One title per request, with a TMDB/TVDB/IMDb link; separate requests per season",
      "- A fulfilled request is expected to be downloaded and seeded for an extended period",
      "- Claimed requests must be fulfilled within 7 days unless staff grants an extension",
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
