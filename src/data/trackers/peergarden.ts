// src/data/trackers/peergarden.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const peergarden: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "peergarden",
  name: "PeerGarden",
  abbreviation: "PG",
  url: "https://peergarden.org",
  description:
    "Private general tracker for movies, TV, music, games, apps, books and audiobooks. Usually closed for signup. Runs Traxary, a UNIT3D-based codebase.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: [
    "Movies",
    "TV",
    "Anime",
    "Sports",
    "Music",
    "Games",
    "Apps",
    "Books",
    "Audiobooks",
  ],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#1f7906",
  logo: "",
  bonusName: "Beans",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  // The site lists Weed without saying when it applies. It is flagged as a
  // penalty class on the reading that it is where a ratio under 0.4 lands.
  // The separate upload-count groups (Trainee Uploader to L33T Uploader) run
  // alongside this ladder and are left out.
  userClasses: [
    {
      name: "Weed",
      requirements: "Lowest group, no requirements and no perks",
      outsideLadder: "below",
    },
    { name: "Seed", requirements: "Entry group, no requirements. Can send invites" },
    { name: "Seedling", requirements: "True upload ≥ 50 GiB" },
    { name: "Sprout", requirements: "True upload ≥ 500 GiB, age ≥ 30 days" },
    { name: "Sapling", requirements: "True upload ≥ 1 TiB, age ≥ 60 days" },
    { name: "Budding", requirements: "True upload ≥ 5 TiB, age ≥ 90 days" },
    { name: "Blooming", requirements: "True upload ≥ 10 TiB, age ≥ 180 days. 5% Beans discount" },
    {
      name: "Flowering",
      requirements:
        "True upload ≥ 50 TiB, 50 comments, 25 posts, age ≥ 365 days. 10% Beans discount",
    },
    {
      name: "Garden Elder",
      requirements:
        "True upload ≥ 100 TiB, 200 comments, 100 posts, age ≥ 730 days. 15% Beans discount",
    },
    {
      name: "Seed Vault",
      requirements:
        "Seed size ≥ 10 TiB, avg seedtime ≥ 60 days, age ≥ 90 days. H&R immune, global freeleech",
    },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    // The site clears a torrent at 48 hours of seeding or a 1:1 ratio on that
    // torrent. satisfactionMode is left off because minimumRatio holds the 0.4
    // account minimum, not that 1:1 per-torrent target.
    minimumRatio: 0.4,
    seedTimeHours: 48,
    loginIntervalDays: 90,
    hnrBanLimit: 3,
    fullRulesMarkdown: [
      "## Ratio",
      "",
      "- Keep your ratio above 0.4 at all times",
      "- Below it you lose access to downloading and are moved to a lower rank",
      "",
      "## Seeding / Hit & Run",
      "",
      "- Seed for at least 48 hours after the download finishes, or to a 1:1 ratio on that torrent",
      "- The rule applies once 5% of the torrent or 1 GB has been downloaded, whichever comes first",
      "- It applies to freeleech, green and burning torrents too",
      "- No partial seeding: past 5% downloaded, the full torrent must be seeded",
      "- A pre-warning is sent after 48 hours disconnected and a warning after 96 hours",
      "- 3 warnings revoke download rights; warnings expire after 10 days",
      "- Seed Vault members are immune to hit and runs",
      "",
      "## Account inactivity",
      "",
      "- An account that has not logged in for 90 days is disabled",
      "",
      "## Promotions",
      "",
      "- New torrents are Green for 24 hours: freeleech, with half of the upload counted",
      "- Burning torrents get freeleech and double upload for 24 hours",
      "- Featured torrents get freeleech and double upload for 7 days",
    ],
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: true,
  warningNote: "Unverified. Not tested against a live account.",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "/u/{username}",

  // ── Stats ───────────────────────────────────────────────────────────
  stats: {
    torrentCount: 27236,
    statsUpdatedAt: "2026-11-14",
  },
}
