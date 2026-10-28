// src/data/trackers/myanonamouse.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const myanonamouse: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "myanonamouse",
  name: "MyAnonaMouse",
  abbreviation: "MAM",
  url: "https://www.myanonamouse.net",
  description:
    "Book, audiobook, and comics tracker with an open interview for anyone who wants to join and an extremely friendly community.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "mam",
  apiPath: "/jsonLoad.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Books / Audiobooks",
  contentCategories: ["Books", "Audiobooks", "Comics"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#ec407a",
  logo: "/tracker-logos/myanonamouse_logo.png",
  bonusName: "Bonus",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "my-anona-mouse",
  statusPageUrl: "https://status.myanonamouse.net/",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    { name: "Mouse", requirements: "Ratio below 1.0 (auto-demotion)", outsideLadder: "below" },
    { name: "User", requirements: "Ratio above 1.0" },
    {
      name: "Power User",
      requirements: "4 weeks membership, 25 GB uploaded, 2.0 ratio",
      perks: [
        { type: "custom", label: "Other Torrent Sites access" },
        { type: "custom", label: "Invites section: 6 months + 1 TiB" },
      ],
    },
    { name: "Star", requirements: "Donor", outsideLadder: "above" },
    {
      name: "VIP",
      requirements: "Bonus points or donation (requires Power User first)",
      perks: [{ type: "custom", label: "VIP freeleech torrents" }],
      outsideLadder: "above",
    },
    {
      name: "Elite VIP",
      requirements: "Donated 100 EUR, or granted at staff discretion",
      outsideLadder: "above",
    },
    {
      name: "Elite",
      requirements: "Staff-selected, immune to auto-demotion",
      outsideLadder: "above",
    },
    { name: "Supporter", requirements: "Continuous supporter", outsideLadder: "above" },
    { name: "Mouseketeer", requirements: "Retired staff", outsideLadder: "above" },
    {
      name: "Uploader",
      requirements: "Staff-selected for consistent monthly uploads",
      perks: [{ type: "custom", label: "Immune to auto-demotion" }],
      outsideLadder: "above",
    },
  ],
  stats: {
    userCount: 114812,
    torrentCount: 1128625,
    statsUpdatedAt: "2026-03-26",
  },
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 1.0,
    seedTimeHours: 72,
    loginIntervalDays: 120,
    fulfillmentPeriodHours: 720,
    fullRulesMarkdown: [
      "## Account & IP",
      "",
      "- One account per person and per IP address; members sharing an IP must share one account",
      "- Multiple accounts disable every account on that IP",
      "- Report commercial seedboxes and VPN providers to staff; the VPN must be always-on with a semi-stable IP and must not be browser-only",
      "- TOR and similar networks are forbidden on the site, tracker and IRC",
      "- Log in regularly; park the account in preferences when away to avoid inactivity disabling",
      "",
      "## Ratio & seeding",
      "",
      "- Every member must keep a global ratio of at least 1.0",
      "- Seed each download for 72 hours within 30 days; the clock starts after completion",
      "- Not seeding is a Hit & Run and can remove download access or ban the account",
      "- Partial downloads are not allowed and never satisfy a torrent",
      "- Bonus points are earned by seeding and capped at 99,999",
      "- Freeleech Wedges make a non-VIP torrent free for your ratio but still require the 72 hours",
      "",
      "## Unsatisfied torrent limits",
      "",
      "- New members (under 2 weeks): 20 unsatisfied",
      "- User: 50",
      "- Power User: 100",
      "- VIP: 150",
      "- Above VIP: 200",
      "- Hitting the limit blocks downloads until a slot frees",
      "",
      "## Classes",
      "",
      "- Mouse: auto-demoted below ratio 1.0",
      "- User: ratio above 1.0",
      "- Power User: 4 weeks, 25 GiB uploaded, ratio 2.0; auto-demoted below 2.0",
      "- Star: donor; VIP: bought or donated, requires Power User first",
      "- Elite VIP: donated 100 EUR; Elite, Supporter, Mouseketeer and Uploader are staff-granted",
      "",
      "## Clients & downloads",
      "",
      "- Only whitelisted clients and versions; auto-update must be off and mobile clients are not allowed",
      "- Share downloaded content freely, but never re-upload MAM .torrent files",
      "",
      "## Uploads",
      "",
      "- No video; uploads are limited to 20 GiB",
      "- Forbidden: archives (except .cbr/.cbz), executables, DRM or passworded files, AI-generated narration and public-domain content such as Project Gutenberg",
      "- Collections are restricted to the cases listed in the rules",
      "- Forbidden authors include J.R.R. Tolkien, Anne Perry and the other names listed on the rules page",
      "- Uploaders must seed their upload until at least 3 other members are seeding",
      "",
      "## Requests",
      "",
      "- Request credits per month: User 1, Power User 2, VIP 4, Elite VIP and above 10",
      "- Every 5 uploads earns one extra request; requests expire after 3 months",
      "- Reseed requests must be made from the torrent page",
      "",
      "## Automation & security",
      "",
      "- Only automation listed in the API documentation is allowed; bots, scraping and AI browser agents are forbidden",
      "- Never give your credentials to a person, AI assistant or script; API tools authenticate with a mam_id generated in Security preferences",
      "",
      "## Conduct",
      "",
      "- No swearing, hate speech, rudeness or offensive behaviour anywhere, including IRC",
      "- English only in public chat; no politics or religion",
      "- No spamming, flaming, begging for points or invites, or backseat moderating",
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
