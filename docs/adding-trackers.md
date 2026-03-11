# Adding a Tracker

There are two levels of contribution: adding a **registry entry** (metadata only) or writing a **platform adapter** (code that talks to the tracker's API).

Most trackers run on UNIT3D or Gazelle, which already have adapters. For those, you only need a registry entry.

---

## Registry Entry (no code required)

If the tracker runs on UNIT3D, Gazelle, or GGn, the existing adapter handles the API calls. You just need to describe the tracker.

### 1. Create the tracker file

Create `src/data/trackers/<slug>.ts`:

```ts
// src/data/trackers/<slug>.ts

import type { TrackerRegistryEntry } from "@/data/tracker-registry"

export const mytracker: TrackerRegistryEntry = {
  slug: "mytracker",
  name: "MyTracker",
  abbreviation: "MT",
  url: "https://mytracker.org",
  description: "Brief description of what the tracker is known for.",
  platform: "unit3d",          // "unit3d" | "gazelle" | "ggn" | "custom"
  apiPath: "/api/user",        // UNIT3D default; Gazelle uses "/ajax.php"
  specialty: "General / HD",
  contentCategories: ["Movies", "TV"],
  userClasses: [
    { name: "User", requirements: "Default class" },
    { name: "Power User", requirements: "Upload >= 50 GiB, ratio >= 1.0, age >= 1 month" },
  ],
  releaseGroups: ["GroupA", "GroupB"],
  notableMembers: [],
  rules: {
    minimumRatio: 0.6,         // 0 = no minimum
    seedTimeHours: 72,         // 0 = no minimum
    loginIntervalDays: 90,     // days before account prune/disable
  },
  language: "English",
  color: "#00d4ff",            // hex color used as the tracker's accent throughout the UI
}
```

### 2. Register it

Add your import and entry to `src/data/trackers/index.ts`:

```ts
import { mytracker } from "./mytracker"

export const ALL_TRACKERS: TrackerRegistryEntry[] = [
  // ... existing trackers (alphabetical)
  mytracker,
  // ...
]
```

That's it. The tracker will appear in the Add Tracker dialog and use the existing platform adapter.

### Field reference

| Field | Required | Description |
|-------|----------|-------------|
| `slug` | Yes | Unique lowercase identifier, used in URLs |
| `name` | Yes | Display name |
| `abbreviation` | No | Short form (i.e "RED", "OPS") |
| `url` | Yes | Tracker homepage URL |
| `description` | Yes | What the tracker is known for |
| `platform` | Yes | `"unit3d"`, `"gazelle"`, `"ggn"`, or `"custom"` |
| `apiPath` | Yes | API endpoint path. UNIT3D: `/api/user`, Gazelle: `/ajax.php`, GGn: `/api.php` |
| `specialty` | Yes | Content focus (i.e "Anime", "Music", "General / HD") |
| `contentCategories` | Yes | Array of content types |
| `userClasses` | Yes | Array of `{ name, requirements? }` — the tracker's user class ladder |
| `releaseGroups` | Yes | Array of group names or `{ name, description }` objects |
| `notableMembers` | Yes | Array of notable community members (can be empty) |
| `bannedGroups` | No | Groups banned from uploading |
| `rules` | No | See TrackerRules below |
| `stats` | No | `{ userCount?, torrentCount?, seedSize?, statsUpdatedAt? }` |
| `language` | No | Primary language |
| `color` | Yes | Hex color for the tracker's accent theme |
| `logo` | No | Path to logo file in `public/tracker-logos/` |
| `trackerHubSlug` | No | Slug on TrackerHub for status monitoring |
| `statusPageUrl` | No | External status page URL |
| `draft` | No | Set `true` if the platform adapter doesn't exist yet |

### TrackerRules

| Field | Type | Description |
|-------|------|-------------|
| `minimumRatio` | `number` | Minimum ratio before penalties. 0 = no minimum |
| `seedTimeHours` | `number` | Required seed time per torrent in hours. 0 = no minimum |
| `loginIntervalDays` | `number` | Days of inactivity before account prune/disable |
| `fulfillmentPeriodHours` | `number?` | Time allowed to complete seeding requirement |
| `hnrBanLimit` | `number?` | Number of H&R warnings before ban |
| `fullRulesMarkdown` | `string?` | Detailed rules text (shown in tracker detail page) |

---

## Platform Adapter (code required)

If the tracker doesn't run on UNIT3D, Gazelle, or GGn, you need to write an adapter that knows how to call its API and normalize the response.

### 1. Create the adapter

Create `src/lib/adapters/<platform>.ts`:

```ts
// src/lib/adapters/<platform>.ts

import type { FetchOptions, TrackerAdapter, TrackerStats } from "./types"

export class MyPlatformAdapter implements TrackerAdapter {
  async fetchStats(
    baseUrl: string,
    apiToken: string,
    apiPath: string,
    options?: FetchOptions
  ): Promise<TrackerStats> {
    // 1. Build the request URL
    const url = new URL(apiPath, baseUrl)

    // 2. Make the API call (handle proxy if options.proxyAgent is set)
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      throw new Error(`Tracker API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // 3. Map the API response to TrackerStats
    return {
      username: data.username,
      group: data.class_name,
      uploadedBytes: BigInt(data.uploaded),
      downloadedBytes: BigInt(data.downloaded),
      ratio: data.ratio,
      bufferBytes: BigInt(data.uploaded) - BigInt(data.downloaded),
      seedingCount: data.seeding ?? 0,
      leechingCount: data.leeching ?? 0,
      seedbonus: data.bonus ?? 0,
      hitAndRuns: data.hnrs ?? 0,
      requiredRatio: null,       // set if the API provides it
      warned: null,              // set if the API provides it
      freeleechTokens: null,     // set if the API provides it
    }
  }
}
```

### TrackerStats fields

Every adapter must return all 13 fields. Use `null` for fields the API doesn't provide.

| Field | Type | Description |
|-------|------|-------------|
| `username` | `string` | Current username |
| `group` | `string` | User class / rank name |
| `uploadedBytes` | `bigint` | Total uploaded in bytes |
| `downloadedBytes` | `bigint` | Total downloaded in bytes |
| `ratio` | `number` | Upload/download ratio |
| `bufferBytes` | `bigint` | uploaded - downloaded |
| `seedingCount` | `number` | Active seeding torrents |
| `leechingCount` | `number` | Active leeching torrents |
| `seedbonus` | `number` | Bonus points / freeleech tokens |
| `hitAndRuns` | `number` | Active H&R warnings |
| `requiredRatio` | `number \| null` | Required ratio (Gazelle-specific) |
| `warned` | `boolean \| null` | Whether the user has a ratio warning |
| `freeleechTokens` | `number \| null` | Available freeleech tokens |

### 2. Register the adapter

Add it to `src/lib/adapters/index.ts`:

```ts
import { MyPlatformAdapter } from "./myplatform"

