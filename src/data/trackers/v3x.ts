// src/data/trackers/v3x.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"
import { v3xUserClasses } from "@/data/v3x-levels"

export const v3x: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "v3x",
  name: "V3X",
  abbreviation: "V3X",
  url: "https://v3x.club",
  description: "French private tracker for movies, TV, audio, books, games and general content.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "v3x",
  apiPath: "/api/me",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: ["Movies", "TV", "Music", "Books", "Games", "Anime", "Documentaries", "Apps"],
  language: "French",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#FF5A1F",
  logo: "/tracker-logos/v3x_logo.png",
  bonusName: "Points",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",
  // announce.v3x.club already matches through the site's own domain
  announceHosts: ["v3x.tw"],

  // ── Community ───────────────────────────────────────────────────────
  // Figurant N1 to Palme d'Or N100: the site names every level, like C411's grades.
  userClasses: v3xUserClasses(),
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    // The site blocks downloads below 0.5 and warns at 0.7; 0.5 is the
    // hard floor the health alert can represent.
    minimumRatio: 0.5,
    seedTimeHours: 48,
    loginIntervalDays: 0,
    fulfillmentPeriodHours: 336,
    hnrBanLimit: 3,
    fullRulesMarkdown: [
      "## Ratio",
      "",
      "- Aim for a ratio of at least 1",
      "- The site warns at 0.7 and blocks new downloads below 0.5",
      "- Seed what you download for as long as possible",
      "",
      "## Seeding & H&R",
      "",
      "- Seed each download for 2 days within 14 days, or reach ratio 1",
      "- 3 active H&R records lead to a one-week suspension",
      "",
      "## Freeleech & points",
      "",
      "- Torrents of 100 GiB and larger are permanently freeleech",
      "- Members can put a release on freeleech for 7 days (progressive token price)",
      "- Seeding earns bonus points, spendable in the shop",
      "",
      "## Community",
      "",
      "- No insults, harassment, racism, sexism or hate",
      "- Sharing a member's personal information is an immediate ban",
      "- No account, invite or ratio trading; one account per person",
      "- Cheating with a modified client or fake upload reports is a ban",
      "",
      "## Sponsorship",
      "",
      "- A guest banned for cheating costs you invite rights for six months",
      "- A second cheating guest costs them permanently; your account is safe",
      "- Proven collusion bans you too",
      "",
      "## Sanctions",
      "",
      "- Warnings stay active for six months",
      "- After three active warnings the account is suspended for one week",
      "",
      "## Levels",
      "",
      "- XP comes from daily missions, daily login, comments and seeding",
      "- Levelling from L to L+1 costs 400 + (L-1)x140 + (L-1)^2x12 XP",
      "- At level 100 prestige resets you to level 1 with an extra star",
    ],
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: false,
  profileUrlPattern: "/u/{username}",
}
