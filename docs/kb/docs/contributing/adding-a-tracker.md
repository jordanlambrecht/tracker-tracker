# Adding a Tracker to the Registry

This guide covers adding a new tracker entry for an **existing platform** (UNIT3D, Gazelle, GGn, or Nebulance). If the tracker runs on a platform that does not have an adapter yet, stop here and read [Tracker API Responses](tracker-responses.md) first — you will need to write an adapter before the registry entry.

If the tracker you want to add runs on UNIT3D, Gazelle, GGn, or Nebulance, you only need to create one file and add two lines to the barrel export. No adapter code required.

---

## Standardization Philosophy

Every tracker file in `src/data/trackers/` follows the same field order and completeness rules. This makes files easy to compare, review, and diff.

**Every field must be present in every tracker file, even if empty.** Use `""` for empty strings, `[]` for empty arrays, and `false` for booleans. Do not omit fields and do not use `undefined` as a value. Presence in the file shows the field was considered.

```typescript
abbreviation: "" // not: abbreviation: undefined
logo: "" // not: logo: undefined
trackerHubSlug: "" // not: trackerHubSlug: undefined
bannedGroups: [] // not: bannedGroups: undefined
warning: false // not: warning: undefined
```

**There are three exceptions to this rule:**

1. The `stats` block is omitted entirely when no real data exists. Do not include the block with `undefined` values.
2. `rules.fulfillmentPeriodHours`, `rules.hnrBanLimit`, and `rules.fullRulesMarkdown` are truly optional — omit them when unknown rather than setting them to `undefined`.
3. Platform-specific fields (`gazelleAuthStyle`, `gazelleEnrich`, `unit3dAuthStyle`) only appear in tracker files for their respective platform. Do not add them to tracker files on other platforms.

---

## 1. Copy the Template

The template lives at `src/data/trackers/_template.ts`. Copy it to a new file named after your tracker's slug. The slug must be lowercase with hyphens only — no underscores, no uppercase, no special characters.

```bash
cp src/data/trackers/_template.ts src/data/trackers/mytracker.ts
```

Here is the full template for reference:

```typescript
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
//   - platform: "unit3d" | "gazelle" | "ggn" | "nebulance" | "mam" | "custom"
//   - apiPath must match platform default:
//       unit3d     → "/api/user"
//       gazelle    → "/ajax.php"
//       ggn        → "/api.php"
//       nebulance  → "/api.php"
//       mam        → "/jsonLoad.php"
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
  platform: "unit3d", // "unit3d" | "gazelle" | "ggn" | "nebulance" | "mam" | "custom"
  // Platform-specific fields (uncomment for your platform):
  //   gazelleAuthStyle: "token",   // gazelle only — "token" | "raw"
  //   gazelleEnrich: true,         // gazelle only — enables enrichment call
  //   unit3dAuthStyle: "bearer",   // unit3d only — "bearer" | "query"
  apiPath: "/api/user", // unit3d: "/api/user" | gazelle: "/ajax.php" | ggn: "/api.php" | mam: "/jsonLoad.php"

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
```

---

## 2. Field Reference

Fields are documented in the same order they appear in the template, grouped by section.

### Identity

#### `slug`

Type: `string`

The unique identifier for this tracker. Used in file names, URL paths, and database lookups. Must be lowercase with hyphens only.

```typescript
slug: "blutopia"
slug: "my-tracker"
```

#### `name`

Type: `string`

Human-readable display name. This is what users see in the UI.

```typescript
name: "Blutopia"
name: "My Tracker"
```

#### `abbreviation`

Type: `string`

A short code for the tracker, used in compact UI contexts. Use `""` if none.

```typescript
abbreviation: "ATH" // Aither
abbreviation: "RED" // REDacted
abbreviation: "" // no abbreviation
```

#### `url`

Type: `string`

The base URL of the tracker site, including protocol. HTTPS only. No trailing slash.

```typescript
url: "https://blutopia.cc"
```

The adapter constructs the API request by appending `apiPath` to this value.

