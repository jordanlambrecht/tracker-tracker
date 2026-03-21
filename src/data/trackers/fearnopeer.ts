// src/data/trackers/fearnopeer.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const fearnopeer: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "fearnopeer",
  name: "FearNoPeer",
  abbreviation: "FNP",
  url: "https://fearnopeer.com",
  description:
    "Community-built Movie/TV/FANRES database with a strong focus on HD content. Experienced staff, proactive userbase, and a security-focused codebase. No donation pestering.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General / HD content / FANRES",
  contentCategories: [
    "Movies",
    "TV",
    "Anime",
    "Music",
    "Games",
    "Apps",
    "Sports",
    "Tutorials",
    "Fanres",
  ],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#f59e0b",
  logo: "/tracker-logos/fearnopeer_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "fear-no-peer",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    // Dynamic — upload-based
    {
      name: "Leech",
      requirements: "Ratio below 0.8 — download, request, chat, and forum privileges revoked",
    },
    { name: "User", requirements: "Ratio ≥ 0.8. 7 download slots" },
    {
      name: "PowerUser",
      requirements: "Upload ≥ 1 TiB, ratio ≥ 0.8, age ≥ 1 month. 13 download slots, invite sending",
    },
    {
      name: "SuperUser",
      requirements:
        "Upload ≥ 5 TiB, ratio ≥ 0.8, age ≥ 2 months. 17 download slots, torrent mod bypass",
    },
    {
      name: "ExtremeUser",
      requirements:
        "Upload ≥ 20 TiB, ratio ≥ 0.8, age ≥ 3 months, seed size ≥ 1.5 TiB, 5+ uploads. 25 download slots",
    },
    {
      name: "InsaneUser",
      requirements:
        "Upload ≥ 50 TiB, ratio ≥ 0.8, age ≥ 6 months, seed size ≥ 1.5 TiB, 5+ uploads. 30 download slots",
    },
    {
      name: "Veteran",
      requirements:
        "Upload ≥ 100 TiB, ratio ≥ 0.8, age ≥ 1 year, seed size ≥ 5 TiB, avg seedtime ≥ 30 days. 70 download slots, freeleech, H&R immune",
    },
    // Dynamic — seed-based
    {
      name: "Seeder",
      requirements:
        "Seed size ≥ 16 TiB, ratio ≥ 0.8, age ≥ 2 months, avg seedtime ≥ 30 days. 70 download slots, H&R immune",
    },
    {
      name: "Curator",
      requirements:
        "Seed size ≥ 16 TiB, ratio ≥ 0.8, age ≥ 2 months, avg seedtime ≥ 60 days. 70 download slots, H&R immune",
    },
    {
      name: "Archivist",
      requirements:
        "Seed size ≥ 20 TiB, ratio ≥ 0.8, age ≥ 3 months, avg seedtime ≥ 90 days. 75 download slots, freeleech, 2x upload, H&R immune",
    },
    // Donation classes
    {
      name: "V.I.P.",
      requirements: "Donation — freeleech, 2x upload, H&R immune. 35 download slots",
    },
    {
      name: "Diamond V.I.P.",
      requirements: "Donation — freeleech, 2x upload, H&R immune. 500 download slots",
    },
    {
      name: "Jedi",
      requirements: "Lifetime VIP — freeleech, 2x upload, H&R immune. 500 download slots",
    },
    {
      name: "Sith",
      requirements: "Lifetime VIP — freeleech, 2x upload, H&R immune. 500 download slots",
    },
    // Staff-picked
    {
      name: "Trustee",
      requirements:
        "Staff — seasoned veterans of other sites. 50 download slots, freeleech, H&R immune",
    },
    {
      name: "Encoders",
      requirements:
        "Staff — reputable encoders with personal encoding releases. Freeleech, 2x upload, H&R immune",
    },
    {
      name: "Nova Uploader",
      requirements: "Staff — first tier hand-selected uploader. Freeleech, 2x upload",
    },
    {
      name: "Pulse Uploader",
      requirements: "Staff — second tier uploader, continuous contributions. Freeleech, H&R immune",
    },
    {
      name: "Omega Uploader",
      requirements:
        "Staff — third tier, peak dedication. 100 download slots, freeleech, 2x upload, H&R immune",
    },
    {
      name: "Internal",
      requirements:
        "Staff — in-house release group members. 75 download slots, freeleech, 2x upload, H&R immune",
    },
    { name: "Editor", requirements: "Staff — polishes torrent names and metadata" },
    { name: "Torrent Moderator", requirements: "Staff — enforces upload rules, moderates queue" },
  ],
  releaseGroups: ["EiNSTEIN_SiR23", "onlyfaffs", "POLAR", "SM737"],
  bannedGroups: [
    "4K4U",
    "BiTOR",
    "d3g",
    "FGT",
    "FRDS",
    "FTUApps",
    "GalaxyRG",
    "LAMA",
    "MeGusta",
    "NeoNoir",
    "PSA",
    "RARBG",
    "YAWNiX",
    "YTS",
    "YIFY",
    "x0r",
  ],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.8,
    seedTimeHours: 0,
    loginIntervalDays: 150,
    fulfillmentPeriodHours: 120,
    fullRulesMarkdown: [
      "Ratio",
      "• Minimum ratio: 0.8 to continue downloading",
      "• Falling below 0.8 → lose download, request, chat, and forum privileges",
      "• Privileges restored after ratio rises above 0.8 (evaluated daily at midnight UTC)",
      "• No minimum seeding time requirement, but long-term seeding encouraged",
      "• Buffer = how much more you can download before dropping below 0.8",
      "",
      "Uploading",
      "• Must seed uploads for 120 hours (5 days) or until 3+ seeds/snatches",
      "• No RAR archives; MKV or MP4 containers only for video",
      "• No movie boxsets — separate each movie individually",
      "• TV complete packs only for ended series; all seasons required, no partial packs",
      "• Single episodes only for currently airing seasons",
      "• No pornographic/XXX content (erotica with valid IMDB/TMDB ID is allowed)",
      "• Do not upload internal releases from other trackers if disallowed by that tracker",
      "• Wait for previous upload to have 2 seeders before submitting next (if <100 Mbps upload)",
      "• Minimum 3 screenshots required for video uploads",
      "• MediaInfo required for Movie/TV/Anime; BDInfo required for full disc uploads",
      "• Foreign language uploads allowed; English subs encouraged if retail available",
      "• Original release tags must not be changed unless content heavily modified",
      "",
      "Earning Ratio",
      "• Seed long-term for BON → redeem for upload credit (bulk is better value)",
      "• Freeleech torrents don't count against download; featured ones give 2x upload",
      "• Cross-seed from other trackers",
      "• Upload new content (check requests page)",
      "• Donate for global freeleech + 2x upload perks",
      "",
      "Account Rules",
      "• One account per person per lifetime",
      "• Inactive accounts disabled after 150 days with no login (Seeder+ and VIP Tier 2+ exempt)",
      "• Stat manipulation → immediate permanent ban",
      "• English only for public site interactions",
      "• VPN and seedbox use encouraged for privacy",
      "",
      "Inviting",
      "• No selling/trading/brokering invites — permanent ban to entire invite tree",
      "• You are accountable for your invitees' actions",
      "• Invite forum access: VIP Tier 2, Seeder, and above",
      "",
      "Requests",
      "• One title per request; no boxsets or multi-season packs",
      "• Requester and fulfiller encouraged to seed as long as possible",
      "• No duplicate requests — search first, then vote on existing ones",
      "• Reseed requests do not belong on the Requests page",
      "• Claims must be fulfilled within 7 days",
    ].join("\n"),
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: true,
  profileUrlPattern: "/users/{username}",

  // ── Stats (omit this block entirely if no real data is available) ───
  stats: {
    userCount: 42892,
    activeUsers: 21921,
    torrentCount: 257404,
    seedSize: "23.72 PiB",
    statsUpdatedAt: "March 2026",
  },
}
