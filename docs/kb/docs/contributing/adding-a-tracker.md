# Adding a Tracker to the Registry

This guide covers adding a new tracker entry for an **existing platform** (UNIT3D, Gazelle, GGn, or Nebulance). If the tracker runs on a platform that does not have an adapter yet, stop here and read [Tracker API Responses](tracker-responses.md) first — you will need to write an adapter before the registry entry.

If the tracker you want to add runs on UNIT3D, Gazelle, GGn, or Nebulance, you only need to create one file and add two lines to the barrel export. No adapter code required.

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
```

---

## 2. Field Reference

### Required Fields

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

#### `platform`

Type: `"unit3d" | "gazelle" | "ggn" | "nebulance" | "custom"`

Which adapter handles API requests for this tracker. This controls how the scheduler fetches stats. Must match the software the tracker runs.

| Platform      | What it means                                                  |
| ------------- | -------------------------------------------------------------- |
| `"unit3d"`    | Runs the UNIT3D codebase                                       |
| `"gazelle"`   | Runs Gazelle or a derivative (Orpheus, Gazelle-Music, etc.)    |
| `"ggn"`       | GazelleGames only — custom API different from standard Gazelle |
| `"nebulance"` | Nebulance-specific API                                         |
| `"custom"`    | Placeholder, not implemented — do not use                      |

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

#### `specialty`

Type: `string`

A short phrase describing what the tracker specializes in. Shown in the UI and used for filtering.

```typescript
specialty: "HD Movies"
specialty: "Music"
specialty: "General / HD content"
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
contentCategories: ["Games"]
```

#### `color`

Type: `string`

A hex color code used to theme the tracker's detail page — chart colors, scrollbar, stat card accents. Pick something that represents the tracker's visual identity.

```typescript
color: "#00d4ff" // Aither cyan
color: "#f44336" // REDacted red
color: "#7b1fa2" // GazelleGames purple
color: "#1a4fc2" // Nebulance blue
```

---

### Optional Fields

#### `abbreviation`

Type: `string | undefined`

A short code for the tracker, used in compact UI contexts.

```typescript
abbreviation: "ATH" // Aither
abbreviation: "RED" // REDacted
abbreviation: "GGn" // GazelleGames
```

#### `language`

Type: `string | undefined`

Primary language of the tracker. Defaults to `"English"` if omitted.

#### `logo`

Type: `string | undefined`

Path to the tracker's logo file under the `public/` directory. The file must actually exist — do not set this field if you have not added the logo.

```typescript
logo: "/tracker-logos/aither_logo.svg"
logo: "/tracker-logos/nebulance_logo.png"
```

SVG is preferred. PNG is acceptable.

#### `trackerHubSlug`

Type: `string | undefined`

The tracker's slug on [trackerhub.xyz](https://trackerhub.xyz), if the tracker is listed there. Used to link to its Trackerhub profile.

```typescript
trackerHubSlug: "aither"
trackerHubSlug: "gazelle-games"
```

#### `statusPageUrl`

Type: `string | undefined`

URL to an external status page. Many trackers have one at `trackerstatus.info`.

```typescript
statusPageUrl: "https://status.aither.cc/status/aither"
statusPageUrl: "https://red.trackerstatus.info/"
```

#### `gazelleAuthStyle`

Type: `"token" | "raw" | undefined`

Gazelle trackers only. Controls how the API token is sent in the request.

- `"token"` — sends the token in an `Authorization: token TOKEN` header (used by REDacted, Orpheus)
- `"raw"` — sends the token directly in the `Authorization` header without a prefix

Omit this field for non-Gazelle trackers. If you are unsure which style a Gazelle tracker uses, check `docs/kb/docs/contributing/tracker-responses-gazelle.md`.

#### `gazelleEnrich`

Type: `boolean | undefined`

Gazelle trackers only. When `true`, the adapter makes a second API call (`action=user&id=X`) after the initial `action=index` call to fetch additional fields like `warned`. Set to `true` for trackers where this extra call is needed and documented to work.

```typescript
gazelleEnrich: true // REDacted
```

#### `draft`

Type: `boolean | undefined`

When `true`, the tracker is excluded from `TRACKER_REGISTRY` and skips strict validation in CI. Use this while you are filling in fields. Remove the field (or set to `false`) once the entry is complete.

#### `warning` and `warningNote`

Type: `boolean | undefined` and `string | undefined`

Set `warning: true` and provide a `warningNote` if there is something users should know before adding this tracker (for example, known API instability).

---

### Stats

```typescript
stats: {
  userCount?: number
  activeUsers?: number
  torrentCount?: number
  seedSize?: string
  statsUpdatedAt?: string
}
```

All fields are optional. Fill in what you know. If the tracker does not publish these numbers publicly, leave the object with all values as `undefined`.

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

For `fullRulesMarkdown`, you can use a template literal for readability:

```typescript
fullRulesMarkdown: `## Ratio Requirements

| Downloaded | Required Ratio |
|---|---|
| 0-5 GB | 0.00 |
| 100+ GB | 0.60 |

## Seeding Rules

- Torrents must be seeded for **72 hours** after snatching.`,
```

Or join an array of strings, which works well for long rule sets:

```typescript
fullRulesMarkdown: [
  "## Golden Rules",
  "**1.** Do not defy the expressed wishes of the staff.",
  "**2.** Access is a privilege, not a right.",
  "",
  "## Ratio System",
  "Required ratio starts at 0.00 and rises as you download more.",
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

If you set `logo: "/tracker-logos/mytracker.svg"` but the file does not exist under `public/`, the logo image will silently 404 and show a broken image in the UI. Either add the file or leave `logo` as `undefined`.