#### `description`

Type: `string`

One or two sentences describing what the tracker is about — content focus, community reputation, anything a prospective member would want to know.

```typescript
description: "The largest general music tracker (also has some software). Has an interview to join, although the wait can be notoriously long."
```

---

### Platform & API

#### `platform`

Type: `"unit3d" | "gazelle" | "ggn" | "nebulance" | "mam" | "custom"`

Which adapter handles API requests for this tracker. This controls how the scheduler fetches stats. Must match the software the tracker runs.

| Platform      | What it means                                                  |
| ------------- | -------------------------------------------------------------- |
| `"unit3d"`    | Runs the UNIT3D codebase                                       |
| `"gazelle"`   | Runs Gazelle or a derivative (Orpheus, Gazelle-Music, etc.)    |
| `"ggn"`       | GazelleGames only — custom API different from standard Gazelle |
| `"nebulance"` | Nebulance-specific API                                         |
| `"mam"`       | MyAnonaMouse — cookie-based auth via `mam_id` session cookie   |
| `"custom"`    | Placeholder, not implemented — do not use                      |

#### `gazelleAuthStyle`

Type: `"token" | "raw"` — Gazelle trackers only

Controls how the API token is sent in the request.

- `"token"` — sends the token in an `Authorization: token TOKEN` header (used by REDacted, Orpheus)
- `"raw"` — sends the token directly in the `Authorization` header without a prefix

Only include this field for Gazelle trackers. If you are unsure which style a Gazelle tracker uses, check `docs/kb/docs/contributing/tracker-responses-gazelle.md`.

#### `gazelleEnrich`

Type: `boolean` — Gazelle trackers only

When `true`, the adapter makes a second API call (`action=user&id=X`) after the initial `action=index` call to fetch seeding/leeching counts, warned status, joined date, avatar, ranks, and community stats. **All Gazelle trackers must set this to `true`** — without it, seeding and leeching counts will always be 0.

```typescript
gazelleEnrich: true
```

Only include this field for Gazelle trackers.

#### `unit3dAuthStyle`

Type: `"bearer" | "query"` — UNIT3D trackers only

Controls how the API token is sent in the request.

- `"bearer"` — sends the token in an `Authorization: Bearer TOKEN` header (required by UNIT3D v8+)
- `"query"` — sends the token as a `?api_token=TOKEN` query parameter (legacy UNIT3D)

Omit this field to use the default query parameter method. Set to `"bearer"` if the tracker's UNIT3D instance has been updated to v8+ and returns 401 with query param auth.

```typescript
unit3dAuthStyle: "bearer" // Blutopia (UNIT3D v8+)
```

Only include this field for UNIT3D trackers.

#### `apiPath`

Type: `string`

The path appended to `url` when making API requests. Must match the platform's actual API endpoint.

| Platform    | Default apiPath |
| ----------- | --------------- |
| `unit3d`    | `"/api/user"`   |
| `gazelle`   | `"/ajax.php"`   |
| `ggn`       | `"/api.php"`    |
| `nebulance` | `"/api.php"`    |

```typescript
// UNIT3D tracker
apiPath: "/api/user"

// Gazelle tracker
apiPath: "/ajax.php"
```

Do not change this from the platform default unless you have verified that the tracker uses a non-standard path. Almost no trackers deviate from the defaults above.

---

### Content

#### `specialty`

Type: `string`

A short phrase describing what the tracker specializes in. Shown in the UI and used for filtering. Use `""` if none.

```typescript
specialty: "HD Movies"
specialty: "Music"
specialty: ""
```

#### `contentCategories`

Type: `string[]`

The categories of content hosted on the tracker. Must use values from the allowed list exactly as written (case-sensitive):

```
Movies, TV, Music, Games, Apps, Sports, Books, Audiobooks, Comics,
Manga, Anime, XXX, Documentaries, Education, Tutorials, Fanres,
iOS Apps, Graphics, Audio
```