const adapters: Record<string, TrackerAdapter> = {
  gazelle: new GazelleAdapter(),
  ggn: new GGnAdapter(),
  unit3d: new Unit3dAdapter(),
  myplatform: new MyPlatformAdapter(),  // add here
}

export const DEFAULT_API_PATHS: Record<string, string> = {
  unit3d: "/api/user",
  gazelle: "/ajax.php",
  ggn: "/api.php",
  myplatform: "/api/endpoint",          // add here
}
```

### 3. Update the platform type

Add your platform to the union type in `src/data/tracker-registry.ts`:

```ts
platform: "unit3d" | "gazelle" | "ggn" | "myplatform" | "custom"
```

### 4. Create the registry entry

Follow the registry entry steps above, setting `platform` to your new platform name.

### Proxy support

If you want proxy support, use `proxyFetch` from `src/lib/proxy.ts` when `options.proxyAgent` is set. See the UNIT3D adapter (`src/lib/adapters/unit3d.ts`) for the pattern — it falls back to regular `fetch` when no proxy is configured.

### Byte parsing

UNIT3D returns formatted byte strings like `"500.25 GiB"`. If your tracker's API does the same, use `parseBytes()` from `src/lib/parser.ts` to convert them to `bigint`. If the API returns raw byte counts, convert directly with `BigInt()`.
