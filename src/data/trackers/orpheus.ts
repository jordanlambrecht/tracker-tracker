// src/data/trackers/orpheus.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const orpheus: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "orpheus",
  name: "Orpheus",
  abbreviation: "OPS",
  url: "https://orpheus.network",
  description:
    "One of the largest and most prestigious private music trackers, Orpheus is renowned for its extensive library of high-quality music releases, active community, and strict quality standards.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "gazelle",
  gazelleEnrich: true,
  apiPath: "/ajax.php",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Music",
  contentCategories: ["Music"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#1daf8b",
  logo: "/tracker-logos/orpheus_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "orpheus",
  statusPageUrl: "https://ops.trackerstatus.info/",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    {
      name: "User",
      requirements: "Default class for new members. Must stay active",
    },
    {
      name: "Member",
      requirements: "10 GiB up, ratio ≥ 0.7, 1 week. Demoted to User below ratio 0.60",
      perks: [
        { type: "custom", label: "Advanced Search, requests, buy invites" },
        { type: "custom", label: "Basic torrent editing, auto-subscribe to forums" },
      ],
    },
    {
      name: "Power User",
      requirements:
        "25 GiB up, ratio ≥ 1.05, 2 weeks, 5 uploads. Demoted to Member below ratio 0.95 or under 5 uploads",
      perks: [
        { type: "custom", label: "Immune to inactivity pruning" },
        { type: "custom", label: "Notifications, RSS, collector, collages" },
        { type: "custom", label: "Upload/download/bonus history, PU forums and IRC" },
      ],
    },
    {
      name: "Elite",
      requirements:
        "100 GiB up, ratio ≥ 1.05, 4 weeks, 50 uploads. Demoted to Member below ratio 0.95",
      perks: [
        { type: "custom", label: "Invitations and Elite forums and IRC" },
        { type: "custom", label: "Edit torrents, rename personal collages" },
      ],
    },
    {
      name: "Torrent Master",
      requirements:
        "500 GiB up, ratio ≥ 1.05, 8 weeks, 500 uploads. Demoted to Member below ratio 0.95",
      perks: [{ type: "custom", label: "TM forums and IRC, custom title on request" }],
    },
    {
      name: "Power Torrent Master",
      requirements:
        "500 GiB up, ratio ≥ 1.05, 8 weeks, uploads in 500 unique groups. Demoted to Member below ratio 0.95",
    },
    {
      name: "Elite Torrent Master",
      requirements:
        "500 GiB up, ratio ≥ 1.05, 8 weeks, 500 perfect (100% log) FLACs. Demoted to Member below ratio 0.95",
      perks: [
        { type: "invite", label: "Unlimited invites" },
        { type: "custom", label: "ETM forums and IRC, edit Missing Lineage flag" },
      ],
    },
    {
      name: "Ultimate Torrent Master",
      requirements:
        "2 TB OPS-only upload, ratio ≥ 1.05, 8 weeks, 2000 perfect FLACs (one 24-bit per edition, no web). Demoted to Member below ratio 0.95",
      perks: [{ type: "custom", label: "Search past page 20" }],
    },
    {
      name: "Interviewer",
      requirements: "Selected by staff to interview and invite new members",
      outsideLadder: "above",
    },
    {
      name: "VIP",
      requirements: "Extraordinary contributions. Asking disqualifies",
      outsideLadder: "above",
    },
    {
      name: "Legend",
      requirements: "Past staff",
      outsideLadder: "above",
    },
    {
      name: "Archive Team",
      requirements: "Maintains seeding on low-seeded and orphaned uploads",
      outsideLadder: "above",
    },
    {
      name: "Beta Team",
      requirements: "Beta testers",
      outsideLadder: "above",
    },
    {
      name: "Charlie Team",
      requirements: "Quality assurance",
      outsideLadder: "above",
    },
    {
      name: "Designer",
      requirements: "Stylesheets and art direction",
      outsideLadder: "above",
    },
    {
      name: "First-Line Support",
      requirements: "Day-to-day site tasks and user support",
      outsideLadder: "above",
    },
    {
      name: "Forum Moderator",
      requirements: "Staff: moderates forums and torrent comments",
      outsideLadder: "above",
    },
    {
      name: "Production Manager",
      requirements: "Staff: moderates torrents and site content, supports secondary classes",
      outsideLadder: "above",
    },
    {
      name: "Technician",
      requirements: "Staff: designs and writes the site code",
      outsideLadder: "above",
    },
    {
      name: "Sound Engineer",
      requirements: "Staff: designs and writes the site code",
      outsideLadder: "above",
    },
    {
      name: "Roadie",
      requirements: "Staff: in charge of everything",
      outsideLadder: "above",
    },
    {
      name: "Torrent Celebrity",
      requirements: "Approved staff of other trackers OPS works closely with",
      outsideLadder: "above",
    },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.6,
    seedTimeHours: 72,
    loginIntervalDays: 120,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: true,
  profileUrlPattern: "/user.php?id={id}",
}
