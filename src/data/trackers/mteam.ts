// src/data/trackers/mteam.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const mteam: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "mteam",
  name: "M-Team",
  abbreviation: "MT",
  url: "https://kp.m-team.cc",
  description: "Chinese private tracker covering movies, TV, music, games, anime and more.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "mteam",
  apiPath: "/api/member/profile",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "General",
  contentCategories: [
    "Movies",
    "TV",
    "Music",
    "Games",
    "Anime",
    "Sports",
    "Books",
    "Audiobooks",
    "Apps",
    "Documentaries",
    "Education",
  ],
  language: "Chinese",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#2F80ED",
  logo: "/tracker-logos/mteam_logo.png",
  bonusName: "Bonus Points",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  // The rules page confirms the nine ladder classes and VIP. It does not name
  // the administrative roles, so they are deliberately absent here.
  userClasses: [
    {
      name: "User",
      requirements: "Entry class",
      perks: [
        { type: "custom", label: "Post candidates" },
        { type: "custom", label: "Fun Box access" },
        { type: "custom", label: "Spend Bonus Points" },
      ],
    },
    {
      name: "Power User",
      requirements: "Registered > 4 weeks, download > 200 GB, ratio > 2 (demoted below 1.9)",
      perks: [
        { type: "custom", label: "Post candidates" },
        { type: "custom", label: "Fun Box access" },
        { type: "custom", label: "Spend Bonus Points" },
      ],
    },
    {
      name: "Elite User",
      requirements: "Registered > 8 weeks, download > 400 GB, ratio > 3 (demoted below 2.9)",
      perks: [
        { type: "invite", label: "Send Invite" },
        { type: "custom", label: "Post candidates" },
        { type: "custom", label: "Spend Bonus Points" },
      ],
    },
    {
      name: "Crazy User",
      requirements: "Registered > 12 weeks, download > 500 GB, ratio > 4 (demoted below 3.9)",
      perks: [
        { type: "invite", label: "Send Invite" },
        { type: "custom", label: "Post candidates" },
        { type: "custom", label: "Spend Bonus Points" },
      ],
    },
    {
      name: "Insane User",
      requirements: "Registered > 16 weeks, download > 800 GB, ratio > 5 (demoted below 4.9)",
      perks: [
        { type: "invite", label: "Send Invite" },
        { type: "custom", label: "Post candidates" },
        { type: "custom", label: "Spend Bonus Points" },
      ],
    },
    {
      name: "Veteran User",
      requirements: "Registered > 20 weeks, download > 1000 GB, ratio > 6 (demoted below 5.9)",
      perks: [
        { type: "invite", label: "Send Invite" },
        { type: "custom", label: "Permanent retention when archived" },
        { type: "custom", label: "Spend Bonus Points" },
      ],
    },
    {
      name: "Extreme User",
      requirements: "Registered > 24 weeks, download > 2000 GB, ratio > 7 (demoted below 6.9)",
      perks: [
        { type: "invite", label: "Send Invite" },
        { type: "custom", label: "Permanent account retention" },
        { type: "custom", label: "Spend Bonus Points" },
      ],
    },
    {
      name: "Ultimate User",
      requirements: "Registered > 28 weeks, download > 2500 GB, ratio > 8 (demoted below 7.9)",
      perks: [
        { type: "invite", label: "Send Invite" },
        { type: "custom", label: "Permanent account retention" },
        { type: "custom", label: "Spend Bonus Points" },
      ],
    },
    {
      name: "mTorrent Master",
      requirements: "Registered > 32 weeks, download > 3000 GB, ratio > 9 (demoted below 8.9)",
      perks: [
        { type: "invite", label: "Send Invite" },
        { type: "custom", label: "Permanent account retention" },
        { type: "custom", label: "Spend Bonus Points" },
      ],
    },
    { name: "VIP", requirements: "Donation", outsideLadder: "above" },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    // Ratio requirements are tiered by download volume, from 0.6 above 10 GB
    // up to 1.0 above 500 GB; 1.0 is the strictest tier used for alerts.
    minimumRatio: 1.0,
    seedTimeHours: 0,
    loginIntervalDays: 40,
    fullRulesMarkdown: [
      "## Newbie assessment",
      "",
      "- Within the first 30 days: upload > 30 GB, download > 15 GB and more than 6000 Bonus Points earned from seeding",
      "- Failing any one item bans the account",
      "- Under 30 days old with more than 10 GB downloaded and ratio below 0.3 is an immediate ban",
      "- Do not spend Bonus Points near the assessment deadline; the system may read it as failing the assessment",
      "",
      "## Account retention",
      "",
      "- No traffic (0 upload and 0 download) after 5 days: account deleted",
      "- 40 consecutive days without login: account deleted (90 days if the account is archived)",
      "- Veteran User and above keep an archived account permanently; Extreme User and above are retained permanently",
      "- A banned account is cleared after 15 days (immediately if it was already inactive for 40 days)",
      "- Logging in means opening the site in a browser; seeding or third-party tools do not count",
      "",
      "## Ratio",
      "",
      "- Below 0.6 with more than 10 GB downloaded",
      "- Below 0.7 with more than 50 GB downloaded",
      "- Below 0.8 with more than 100 GB downloaded",
      "- Below 0.9 with more than 200 GB downloaded",
      "- Below 1.0 with more than 500 GB downloaded",
      "- A breach starts a 5-day warning period; no improvement means a ban",
      "- Accounts under 30 days old with more than 10 GB downloaded and ratio below 0.3 are banned immediately",
      "",
      "## Classes",
      "",
      "- Power User: 4 weeks, 200 GB downloaded, ratio 2 (demoted below 1.9)",
      "- Elite User: 8 weeks, 400 GB, ratio 3 (below 2.9)",
      "- Crazy User: 12 weeks, 500 GB, ratio 4 (below 3.9)",
      "- Insane User: 16 weeks, 800 GB, ratio 5 (below 4.9)",
      "- Veteran User: 20 weeks, 1000 GB, ratio 6 (below 5.9)",
      "- Extreme User: 24 weeks, 2000 GB, ratio 7 (below 6.9)",
      "- Ultimate User: 28 weeks, 2500 GB, ratio 8 (below 7.9)",
      "- mTorrent Master: 32 weeks, 3000 GB, ratio 9 (below 8.9)",
      "- All three conditions must be met; dropping below the demotion line demotes automatically",
      "",
      "## Warnings and bans",
      "",
      "- Warnings last 1-8 weeks; a second warning during a warning period is a ban",
      "- Three accumulated warnings are a ban",
      "- Direct bans include multiple accounts, account or Bonus Point trading, cheating, stolen accounts and invite trading",
      "- Sharing torrents or passkeys, malicious throttling, mismatched subtitles and redistribution can warn or ban",
      "- Using a downloader not on the official list is a ban",
      "- Abuse, advertising, political statements and harassment can warn or ban",
      "- Invitation trading bans the whole downstream invite chain; the upstream inviter is not pursued",
      "",
      "## Registration and security",
      "",
      "- Accepted email providers: Gmail, QQ and Foxmail",
      "- Members must be 18 or older",
      "- Two-step verification is strongly recommended; an account stolen without it is banned",
      "- Keep proof of invitation; spot checks are irregular",
      "- Maximum upload speed per torrent is 1 Gbps",
      "- There is no paid unban; VIPs must follow the rules",
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