```typescript
contentCategories: ["Movies", "TV"]
contentCategories: ["Music", "Apps"]
contentCategories: []
```

#### `language`

Type: `string`

Primary language of the tracker. Use `"English"` for English-language trackers.

---

### Visual

#### `color`

Type: `string`

A hex color code used to theme the tracker's detail page — chart colors, scrollbar, stat card accents. Pick something that represents the tracker's visual identity.

```typescript
color: "#00d4ff" // Aither cyan
color: "#f44336" // REDacted red
color: "#7b1fa2" // GazelleGames purple
color: "#1a4fc2" // Nebulance blue
```

#### `logo`

Type: `string`

Path to the tracker's logo file under the `public/` directory. The file must actually exist — do not set this field to a path unless you have added the logo. Use `""` if none.

```typescript
logo: "/tracker-logos/aither_logo.svg"
logo: "/tracker-logos/nebulance_logo.png"
logo: ""
```

SVG is preferred. PNG is acceptable.

---

### External Links

#### `trackerHubSlug`

Type: `string`

The tracker's slug on [trackerhub.xyz](https://trackerhub.xyz), if the tracker is listed there. Used to link to its Trackerhub profile. Use `""` if not listed.

```typescript
trackerHubSlug: "aither"
trackerHubSlug: ""
```

#### `statusPageUrl`

Type: `string`

URL to an external status page. Many trackers have one at `trackerstatus.info`. Use `""` if none.

```typescript
statusPageUrl: "https://status.aither.cc/status/aither"
statusPageUrl: ""
```

---

### Status

#### `warning`

Type: `boolean`

Set to `true` if there is something users should know before adding this tracker (for example, known API instability). Use `false` when there is no known issue.

#### `warningNote`

Type: `string`

Short description of the warning. Use `""` if `warning` is `false`.

---

### Flags

#### `draft`

Type: `boolean`

When `true`, the tracker is excluded from `TRACKER_REGISTRY` and skips strict validation in CI. Use this while you are filling in fields. Set to `false` (or remove the field) once the entry is complete.

#### `supportsTransitPapers`

Type: `boolean`

Set to `true` if the tracker supports the transit papers export feature. Use `false` otherwise.

#### `profileUrlPattern`

Type: `string`

The URL pattern used to construct a user's profile link. Required when `supportsTransitPapers` is `true`. Use `""` if not applicable.

```typescript
profileUrlPattern: "/user.php?id={id}"
profileUrlPattern: ""
```

---

### Stats

The `stats` block is **omitted entirely** when no real data is available. Do not include the block with `undefined` values — the absence of the block signals that no stats have been sourced yet.

When you do have data, include only the fields you know:

```typescript
stats: {
  userCount: 12000,
  torrentCount: 450000,
  seedSize: "8.2 PiB",
  statsUpdatedAt: "2025-09-01",
}
```

Available fields:

```typescript
stats: {
  userCount?: number
  activeUsers?: number
  torrentCount?: number
  seedSize?: string       // e.g. "500 TiB"
  statsUpdatedAt?: string // ISO 8601 date string
}
```

---

## 3. User Classes

The `userClasses` array documents the tracker's rank/class system. Each entry is a `TrackerUserClass`:

```typescript
interface TrackerUserClass {
  name: string // required — display name of the class
  requirements?: string // what it takes to reach this class
  perks?: RankPerk[] // structured perks (optional, rarely populated)
  icon?: string // path to an icon (optional)
}
```

For most trackers, `name` and `requirements` are all you need. Write `requirements` as a human-readable summary — no need to be exhaustive, but include the key numeric thresholds (upload amount, ratio, account age, seed count).

```typescript
// From aither.ts — upload-based progression
userClasses: [
  { name: "Leech", requirements: "Ratio below 0.4 — download privileges revoked" },
  { name: "Phobos", requirements: "Ratio ≥ 0.4. 4 download slots" },
  {
    name: "Zeus",
    requirements:
      "Upload ≥ 2 TiB or seed size ≥ 2 TiB, ratio ≥ 0.6, age ≥ 3 months, avg seedtime ≥ 10 days. 25 download slots",
  },
  // ...
  // Staff-assigned ranks follow community ranks
  { name: "Uploader", requirements: "Staff — role model uploader. Freeleech, H&R immune" },
]
```

