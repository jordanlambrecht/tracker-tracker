# UNIT3D API Response

## Endpoint

```bash
GET {baseUrl}/api/user?api_token={TOKEN}
```

Most UNIT3D sites use `/api/user` by default. Override via the tracker's `apiPath` field if needed.

## Authentication

Pass API token as a query parameter: `?api_token=TOKEN`. No special headers required.

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

Byte values return as formatted strings (`"500.25 GiB"`), not integers. Same for `ratio`, `buffer`, and `seedbonus` — all strings. The adapter parses via `parseBytes()` or `parseFloat()`.

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

One API call per poll, no enrichment step.

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
