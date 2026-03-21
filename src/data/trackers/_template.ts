// src/data/trackers/_template.ts
//
// Copy this file to add a new tracker to the registry.
//
// 1. Duplicate this file and rename it to your tracker's slug (e.g. mytracker.ts)
// 2. Fill in all fields below — every field must be present (use "" / [] / false
//    rather than omitting). See inline comments for guidance.
// 3. Export from src/data/trackers/index.ts (add to the barrel + ALL_TRACKERS array)
// 4. Run `pnpm test` to validate your entry
//
// Set draft: true while the entry is incomplete. Draft trackers skip strict
// validation in CI, so you can submit a PR with partial data.
//
// Allowed content categories:
//   Movies, TV, Music, Games, Apps, Sports, Books, Audiobooks, Comics,
//   Manga, Anime, XXX, Documentaries, Education, Tutorials, Fanres,
//   iOS Apps, Graphics, Audio
//
// Validator checks:
//   - slug: lowercase letters and hyphens only
//   - platform: "unit3d" | "gazelle" | "ggn" | "nebulance" | "custom"
//   - apiPath must match platform default:
//       unit3d   → "/api/user"
//       gazelle  → "/ajax.php"
//       ggn      → "/api.php"
//   - url: https only
//   - contentCategories: values must come from the allowed list above
//   - language: required
//   - rules: required (minimumRatio, seedTimeHours, loginIntervalDays as numbers)

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const mytracker: TrackerRegistryEntry = {
  // ── Identity ────────────────────────────────────────────────────────
  slug: "mytracker", // lowercase, hyphens only (e.g. "my-tracker")
  name: "My Tracker", // display name
  abbreviation: "", // short code (e.g. "ATH", "RED") — "" if none
  url: "https://example.com", // base URL (https only)
  description: "TODO", // 1-2 sentence overview

  // ── Platform & API ──────────────────────────────────────────────────
  platform: "unit3d", // "unit3d" | "gazelle" | "ggn" | "nebulance" | "custom"
  // Platform-specific fields (uncomment for your platform):
  //   gazelleAuthStyle: "token",   // gazelle only — "token" | "raw"
  //   gazelleEnrich: true,         // gazelle only — enables enrichment call
  //   unit3dAuthStyle: "bearer",   // unit3d only — "bearer" | "query"
  apiPath: "/api/user", // unit3d: "/api/user" | gazelle: "/ajax.php" | ggn: "/api.php"

  // ── Content ─────────────────────────────────────────────────────────
  specialty: "", // what the tracker is known for (e.g. "HD Movies", "Anime")
  contentCategories: [], // see allowed list in header
  language: "English",

  // ── Visual ──────────────────────────────────────────────────────────
  color: "#000000", // hex accent color for the tracker's detail page
  logo: "", // "/tracker-logos/mytracker_logo.svg" — file must exist in public/ — "" if none

  // ── External Links ──────────────────────────────────────────────────
  trackerHubSlug: "", // slug on trackerhub.xyz, if listed — "" if none
  statusPageUrl: "", // external status page URL — "" if none

  // ── Community ───────────────────────────────────────────────────────
  userClasses: [], // [{ name: "Power User", requirements: "Upload ≥ 100 GiB" }]
  releaseGroups: [], // [{ name: "GrpName", description: "Encodes" }] or ["GrpName"]
  bannedGroups: [], // ["GroupName"] — groups explicitly banned by the tracker
  notableMembers: [], // ["handle"] — notable community figures

  // ── Rules ───────────────────────────────────────────────────────────
  rules: {
    minimumRatio: 0, // 0 = no minimum
    seedTimeHours: 0, // 0 = no minimum
    loginIntervalDays: 0, // 0 = no login interval policy
    // fulfillmentPeriodHours: 72,      // optional — hours to complete H&R seeding
    // hnrBanLimit: 3,                  // optional — number of H&Rs before ban
    // fullRulesMarkdown: `...`,        // optional — detailed rules as markdown string
  },

  // ── Status ──────────────────────────────────────────────────────────
  warning: false, // true if the tracker has a known issue or is at risk
  warningNote: "", // short description of the warning — "" if none

  // ── Flags ───────────────────────────────────────────────────────────
  draft: true, // remove (or set false) once all required fields are filled in
  supportsTransitPapers: false, // true if the tracker supports transit papers export
  profileUrlPattern: "", // e.g. "/user.php?id={id}" — required when supportsTransitPapers: true

  // ── Stats (omit this block entirely if no real data is available) ───
  // stats: {
  //   userCount: undefined,
  //   activeUsers: undefined,
  //   torrentCount: undefined,
  //   seedSize: undefined,    // e.g. "500 TiB"
  //   statsUpdatedAt: undefined, // ISO 8601 date string
  // },
}
