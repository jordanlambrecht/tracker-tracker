# Seed Pool (SP)

| Field        | Value                               |
| ------------ | ----------------------------------- |
| Platform     | UNIT3D                              |
| Base URL     | `https://seedpool.org`              |
| API Endpoint | `https://seedpool.org/api/user`     |
| Auth Method  | Query parameter: `?api_token=TOKEN` |
| Enrichment   | N/A                                 |
| Auth Style   | N/A                                 |

## Notes

Standard UNIT3D configuration. No tracker-specific quirks.

Seed Pool uses a seedsize-based promotion system rather than upload amount. All class names are pool-themed (User → Pool → PowerPool → SuperPool → UberPool → MegaPool → GodPool). There is also a purchasable ProPool class available via IRC.

The `Cesspool` class is a demotion for users whose ratio drops below 1 — download privileges are revoked. `KiddiePool` is a timeout zone.

Status page available at `https://status.seedpool.org/`.

## Slots

**Profile Card:** username · group (no avatar or join date — UNIT3D platform)

**Badges:** `warned` (conditional — only resolves when `warned === true` in snapshot)

**Stat Cards:** `seedbonus`

**Progress:** none