```typescript
// From redacted.ts — simpler progression
userClasses: [
  { name: "User", requirements: "Default class on registration" },
  { name: "Member", requirements: "1 week, 25 GB up, 0.65 ratio" },
  { name: "Power User", requirements: "2 weeks, 25 GB up, 0.65 ratio, 5 torrents seeding" },
]
```

```typescript
// From gazellegames.ts — achievement-point based
userClasses: [
  { name: "Amateur", requirements: "Default starting class" },
  {
    name: "Gamer",
    requirements:
      "600 achievement points. Invites, requests, collections, Top 10, peerlists, mass downloader",
  },
]
```

If the tracker has no formal class system, leave the array empty:

```typescript
userClasses: []
```

The `perks` array accepts structured perk objects for when you want machine-readable perk data:

```typescript
perks: [
  { type: "freeleech", label: "Freeleech on all torrents" },
  { type: "hnr-immune", label: "H&R immunity" },
  { type: "download-slots", label: "50 download slots" },
]
```

Valid `RankPerkType` values: `"download-slots"`, `"upload"`, `"invite"`, `"freeleech"`, `"double-upload"`, `"hnr-immune"`, `"mod-bypass"`, `"custom"`.

Structured perks are not required — a plain `requirements` string is enough for the UI to display the information.

---

## 4. Release Groups

The `releaseGroups` field accepts a mixed array — entries can be either a plain string or a `ReleaseGroup` object:

```typescript
interface ReleaseGroup {
  name: string
  description?: string
}

releaseGroups: (string | ReleaseGroup)[]
```

Use the object form when you have something useful to say about what the group releases. Use a plain string when the name alone is sufficient (typically for banned groups, which belong in `bannedGroups` instead).

```typescript
// From aither.ts — objects with descriptions
releaseGroups: [
  { name: "ATELiER", description: "Main house group — high-quality 1080p encodes and remuxes" },
  { name: "Kitsune", description: "Primary — WEB-DL" },
  {
    name: "MainFrame",
    description: "Primary — 2160p encodes, secondary 1080p encodes and remuxes",
  },
  { name: "ARTiCUN0" }, // object without description — name only
]
```

If the tracker has no notable internal groups, or you do not know them, use an empty array:

```typescript
releaseGroups: []
```

The `bannedGroups` field is a separate `string[]` for groups that are explicitly banned from the tracker:

```typescript
bannedGroups: ["EVO", "FGT", "YIFY", "YTS"]
```

---

## 5. Rules

The `rules` field documents the tracker's seeding and account policies. The type:

```typescript
interface TrackerRules {
  minimumRatio: number // required — 0 = no minimum
  seedTimeHours: number // required — 0 = no minimum
  loginIntervalDays: number // required — days before account is disabled; 0 = no policy
  fulfillmentPeriodHours?: number // total hours allowed to complete H&R seeding
  hnrBanLimit?: number // number of active H&Rs before downloading is blocked
  fullRulesMarkdown?: string // the full rules as a markdown string
}
```

`minimumRatio`, `seedTimeHours`, and `loginIntervalDays` are required even if the tracker has no policy — use `0` to mean "not enforced."

```typescript
// From nebulance.ts — ratioless tracker
rules: {
  minimumRatio: 0,      // ratioless
  seedTimeHours: 72,
  loginIntervalDays: 90,
}
```

```typescript
// From aither.ts — full policy
rules: {
  minimumRatio: 0.4,
  seedTimeHours: 120,
  loginIntervalDays: 90,
  fulfillmentPeriodHours: 480,  // 20 days to complete H&R seeding
  hnrBanLimit: 3,               // 3 active H&Rs → downloads blocked
  fullRulesMarkdown: "...",
}
```

