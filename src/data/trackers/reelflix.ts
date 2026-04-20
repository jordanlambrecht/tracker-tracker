// src/data/trackers/reelflix.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const reelflix: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "reelflix",
  name: "ReelFliX",
  abbreviation: "RFX",
  url: "https://reelflix.cc",
  description:
    "General movie and TV tracker with a focus on high-quality encodes and a streamlined browsing experience.",

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d",
  apiPath: "/api/user",

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "Movies / TV",
  contentCategories: ["Movies", "TV"],
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#e50914",
  logo: "/tracker-logos/reelflix_logo.png",

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "",
  statusPageUrl: "",

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [
    { name: "Leech", requirements: "Timeout zone — DL Slots: 0" },
    { name: "User", requirements: "Upload ≥ 50 GiB; Ratio ≥ 0.80 — DL Slots: 1" },
    {
      name: "Member",
      requirements:
        "Upload ≥ 100 GiB; Ratio ≥ 0.90; Age ≥ 5 days; Avg. seedtime ≥ 1 day — DL Slots: 5",
    },
    {
      name: "Pro",
      requirements:
        "Upload ≥ 500 GiB; Ratio ≥ 1.00; Age ≥ 14 days; Avg. seedtime ≥ 5 days — DL Slots: 10, Request Torrents",
    },
    {
      name: "Expert",
      requirements:
        "Upload ≥ 1 TiB; Ratio ≥ 1.10; Age ≥ 30 days; Avg. seedtime ≥ 15 days — DL Slots: ∞, Request Torrents, Torrent Mod Bypass",
    },
    {
      name: "Elite",
      requirements:
        "Upload ≥ 2.5 TiB; Ratio ≥ 1.20; Age ≥ 90 days; Avg. seedtime ≥ 30 days — Send Invite, Invite Forums, Request Torrents, Torrent Mod Bypass",
    },
    {
      name: "Distributor",
      requirements:
        "Upload ≥ 5 TiB; Ratio ≥ 1.25; Age ≥ 180 days; Avg. seedtime ≥ 45 days; Seedsize ≥ 1 TiB — Refundable, Send Invite, Invite Forums, Request Torrents, Torrent Mod Bypass",
    },
    {
      name: "Curator",
      requirements:
        "Upload ≥ 10 TiB; Ratio ≥ 1.50; Age ≥ 365 days; Avg. seedtime ≥ 90 days; Seedsize ≥ 2.5 TiB — 25% Freeleech, Send Invite, Invite Forums, Request Torrents, Torrent Mod Bypass",
    },
    {
      name: "Archivist",
      requirements:
        "Upload ≥ 25 TiB; Ratio ≥ 1.75; Age ≥ 730 days; Avg. seedtime ≥ 180 days; Seedsize ≥ 5 TiB — 50% Freeleech, Send Invite, Invite Forums, Request Torrents, Torrent Mod Bypass",
    },
    {
      name: "Uploader",
      requirements:
        "Upload ≥ 500 GiB; Ratio ≥ 1.00; Age ≥ 14 days; Avg. seedtime ≥ 5 days; ≥ 25 uploads in last 30 days — Double Upload, Refundable, Send Invite, Invite Forums, Request Torrents, Torrent Mod Bypass",
    },
    {
      name: "Celebrity",
      requirements:
        "Staff — internal / staff from other respected trackers. Refundable, Send Invite, Invite Forums, Request Torrents, Torrent Mod Bypass",
    },
    {
      name: "Legend",
      requirements:
        "Staff — former internal / staff. 100% Freeleech, Send Invite, Invite Forums, Request Torrents, Torrent Mod Bypass",
    },
    {
      name: "Internal",
      requirements:
        "Staff — internal release group members of ReelFliX. 100% Freeleech, Send Invite, Invite Forums, Request Torrents, Torrent Mod Bypass",
    },
  ],
  releaseGroups: [],
  bannedGroups: [],
  notableMembers: [],

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0.8,
    seedTimeHours: 72,
    loginIntervalDays: 90,
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false,
  warningNote: "",

  // ── Flags ───────────────────────────────────────────────────────────
  draft: false,
  supportsTransitPapers: true,
  profileUrlPattern: "/users/{username}",
}
