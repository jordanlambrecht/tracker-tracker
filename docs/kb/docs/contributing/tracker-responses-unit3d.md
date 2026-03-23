# UNIT3D API Response

## Endpoint

```
GET {baseUrl}/api/user?api_token={TOKEN}
```

The path `/api/user` comes from the tracker's `apiPath` field in the database. Most UNIT3D sites use this default.

## Authentication

API token passed as a query parameter: `?api_token=TOKEN`. No request headers required beyond the default `User-Agent`.

## Example Response

```json
{
  "username": "JohnDoe",
  "group": "Power User",
  "uploaded": "500.25 GiB",
  "downloaded": "125.50 GiB",
  "ratio": "3.99",
  "buffer": "374.75 GiB",
  "seeding": 156,
  "leeching": 2,
  "seedbonus": "12500.00",
  "hit_and_runs": 0
}
```

All byte values are **formatted strings** (`"500.25 GiB"`), not integers. The `ratio`, `buffer`, and `seedbonus` fields are also strings even though they represent numbers. The adapter runs everything through `parseBytes()` or `parseFloat()` accordingly.

## Field Mapping

| TrackerStats field | UNIT3D field   | Type     | Notes                                |
| ------------------ | -------------- | -------- | ------------------------------------ |
| `username`         | `username`     | `string` | Direct copy                          |
| `group`            | `group`        | `string` | User class / rank label              |
| `uploadedBytes`    | `uploaded`     | `string` | Parsed via `parseBytes()` → `bigint` |
| `downloadedBytes`  | `downloaded`   | `string` | Parsed via `parseBytes()` → `bigint` |
| `ratio`            | `ratio`        | `string` | `parseFloat()`, defaults to `0`      |
| `bufferBytes`      | `buffer`       | `string` | Parsed via `parseBytes()` → `bigint` |
| `seedingCount`     | `seeding`      | `number` | Direct copy                          |
| `leechingCount`    | `leeching`     | `number` | Direct copy                          |
| `seedbonus`        | `seedbonus`    | `string` | `parseFloat()`, defaults to `0`      |
| `hitAndRuns`       | `hit_and_runs` | `number` | Direct copy                          |
| `requiredRatio`    | —              | —        | Always `null` — not in UNIT3D API    |
| `warned`           | —              | —        | Always `null` — not in UNIT3D API    |
| `freeleechTokens`  | —              | —        | Always `null` — not in UNIT3D API    |

UNIT3D makes a single API call per poll. No enrichment step.

## Supported Trackers

- [Aither](trackers/aither.md)
- [Blutopia](trackers/blutopia.md)
- [Concertos](trackers/concertos.md)
- [FearNoPeer](trackers/fearnopeer.md)
- [LST](trackers/lst.md)
- [OldToons](trackers/oldtoons.md)
- [OnlyEncodes](trackers/onlyencodes.md)
- [Racing4Everyone](trackers/racing4everyone.md)
- [Reelflix](trackers/reelflix.md)
- [SkipTheCommercials](trackers/skipthecommercials.md)
- [Upload.cx](trackers/uploadcx.md)