For `fullRulesMarkdown`, use the array-join format. This keeps diffs clean and avoids multiline template literal indentation issues:

```typescript
fullRulesMarkdown: [
  "## Golden Rules",
  "**1.** Do not defy the expressed wishes of the staff.",
  "**2.** Access is a privilege, not a right.",
  "",
  "## Ratio System",
  "Required ratio starts at 0.00 and rises as you download more.",
  "",
  "## Seeding Rules",
  "- Torrents must be seeded for **72 hours** after snatching.",
].join("\n"),
```

---

## 6. Register in the Barrel File

Open `src/data/trackers/index.ts`. You need to add the tracker in two places.

**Step 1 — Add a named export** in the `export *` block at the top. Keep the list alphabetically sorted:

```typescript
export * from "./morethantv"
export * from "./mytracker" // add this
export * from "./myanonamouse"
```

**Step 2 — Add a named import** in the import block in the middle of the file:

```typescript
import { morethantv } from "./morethantv"
import { mytracker } from "./mytracker" // add this
import { myanonamouse } from "./myanonamouse"
```

**Step 3 — Add the tracker to the `ALL_TRACKERS` array** at the bottom. Keep this list alphabetically sorted as well:

```typescript
export const ALL_TRACKERS: TrackerRegistryEntry[] = [
  // ...
  morethantv,
  mytracker, // add this
  myanonamouse,
  // ...
]
```

The exported const name must match the variable exported from your tracker file. For a file that exports `export const mytracker: TrackerRegistryEntry = { ... }`, the import and array entry are both `mytracker`.

---

## 7. Verify It Works

### Type check

```bash
pnpm tsc
```

This will catch any missing required fields or type mismatches. Fix all errors before proceeding.

### Run the test suite

```bash
pnpm test:run
```

The test suite validates tracker registry entries — required fields, valid platform types, correct `apiPath` values for each platform, valid content category names, and that all `bannedGroups` entries are plain strings.

### Check it in the UI

1. Start the dev server: `pnpm dev`
2. Go to `/trackers/new`
3. Search for your tracker by name in the Add Tracker dialog
4. Add it with a valid API token
5. Click **Poll Now** on the tracker card
6. Confirm the tracker status changes and stats appear in the dashboard

If the tracker appears in search results and polls successfully, the registry entry is correct.

---

## 8. Common Mistakes

### Forgetting to add to the barrel file

The most common mistake. If you create `src/data/trackers/mytracker.ts` but do not edit `index.ts`, the tracker will never appear in the UI. The file must be exported and imported in `index.ts`, and the variable must be added to `ALL_TRACKERS`.

### Wrong `platform` type

Using `"unit3d"` for a Gazelle tracker or vice versa will cause the adapter to send the wrong API request. The scheduler will log a `fetch` error or return garbled data. Check the tracker's tech stack — most UNIT3D sites have `/api/user` in their documentation, and most Gazelle sites have `/ajax.php`.

### Wrong `apiPath`

Each platform has a default API path (see the table in the field reference above). Setting `apiPath: "/api/user"` on a Gazelle tracker, for example, will cause every poll to fail with a 404. The path must match what the platform actually serves.

### `draft: true` left in a finished entry

If `draft` is `true`, the entry is filtered out of `TRACKER_REGISTRY` at runtime and never shown to users. Remove the field or set `draft: false` when the entry is complete.

### Invalid content category names

The `contentCategories` array only accepts values from the fixed allowed list. A typo like `"Movie"` instead of `"Movies"`, or `"Audiobook"` instead of `"Audiobooks"`, will fail the registry validation tests. The list is case-sensitive.

### `color` not a valid hex code

The `color` field must be a full six-digit hex string starting with `#`. Shorthand hex (`#fff`) and named colors (`red`) are not accepted. Use a real hex value.

### Logo path points to a missing file

If you set `logo: "/tracker-logos/mytracker.svg"` but the file does not exist under `public/`, the logo image will silently 404 and show a broken image in the UI. Either add the file or set `logo: ""`.
