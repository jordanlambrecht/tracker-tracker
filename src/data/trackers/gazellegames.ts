// src/data/trackers/gazellegames.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const gazellegames: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "gazellegames",
  name: "GazelleGames",
  abbreviation: "GGn",
  url: "https://gazellegames.net",
  description: "The largest gaming tracker, featuring console and PC content.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "ggn",
  apiPath: "/api.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Games",
  contentCategories: ["Games"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#7b1fa2",
  logo: "",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "gazelle-games",
  statusPageUrl: "https://ggn.trackerstatus.info/",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    { name: "Amateur", requirements: "Default starting class" },
    {
      name: "Gamer",
      requirements:
        "600 achievement points. Invites, requests, collections, Top 10, peerlists, mass downloader",
    },
    {
      name: "Pro Gamer",
      requirements:
        "1,200 achievement points. Edit unchecked groups, external links, item trading, inactivity immunity",
    },
    {
      name: "Elite Gamer",
      requirements:
        "2,100 achievement points. Edit any group/torrent/collection, delete tags, H&R immunity, contests",
    },
    {
      name: "Legendary Gamer",
      requirements: "3,000 achievement points. Full site log, site statistics, 2 invites/month",
    },
    {
      name: "Master Gamer",
      requirements:
        "4,200 achievement points. Delete/recover collections, re-seed requests, item statistics, 2 invites/month (max 4)",
    },
    {
      name: "Gaming God",
      requirements:
        "6,000 achievement points. Unlimited invites, torrent bump tool, IRC auto-voice",
    },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.6,
    seedTimeHours: 80,
    loginIntervalDays: 60,
    hnrBanLimit: 6,
    fullRulesMarkdown: [
      "## Golden Rules",
      "**1.** Do not defy the expressed wishes of the staff.",
      "**2.** Access is a privilege, not a right, and can be revoked for any reason. Staff decisions are final.",
      "**3.** One account per person per lifetime. Additional accounts → ban.",
      "**4.** Do not post .torrent files on other sites — your passkey is embedded. Auto-disable if shared. Sharing content itself is fine.",
      "**5.** Torrents seeding here must only contain GGn's tracker URL. Adding other tracker URLs causes incorrect data and leads to cheating disables.",
      "**6.** Maintain an acceptable share ratio. Seed until sufficient other seeders exist.",
      "**7.** Do not browse via proxies, VPNs, or TOR unless using a private dedicated VPN per the VPN Usage Rules.",
      "**8.** Trading/selling invites is strictly prohibited, including offering them publicly on other trackers or chat groups.",
      "**9.** Trading, selling, sharing, or giving away your account is prohibited.",
      "**10.** Shared IP/computer with another account holder inherently links both accounts — rule violations on one disable both.",
      "**11.** Attempting to find or exploit site bugs is the worst possible offense. Results in banning you, your inviter, and their entire invite tree.",
      "**12.** Do not use automated scripts to scrape, browse, or refresh site HTML. Do not manually refresh to farm item drops. Use the API instead.",
      "**13.** Report rule violations — ignoring them damages the community.",
      "**14.** Respect other sites' wishes regarding linking or naming them.",
      "",
      "## Ratio System",
      "Required ratio is dynamic, calculated from your **Share Score** (influenced by seeding count, torrent size, and seed duration). Starts at 0.00 and rises as you download more. Maximum required ratio is **0.60** (at 260+ GB downloaded with Share Score below 5). Share Score ≥ 5 dramatically lowers required ratio; Share Score ≥ 12 makes it 0.00 for all download tiers.",
      "",
      "| Downloaded | Req. Ratio (0 SS) | Req. Ratio (5 SS) | Req. Ratio (12 SS) |",
      "|---|---|---|---|",
      "| 0-10 GB | 0.00 | 0.00 | 0.00 |",
      "| 10-25 GB | 0.15 | 0.00 | 0.00 |",
      "| 25-50 GB | 0.20 | 0.00 | 0.00 |",
      "| 50-75 GB | 0.30 | 0.05 | 0.00 |",
      "| 75-100 GB | 0.40 | 0.10 | 0.00 |",
      "| 100-140 GB | 0.50 | 0.20 | 0.00 |",
      "| 140-180 GB | 0.60 | 0.30 | 0.00 |",
      "| 180-220 GB | 0.60 | 0.40 | 0.00 |",
      "| 220-260 GB | 0.60 | 0.50 | 0.00 |",
      "| 260+ GB | 0.60 | 0.60 | 0.00 |",
      "",
      "**Ratio watch:** Triggered when ratio falls below required ratio (after first 5 GB downloaded). 2-week grace period. Downloading 10 GB while on ratio watch auto-disables leeching. To recover: upload more or seed more to lower required ratio; must seed 72 hours within a week, then leeching restored once ratio ≥ required (checked daily).",
      "",
      "## Hit 'n' Runs",
      "Minimum seed time: **80 hours** (3 days 8 hours) per snatched torrent (or ≥ 50% downloaded). Seed time accrues across sessions. Elite Gamer+ class is immune. HNRs can be cleared by seeding to minimum or purchasing HNR Removal from the shop.",
      "",
      "**HNR watch:** 6 HNRs → no downloading until all are cleared. Downloading with 6 HNRs auto-disables leeching.",
      "",
      "## Upload Speed",
      "Throttling upload speed to an unfair level (relative to download speed) results in warning or permanent ban. Enforced automatically.",
    ],
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: true,
  profileUrlPattern: "/user.php?id={id}",
}
