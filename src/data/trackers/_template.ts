// src/data/trackers/_template.ts
//
// Copy this file to add a new tracker to the registry.
//
// 1. Duplicate this file and rename it to your tracker's slug (e.g. mytracker.ts)
// 2. Fill in the fields below — see inline comments for guidance
// 3. Export from src/data/trackers/index.ts (add to the barrel + ALL_TRACKERS array)
// 4. Run `pnpm test` to validate your entry
//
// Set draft: true while the entry is incomplete. Draft trackers skip strict
// validation in CI, so you can submit a PR with partial data.
//
// Content categories must be from the allowed list:
//   Movies, TV, Music, Games, Apps, Sports, Books, Audiobooks, Comics,
//   Manga, Anime, XXX, Documentaries, Education, Tutorials, Fanres,
//   iOS Apps, Graphics, Audio

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const mytracker: TrackerRegistryEntry = {
  // ── Required ────────────────────────────────────────────────────────
  slug: "mytracker", // lowercase, hyphens only (e.g. "my-tracker")
  name: "My Tracker", // display name
  url: "https://mytracker.example", // base URL (https only)
  description: "TODO", // 1-2 sentence overview
  platform: "unit3d", // "unit3d" | "gazelle" | "ggn" | "nebulance" | "custom"
  apiPath: "/api/user", // must match platform default (unit3d: "/api/user", gazelle: "/ajax.php")
  specialty: "", // what the tracker is known for (e.g. "HD Movies", "Anime")
  contentCategories: [], // see allowed list above
  color: "#00d4ff", // hex accent color for the tracker's detail page

  // ── Optional (fill in what you know) ────────────────────────────────
  abbreviation: undefined, // short code (e.g. "ATH", "RED")
  language: "English",
  logo: undefined, // "/tracker-logos/mytracker_logo.svg" — file must exist in public/
  trackerHubSlug: undefined, // slug on trackerhub.xyz, if listed
  statusPageUrl: undefined, // external status page URL

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0, // 0 = no minimum
    seedTimeHours: 0, // 0 = no minimum
    loginIntervalDays: 0, // 0 = no login interval policy
    // fulfillmentPeriodHours: undefined, // hours to complete H&R seeding
    // hnrBanLimit: undefined,            // number of H&Rs before ban
    // fullRulesMarkdown: undefined,      // detailed rules as markdown string
  },

  // ── Community data (arrays can be empty) ────────────────────────────
  userClasses: [], // [{ name: "Power User", requirements: "Upload ≥ 100 GiB" }]
  releaseGroups: [], // [{ name: "GrpName", description: "Encodes" }] or ["GrpName"]
  notableMembers: [],
  bannedGroups: [],

  // ── Stats (leave undefined if unknown) ──────────────────────────────
  stats: {
    userCount: undefined,
    torrentCount: undefined,
  },

  // ── Flags ───────────────────────────────────────────────────────────
  draft: true, // remove once all required fields are filled in
}
