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
    fullRulesMarkdown: [
      "## Seeding & Hit & Run",
      "",
      "- Seed every download for 72 hours within 10 days; seed time is cumulative",
      "- Reaching 1:1 clears the H&R immediately",
      "- An H&R cleanup token from the Bonus Shop also clears one",
      "- Do not delete, move or rename files before 72 hours",
      "- Uploaders must seed their own uploads until at least 3 members have a complete copy",
      "- Repeated or unresolved H&Rs lead to a warning, download restrictions, then a ban",
      "",
      "## Content",
      "",
      "- Animation only: cartoons, animated series and films, anime, stop-motion, claymation, puppetry and CGI",
      "- No live-action, music, games, software, e-books or comics",
      "- Sexually explicit content is an immediate permanent ban",
      "- No RAR/ZIP archives, executables, ads or misleading files",
      "- Search before uploading; exact duplicates are removed",
      "",
      "## Account",
      "",
      "- One account per person; no sharing, selling or trading accounts or invites",
      "- You are responsible for your invitees",
      "- Keep your email current; two-factor authentication is strongly recommended",
      "- 90 days without login triggers reminders and a pause; login within 180 days reactivates",
      "",
      "## Tracker & Client",
      "",
      "- .torrent files and your passkey are personal; never share them or upload RetroToon torrents elsewhere",
      "- Use a well-known, unmodified client; no DHT or PEX on RetroToon torrents",
      "- Faking stats is an immediate ban",
      "- Seedboxes and VPNs are allowed, but you are responsible for the account",
      "",
      "## Conduct",
      "",
      "- No insults, harassment, hate speech, threats, trolling or spam",
      "- Do not beg for invites, upload credit, bonus points or specific uploads",
      "- Do not advertise other trackers or post personal information",
      "- Report broken torrents or rule violations instead of arguing in comments",
      "- Respect staff decisions",
      "",
      "## Enforcement",
      "",
      "- A reminder or edit, official warning, loss of privileges, temporary or permanent ban",
      "- [STRICT] rules can skip straight to a ban",
    ],
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
