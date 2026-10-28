// src/data/trackers/animebytes.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const animebytes: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "animebytes",
  name: "AnimeBytes",
  abbreviation: "AB",
  url: "https://animebytes.tv",
  description:
    "Huge archive of anime with great retention. Organization isn't as good as many other top trackers.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "animebytes",
  apiPath: "/api/stats/personal",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Anime",
  contentCategories: ["Anime", "Manga", "Music"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#ff7043",
  logo: "/tracker-logos/animebytes_logo.png",
  bonusName: "Yen",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "anime-bytes",
  statusPageUrl: "https://status.animebytes.tv/",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    {
      name: "Aka-chan",
      requirements: "Default class for new members",
      perks: [{ type: "custom", label: "Basic site features" }],
    },
    {
      name: "User",
      requirements: "1 week, 10.5 GB up, one non-freeleech torrent snatched, ratio ≥ 0.5",
      perks: [
        { type: "invite", label: "Send invites" },
        { type: "custom", label: "Create collages, edit Knowledge Base articles" },
        { type: "custom", label: "Self-manage Approved IPs" },
      ],
    },
    {
      name: "Power User",
      requirements: "2 weeks, 10 uploads, 25 GB up, ratio ≥ 0.7",
      perks: [
        { type: "invite", label: "Power User and Invites forums, receive invites" },
        { type: "custom", label: "Exempt from inactivity pruning" },
        { type: "custom", label: "Notifications, user-based requests, forum signature" },
        { type: "custom", label: "Edit anime group info" },
      ],
    },
    {
      name: "Elite",
      requirements: "1 month, 50 uploads, 100 GB up, ratio ≥ 0.8",
      perks: [
        { type: "custom", label: "Elite forum, #elite" },
        { type: "custom", label: "Edit music group info" },
      ],
    },
    {
      name: "Torrent Master",
      requirements: "3 months, 100 uploads, 500 GB up, ratio ≥ 0.9",
      perks: [
        { type: "invite", label: "Send invites even above the user limit" },
        { type: "custom", label: "Torrent Master forum, moderate collages and screenshots" },
        { type: "custom", label: "Free custom title" },
      ],
    },
    {
      name: "Legend",
      requirements: "6 months, 500 uploads, 1 TB up, ratio ≥ 1.0",
      perks: [
        { type: "custom", label: "Legend forum, free custom icon, free requests" },
        { type: "custom", label: "Undisclosed perks" },
      ],
    },
    {
      name: "VIP",
      requirements: "Appointed by staff for significant contributions",
      perks: [
        { type: "invite", label: "Unlimited invites" },
        { type: "custom", label: "Undisclosed perks" },
      ],
      outsideLadder: "above",
    },
    {
      name: "Staff",
      requirements: "Current AnimeBytes staff",
      perks: [{ type: "custom", label: "Undisclosed perks and responsibilities" }],
      outsideLadder: "above",
    },
    { name: "Sensei", requirements: "Retired AnimeBytes staff", outsideLadder: "above" },
    {
      name: "Editor",
      requirements:
        "Secondary: 3+ months, actively contributes quality torrent information. Maintains descriptions and group/series pages",
      outsideLadder: "above",
    },
    {
      name: "Forum Staff",
      requirements:
        "Secondary: 3+ months, active on the forums and reports posts/threads. Moderates forum sections",
      outsideLadder: "above",
    },
    {
      name: "App Reviewer",
      requirements: "Secondary, undisclosed requirements. Reviews invite applications",
      outsideLadder: "above",
    },
    {
      name: "Torrent Support",
      requirements: "Secondary, undisclosed requirements. Assists staff with the torrents section",
      outsideLadder: "above",
    },
    {
      name: "First Line Support",
      requirements:
        "Secondary, undisclosed requirements. Assists staff with non-user-facing functions",
      outsideLadder: "above",
    },
    {
      name: "Community Celebrity",
      requirements: "Secondary: full staff at another tracker that meets AnimeBytes' requirements",
      perks: [
        { type: "invite", label: "Unlimited invites" },
        { type: "custom", label: "Community Celebrity forum" },
      ],
      outsideLadder: "above",
    },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.2,
    seedTimeHours: 72,
    loginIntervalDays: 90,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: true,
  warningNote: "Unvalidated",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: true,
  profileUrlPattern: "/user.php?id={id}",
}
